import type { NextFunction, Request, Response } from 'express';

import SessionService from '@/api/v1/session/service';
import UserService from '@/api/v1/user/service';
import AppError from '@/util/app-error';
import getDeviceID from '@/util/device-id';

import CacheService from '../cache/service';
import verifySessionJwt from './verify-session-jwt';

/**
 * Validates whether a request has a valid session or not.
 * This middleware is used to validate the session of the user. Must be used after `verifySessionJwt`.
 * The `req.auth` property must contain the JWT Payload, from which the sessionID will be extracted and
 * used to get the userID from the Redis cache.
 *
 * @param req - Express.js's request object.
 * @param res - Express.js's response object.
 * @param next - Express.js's next function.
 */
const hasSession = async (req: Request, res: Response, next: NextFunction) => {
  // First, run the `verifySessionJwt` middleware
  verifySessionJwt(req, res, async (err) => {
    if (err) return next(err); // Pass any errors from `verifySessionJwt` to the next error handler

    // Get the sessionID from the Payload of the JWT.
    // The sessionID corresponds to the sessionID.
    const sessionID = req.auth?.jti;
    if (!sessionID) {
      next(new AppError('Failed to verify the integrity of the token.', 401));
      return;
    }

    // Get the userID from the sessionID.
    const userID = await CacheService.getUserIDFromSession(sessionID);

    // Validates whether the session exists or not.
    if (!userID) {
      next(new AppError('Failed to verify the integrity of the token.', 401));
      return;
    }

    // Check if the sessionID from the JWT corresponds to the sessionID in the database.
    // This is to prevent multiple sessions from the same user.
    const session = await SessionService.getSession({ sessionID });
    if (!session) {
      // Delete the session from the Redis cache if it is not found in the database.
      await CacheService.deleteSession(sessionID);

      next(new AppError('Failed to verify the integrity of the token.', 401));
      return;
    }

    // Check in an unlikely scenario: a user has already deleted his account but their session is still active.
    const user = await UserService.getUserComplete({ userID });
    if (!user) {
      next(new AppError('User belonging to this session does not exist.', 400));
      return;
    }

    // Verifies if the user is not banned (isActive is true).
    if (!user.isActive) {
      next(new AppError('User is not active. Please contact the admin.', 403));
      return;
    }

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

    // Refreshes the session data in the database.
    await SessionService.updateSession({ sessionID }, sessionData);

    req.session = {
      userPK: user.userPK,
      userID,
      tokenID: sessionID,
      sessionPK: session.sessionPK,
      sessionID,
      lastActive: sessionData.lastActive.toISOString(),
      signedIn: sessionData.signedIn.toISOString(),
      sessionInfo: {
        device: sessionData.device,
        ip: sessionData.ipAddress,
      },
    };

    // Go to the next middleware.
    next();
  });
};

export default hasSession;
