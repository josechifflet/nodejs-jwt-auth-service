import type { NextFunction, Request, Response } from 'express';
import { nanoid } from 'nanoid';

import SessionService from '@/api/v1/session/service';
import UserService from '@/api/v1/user/service';
import config from '@/config';
import { generateDefaultTOTP, validateDefaultTOTP } from '@/core/rfc6238';
import { signEdDSAJWT, signHS256JWT, verifyEdDSAJWT } from '@/core/rfc7519';
import { parseBasicAuth } from '@/core/rfc7617';
import CacheService from '@/modules/cache/service';
import Email from '@/modules/email';
import AppError from '@/util/app-error';
import getDeviceID from '@/util/device-id';
import { extractHeader } from '@/util/headers';
import { verifyPassword } from '@/util/passwords';
import randomBytes from '@/util/random-bytes';
import safeCompare from '@/util/safe-compare';
import sendResponse from '@/util/send-response';

/**
 * Utility function to set `Authenticate` header with the proper `Realm`. Why
 * we do not use `WWW-Authenticate` like in RFC 7617? It is to prevent the
 * front-end from summoning the not-really-friendly authentication popup.
 *
 * @param msg - Error message to be passed to the user.
 * @param code - HTTP status code for the user.
 * @param res - Express.js's response object.
 * @param next - Express.js's next function.
 */
const invalidBasicAuth = (
  msg: string,
  code: number,
  res: Response,
  next: NextFunction,
) => {
  res.set('Authenticate', 'Basic realm="OTP-MFA", charset="UTF-8"');
  next(new AppError(msg, code));
};

/**
 * Sends the user's authentication status to the client in the form of JSON response.
 * The 'type' of the response is authentication, as this one does not really
 * fit with the 'users' type. This intentionally returns both the authentication status
 * AND the user, so the front-end does not need to create two sequential requests just to get
 * the current user (this will be used in many requests in the front-end, so let's just keep our
 * bandwith small).
 *
 * @param req - Express.js's request object.
 * @param res - Express.js's response object.
 * @param isAuthenticated - Boolean value whether the user is authenticated or not.
 * @param isMFA - Boolean value whether the user is on secure session or not.
 * @param user - The user's data, or a null value.
 */
const sendUserStatus = (
  req: Request,
  res: Response,
  isAuthenticated: boolean,
  isMFA: boolean,
  user: Record<string, unknown> | null,
) => {
  sendResponse({
    req,
    res,
    status: 'success',
    statusCode: 200,
    data: { isAuthenticated, isMFA, user },
    message: "Successfully fetched the user's status!",
    type: 'auth',
  });
};

/**
 * Authentication controller, forwarded from 'handler'.
 */
