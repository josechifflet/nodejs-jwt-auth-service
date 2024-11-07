import type { NextFunction, Request, Response } from 'express';
import { expressjwt } from 'express-jwt';

import config from '@/config';
import AppError from '@/util/app-error';

/**
 * Middleware to verify JWTs.
 *
 * @returns express middleware to verify JWTs.
 */
const verifySessionJwt = (req: Request, res: Response, next: NextFunction) =>
  expressjwt({
    algorithms: ['HS256'],
    secret: config.JWT_SECRET,
    audience: config.JWT_AUDIENCE,
    issuer: config.JWT_ISSUER,
    complete: true,

    // Will be catched by the global error handler.
    onExpired: async (_req: Request, _err: unknown) => {
      throw new AppError(
        'You are not logged in yet! Please log in first!',
        401,
      );
    },
    // The JWT is stored in the request object under the 'auth' property.
    // So, req.auth contains the JWT Payload.
    requestProperty: 'auth',
  }).unless({
    // No unprotected paths since the middleware is meant to be used for protected routes, in
    // which case, the JWT is required.
    path: [],
  })(req, res, next);

export default verifySessionJwt;
