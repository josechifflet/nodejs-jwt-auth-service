import { Router } from 'express';

import bodyParser from '@/modules/middleware/body-parser';
import hasJWT from '@/modules/middleware/has-jwt';
import hasSession from '@/modules/middleware/has-session';
import rateLimit from '@/modules/middleware/rate-limit';
import asyncHandler from '@/util/async-handler';
import validate from '@/util/validate';

import AuthController from './controller';
import AuthValidation from './validation';

/**
 * Handler to take care of 'Authentication' entity. All handlers are specific
 * routes, there are no general routes ('/' or '/:id').
 *
 * @returns Express router.
 */
const AuthHandler = () => {
  const handler = Router();
  const authRateLimit = rateLimit(15, 'auth');

  // General endpoint, (almost) no rate limit.
  handler.get('/status', AuthController.getStatus);

  // Logs in a single user.
  handler.post(
    '/login',
    rateLimit(10, 'auth-login'),
    bodyParser,
    validate(AuthValidation.login),
    asyncHandler(AuthController.login),
  );

  // Logs out a single user.
  handler.post('/logout', asyncHandler(hasSession), AuthController.logout);

  // Allow user to forgot their own password.
  handler.post(
    '/forgot-password',
    authRateLimit,
    bodyParser,
    validate(AuthValidation.forgotPassword),
    asyncHandler(AuthController.forgotPassword),
  );

  // Sends and verifies OTP.
  handler
    .route('/otp')
    .post(
      authRateLimit,
      asyncHandler(hasSession),
      validate(AuthValidation.sendOTP),
      asyncHandler(AuthController.sendOTP),
    )
    .put(
      authRateLimit,
      asyncHandler(hasSession),
      asyncHandler(AuthController.verifyOTP),
    );

  // Registers a single user.
  handler.post(
    '/register',
    rateLimit(5, 'auth-register', 30),
    bodyParser,
    validate(AuthValidation.register),
    asyncHandler(AuthController.register),
  );

  // Allows a user to reset their own password.
  handler.patch(
    '/reset-password/:token',
    authRateLimit,
    bodyParser,
    validate(AuthValidation.resetPassword),
    asyncHandler(AuthController.resetPassword),
  );

  // Updates MFA for the currently logged in user.
  handler.patch(
    '/update-mfa',
    authRateLimit,
    asyncHandler(hasSession),
    asyncHandler(hasJWT('otp-authorization')),
    asyncHandler(AuthController.updateMFA),
  );

  // Change password for a logged in user.
  handler.patch(
    '/update-password',
    // rateLimit(2, 'auth-password-update'),
    asyncHandler(hasSession),
    bodyParser,
    validate(AuthValidation.updatePassword),
    asyncHandler(AuthController.updatePassword),
  );

  // Verifies an email.
  handler.patch(
    '/verify-email/:code/:email',
    authRateLimit,
    validate(AuthValidation.verifyEmail),
    asyncHandler(AuthController.verifyEmail),
  );

  return handler;
};

export default AuthHandler;