const AuthController = {
  /**
   * Gets the user's status (is normally authenticated and is MFA authenticated). The authentication
   * process is similar to the ones in 'has-session.ts' and 'has-jwt.ts'.
   * This is a special middleware. It should have no 'next', and this middleware
   * will ignore ANY errors that might be in the way. If an error is found, the user
   * will not be authenticated and will not throw an 'AppError'.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   */
  getStatus: async (req: Request, res: Response) => {
    try {
      // Check session.
      if (!req.session.userID) {
        sendUserStatus(req, res, false, false, null);
        return;
      }

      // Make sure that the user exists in the database.
      const user = await UserService.getUser({ userID: req.session.userID });
      if (!user) {
        sendUserStatus(req, res, false, false, null);
        return;
      }

      // Make sure that the user is not blocked.
      if (!user.isActive) {
        sendUserStatus(req, res, false, false, null);
        return;
      }

      // Extract token and validate. From this point on, the user is defined (authenticated)
      // and will be sent back as part of the response (not null as in the previous ones).
      const token = extractHeader(req, 'otp-authorization');
      if (!token) {
        sendUserStatus(req, res, true, false, user);
        return;
      }

      // Verify token.
      let decoded;
      try {
        decoded = await verifyEdDSAJWT(token);
      } catch {
        sendUserStatus(req, res, true, false, user);
        return;
      }

      // Verify JTI.
      if (!decoded.payload.jti) {
        sendUserStatus(req, res, true, false, user);
        return;
      }

      // Checks whether JTI exists or not in the cache.
      const userID = await CacheService.getOTPSession(decoded.payload.jti);
      if (!userID) {
        sendUserStatus(req, res, true, false, user);
        return;
      }

      // Check if JTI is equal to the current session, and ensure that the subject
      // is equal to the user ID as well.
      if (req.session.userID !== userID || decoded.payload.sub !== userID) {
        sendUserStatus(req, res, true, false, user);
      }

      // Send final response that the user is properly authenticated and authorized.
      sendUserStatus(req, res, true, true, user);
    } catch {
      sendUserStatus(req, res, false, false, null);
    }
  },

  /**
   * A user can securely reset their password by using this handler.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   * @param next - Express.js's next function.
   */
  forgotPassword: async (req: Request, res: Response, next: NextFunction) => {
    const { email, username } = req.body;

    // Try to find user by both attributes.
    const [userByUsername, userByEmail] = await Promise.all([
      UserService.getUserComplete({ email }),
      UserService.getUserComplete({ username }),
    ]);

    if (!userByUsername || !userByEmail) {
      next(new AppError('User with those identifiers is not found!', 404));
      return;
    }

    // If username is not paired with the email, then short circuit.
    // We transform them to lower case for easier usability.
    if (
      userByUsername.email.toLowerCase() !== email ||
      userByEmail.username.toLowerCase() !== username
    ) {
      next(new AppError('Incorrect username and/or email!', 401));
      return;
    }

    // Ensure that the cache is not filled yet.
    const attempts = await CacheService.getForgotPasswordAttempts(
      userByUsername.userID,
    );
    if (attempts && Number.parseInt(attempts, 10) === 2) {
      next(
        new AppError(
          'You have recently asked for a password reset twice. Please wait for two hours before retrying.',
          429,
        ),
      );
      return;
    }

    // Deny request if the user is not active.
    if (!userByUsername.isActive) {
      next(
        new AppError(
          'This account is disabled. Please contact the admin for reactivation.',
          403,
        ),
      );
      return;
    }

    // Generate a random reset token and a password reset URL. In development, set the URL
    // to port 3000 as well.
    const token = await randomBytes();
    const withPort = config.NODE_ENV === 'production' ? '' : ':3000';
    const url = `${req.protocol}://${req.hostname}${withPort}/reset-password?token=${token}&action=reset`;

    // Insert token to that user.
    await UserService.updateUser(
      { userID: userByUsername.userID },
      { forgotPasswordCode: token },
    );

    // Send to email.
    await new Email(
      userByUsername.email,
      userByUsername.fullName,
    ).sendForgotPassword(url);

    // Increment cache.
    await CacheService.setForgotPasswordAttempts(userByUsername.userID);

    // Send response.
    sendResponse({
      req,
      res,
      status: 'success',
      statusCode: 202,
      data: [],
      message: 'Reset password request has been sent to the email!',
      type: 'auth',
    });
  },

  /**
   * Logs in a user into the webservice.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   * @param next - Express.js's next function.
   */
  login: async (req: Request, res: Response, next: NextFunction) => {
    const { username, password } = req.body;

    // Find credentials. All are case-insensitive and ready to be used.
    // The arguments to the function are filled with `username`, it is assumed
    // that `username` can be the literal username, email, or even phone number with dashes. As
    // credentials are unique, it will fetch the correct user without fail if the credential exists.
    const user = await UserService.getUserByCredentials(
      username,
      username,
      username,
    );

    // At the same time, we also safe-compare passwords to prevent timing attacks.
    if (!user || !(await verifyPassword(user.password, password))) {
      next(new AppError('Invalid username and/or password!', 401));
      return;
    }

    // Ensure the user is not blocked.
    if (!user.isActive) {
      next(new AppError('User is not active. Please contact the admin.', 403));
      return;
    }

    // Clone object and delete sensitive data, prevent leaking confidential information. Do
    // not perform DB calls here - it is unnecessary overhead.
    const filteredUser = { ...user } as Partial<typeof user>;
    delete filteredUser.username;
    delete filteredUser.totpSecret;
    delete filteredUser.password;
    delete filteredUser.userPK;
    delete filteredUser.confirmationCode;
    delete filteredUser.forgotPasswordCode;

    // Device ID and IP address are fetched from the request object.
    const { device, ip } = getDeviceID(req);

    // Session data:
    const sessionData = {
      lastActive: new Date(),
      signedIn: new Date(),
      device,
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || '',
    };

    // Create session in the database. It generates a randomUUID for the sessionID.
    const session = await SessionService.createOrUpdateSession(
      { userPK: user.userPK, userID: user.userID },
      sessionData,
    );

    // Generate Session JWT Token.
    const age = /* 1 day in minutes */ 60 * 24;
    const token = await signHS256JWT(session.sessionID, user.userID, age);

    // Send response.
    sendResponse({
      req,
      res,
      status: 'success',
      statusCode: 200,
      data: { user: filteredUser, token },
      message: 'Logged in successfully!',
      type: 'auth',
    });
  },

  /**
   * Logs out a single user from the webservice. Removes all related cookies.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   * @param next - Express.js's next function.
   */
  logout: async (req: Request, res: Response) => {
    // Get the session ID.
    const { sessionPK } = req.session;

    // Delete the session from the database.
    await SessionService.deleteSession({ sessionPK });

    sendResponse({
      req,
      res,
      status: 'success',
      statusCode: 200,
      data: [],
      message: 'Logged out successfully!',
      type: 'auth',
    });
  },

  /**
   * Registers a user into the webservice. Exactly the same as 'createUser' in 'User' entity,
   * with same validations as in 'createUser'.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   * @param next - Express.js's next function.
   */
  register: async (req: Request, res: Response, next: NextFunction) => {
    const { username, email, phoneNumber, password, fullName } = req.body;

    // Validates whether the username or email or phone is already used or not. Use
    // parallel processing for speed.
    const [userByUsername, userByEmail, userByPhone] = await Promise.all([
      UserService.getUser({ username }),
      UserService.getUser({ email }),
      UserService.getUser({ phoneNumber }),
    ]);

    // Perform checks and validations.
    if (userByUsername || userByEmail || userByPhone) {
      next(
        new AppError(
          'Not possible to create a user with those credentials!',
          422,
        ),
      );
      return;
    }

    /**
     * Note: Email verification is currently disabled and commented
     * for convenience (this is not the core of the research).
     */
    const confirmationCode = await randomBytes();
    const user = await UserService.createUser({
      username,
      email,
      phoneNumber,
      password,
      totpSecret: '', // kept blank to ensure that this gets filled in the service layer
      confirmationCode,
      forgotPasswordCode: null,
      isActive: false,
      fullName,
    });

    // Send a link to the front-end, this will not change.
    // const withPort = config.NODE_ENV === 'production' ? '' : ':3000';
    // const link = `${req.protocol}://${req.hostname}${withPort}/verify-email?code=${confirmationCode}&email=${email}`;

    // Send an email consisting of the activation codes.
    // await new Email(email, username).sendConfirmation(link);

    // Send response.
    sendResponse({
      req,
      res,
      status: 'success',
      statusCode: 201,
      data: user,
      message:
        'Successfully registered! Please check your email address for verification.',
      type: 'auth',
    });
  },

  /**
   * Resets a user password. Should be the flow after 'forgotPassword' is called and the
   * user clicks on that link.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   * @param next - Express.js's next function.
   */
  resetPassword: async (req: Request, res: Response, next: NextFunction) => {
    const { newPassword, confirmPassword } = req.body;
    const { token } = req.params;

    // Validates whether the passwords are the same or not.
    if (!safeCompare(newPassword, confirmPassword)) {
      next(new AppError('Your passwords do not match!', 400));
      return;
    }

    // Validates whether the token is the same or not.
    const user = await UserService.getUser({ forgotPasswordCode: token });
    if (!user) {
      next(new AppError('There is no user associated with the token.', 404));
      return;
    }

    // If user is not active, deny request.
    if (!user.isActive) {
      next(
        new AppError(
          'This user is not active. Please contact the administrator for reactivation.',
          403,
        ),
      );
      return;
    }

    // If passwords are the same, we update them.
    await UserService.updateUser(
      { userID: user.userID },
      { password: newPassword, forgotPasswordCode: null },
    );

    // Destroy all sessions related to this user.
    await CacheService.deleteUserSessions(user.userID);

    // Send email to that user notifying that their password has been reset.
    await new Email(user.email, user.fullName).sendResetPassword();

    // Send response.
    sendResponse({
      req,
      res,
      status: 'success',
      statusCode: 200,
      data: [],
      message:
        'Password has been successfully reset. Please try logging in again!',
      type: 'auth',
    });
  },

  /**
   * SendOTP sends an OTP to a user with this algorithm:
   * - Get user data from session.
   * - If user has asked for OTP beforehand, do not allow until the related KVS is expired.
   * - Choose from query string: phone, email, or authenticator. Default is authenticator.
   * - Generate TOTP using RFC 6238 algorithm with user-specific properties.
   * - If using authenticators, tell user to verify TOTP as soon as possible.
   * - Send TOTP to that media if applicable.
   * - Set 'hasAskedOTP' in cache to true.
   * - Wait for user to provide TOTP in 'verify' part of the endpoint.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   * @param next - Express.js's next function.
   */
  sendOTP: async (req: Request, res: Response, next: NextFunction) => {
    const { userID } = req.session;

    if (!userID) {
      next(new AppError('No session detected. Please log in again.', 401));
      return;
    }

    // Check the availability of the user.
    const user = await UserService.getUserComplete({ userID });
    if (!user) {
      next(new AppError('User with this ID does not exist!', 404));
      return;
    }

    // If not yet expired, means that the user has asked in 'successive' order and it is a potential to spam.
    if (await CacheService.getHasAskedOTP(userID)) {
      next(
        new AppError(
          'You have recently asked for an OTP. Please wait 30 seconds before we process your request again.',
          429,
        ),
      );
      return;
    }

    // Guaranteed to be 'email', 'sms', or 'authenticator' due to the validation layer.
    const totp = generateDefaultTOTP(user.username, user.totpSecret);
    if (req.query.media === 'email') {
      await new Email(user.email, user.fullName).sendOTP(totp.token);
    }

    // TODO: send SMS
    if (req.query.media === 'sms') {
      next(
        new AppError(
          'Media is not yet implemented. Please use another media.',
          501,
        ),
      );
      return;
    }

    // If using authenticator, do nothing as its already there, increment redis instead.
    await CacheService.setHasAskedOTP(userID);

    // Send back response.
    sendResponse({
      req,
      res,
      status: 'success',
      statusCode: 202,
      data: [],
      message:
        'OTP processed. Please check your chosen media and verify the OTP there.',
      type: 'auth',
    });
  },

  /**
   * Updates the MFA secret of the currently logged in user.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   * @param next - Express.js's next function.
   */
  updateMFA: async (req: Request, res: Response, next: NextFunction) => {
    const { userID } = req.session;

    if (!userID) {
      next(new AppError('No session detected. Please log in again.', 401));
      return;
    }

    // Fetch current user.
    const user = await UserService.getUserComplete({ userID });
    if (!user) {
      next(new AppError('There is no user with that ID.', 404));
      return;
    }

    // Regenerate new MFA secret.
    const newSecret = nanoid();
    const totp = generateDefaultTOTP(user.username, newSecret);
    await UserService.updateUser({ userID }, { totpSecret: newSecret });

    // Send response.
    sendResponse({
      req,
      res,
      status: 'success',
      statusCode: 200,
      data: {
        uri: totp.uri,
      },
      message: 'Successfully updated MFA secrets.',
      type: 'auth',
    });
  },

  /**
   * Updates a password for the currently logged in user.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   * @param next - Express.js's next function.
   */
  updatePassword: async (req: Request, res: Response, next: NextFunction) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const { userID } = req.session;

    if (!userID) {
      next(new AppError('No session detected. Please log in again.', 401));
      return;
    }

    // Fetch old data.
    const user = await UserService.getUserComplete({ userID });
    if (!user) {
      next(new AppError('There is no user with that ID.', 404));
      return;
    }

    // Compare old passwords.
    const passwordsMatch = await verifyPassword(user.password, currentPassword);
    if (!passwordsMatch) {
      next(new AppError('Your previous password is wrong!', 401));
      return;
    }

    // Confirm passwords. We time-safe compare to prevent timing attacks.
    if (!safeCompare(newPassword, confirmPassword)) {
      next(new AppError('Your new passwords do not match.', 401));
      return;
    }

    // Update new password.
    await UserService.updateUser({ userID }, { password: newPassword });

    // Send a confirmation email that the user has successfully changed their password.
    // await new Email(user.email, user.fullName).sendUpdatePassword();

    // Delete all of the sessions. We use 'user.userID' as 'req.session.userID'
    // is not accessible anymore (already deleted in this callback).
    await SessionService.deleteSession({ userPK: user.userPK });

    // Send back response.
    sendResponse({
      req,
      res,
      status: 'success',
      statusCode: 200,
      data: [],
      message: 'Password updated. For security, please log in again!',
      type: 'auth',
    });
  },

  /**
   * Verifies a user's email.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   * @param next - Express.js's next function.
   */
  verifyEmail: async (req: Request, res: Response, next: NextFunction) => {
    const { code, email } = req.params;

    // Validate the code. We will obfuscate all error messages for obscurity.
    const user = await UserService.getUserComplete({ email });
    if (!user) {
      next(new AppError('Invalid email verification code!', 400));
      return;
    }

    if (!user.confirmationCode) {
      next(new AppError('Invalid email verification code!', 400));
      return;
    }

    if (code !== user.confirmationCode) {
      next(new AppError('Invalid email verification code!', 400));
      return;
    }

    // Set 'isActive' to true and set code to not defined.
    const updatedUser = await UserService.updateUser(
      { userID: user.userID },
      { isActive: true, email, confirmationCode: null },
    );

    // Send response.
    sendResponse({
      req,
      res,
      status: 'success',
      statusCode: 200,
      data: updatedUser,
      message: 'Email verified! You may now use and log in to the webservice!',
      type: 'auth',
    });
  },

  /**
   * VerifyOTP verifies if a TOTP is valid or not valid. The algorithm:
   * - Parse 'Basic' authentication. Also check if the user is blocked or not (failed to input correct TOTP many times in successive order).
   * - If the user is blocked, send email / notification to the user.
   * - Get user data from 'username' column of the authentication string.
   * - Pull the user's secret key from the database.
   * - Validate the user's TOTP. The input OTP will be fetched from the 'password' column of the authentication string.
   * - If the TOTP is valid, give back JWS token. This is the user's second session. If not valid, increment the 'TOTPAttempts' in cache.
   * - Take note of the JTI, store it inside Redis cache for statefulness.
   * - Send back response.
   *
   * Token gained from this function will act as a signed cookie that can be used to authenticate oneself.
   * Username is the user's ID. The password is the user's TOTP token.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   * @param next - Express.js's next function.
   */
  verifyOTP: async (req: Request, res: Response, next: NextFunction) => {
    // Validate header.
    if (!req.headers.authorization) {
      invalidBasicAuth('Missing authorization in request!', 401, res, next);
      return;
    }

    // Check whether authentication scheme is correct.
    const { username, password } = parseBasicAuth(req.headers.authorization);
    if (!username || !password) {
      invalidBasicAuth('Invalid authentication scheme!', 401, res, next);
      return;
    }

    // Check whether username exists.
    const user = await UserService.getUserComplete({ userID: username });
    if (!user) {
      invalidBasicAuth('User with that ID is not found.', 404, res, next);
      return;
    }

    // If user has reached 3 times, then block the user's attempt.
    // TODO: should send email/sms/push notification to the relevant user
    const attempts = await CacheService.getOTPAttempts(user.userID);
    if (attempts && Number.parseInt(attempts, 10) === 3) {
      // If user is not 'email-locked', send security alert to prevent spam.
      if (!(await CacheService.getSecurityAlertEmailLock(user.userID))) {
        await CacheService.setSecurityAlertEmailLock(user.userID);
        await new Email(user.email, user.fullName).sendNotification();
      }

      invalidBasicAuth(
        'You have exceeded the number of times allowed for a secured session. Please try again in the next day.',
        429,
        res,
        next,
      );
      return;
    }

    // Ensures that OTP has never been used before.
    const usedOTP = await CacheService.getBlacklistedOTP(user.userID, password);
    if (usedOTP) {
      await CacheService.setOTPAttempts(user.userID);
      invalidBasicAuth(
        'This OTP has expired. Please request it again in 30 seconds!',
        410,
        res,
        next,
      );
      return;
    }

    // Validate OTP.
    const validTOTP = validateDefaultTOTP(password, user.totpSecret);
    if (!validTOTP) {
      await CacheService.setOTPAttempts(user.userID);
      invalidBasicAuth(
        'Invalid authentication, wrong OTP code.',
        401,
        res,
        next,
      );
      return;
    }

    // Make sure to blacklist the TOTP (according to the specs).
    await CacheService.blacklistOTP(user.userID, password);

    // Generate JWS as the authorization ticket.
    const jti = nanoid();
    const token = await signEdDSAJWT(jti, user.userID, 15);

    // Set OTP session by its JTI.
    await CacheService.setOTPSession(jti, user.userID);

    // Send response.
    sendResponse({
      req,
      res,
      status: 'success',
      statusCode: 200,
      data: {
        token,
      },
      message: 'OTP verified. Special session has been given to the user.',
      type: 'auth',
    });
  },
};

export default AuthController;
