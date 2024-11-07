import { Router } from 'express';

import getMe from '@/modules/middleware/get-me';
import hasRole from '@/modules/middleware/has-role';
import hasSession from '@/modules/middleware/has-session';
import rateLimit from '@/modules/middleware/rate-limit';
import asyncHandler from '@/util/async-handler';
import validate from '@/util/validate';

import SessionController from './controller';
import SessionValidation from './validation';

/**
 * Handle all session-related endpoints.
 *
 * @returns Express router.
 */
const SessionHandler = () => {
  const handler = Router();

  // Allow rate limiters.
  handler.use(rateLimit(100, 'sessions'));

  // Only allow below handlers for authenticated users.
  // Below endpoints are allowed for only authenticated users.
  handler.use(asyncHandler(hasSession));

  // Check personal sessions.
  handler
    .route('/me')
    .get(getMe, asyncHandler(SessionController.getUserSessions));

  // Allow self session invalidation.
  handler
    .route('/me/:id')
    .delete(
      validate(SessionValidation.deleteUserSession),
      asyncHandler(SessionController.deleteMySession),
    );

  // Only allow administrators.
  handler.use(asyncHandler(hasRole('admin')));

  // Only allow session checking and session invalidation (admins).
  handler.route('/').get(asyncHandler(SessionController.getAllSessions));

  // Allow session invalidation.
  handler
    .route('/:id')
    .delete(
      validate(SessionValidation.deleteSession),
      asyncHandler(SessionController.deleteSession),
    );

  return handler;
};

export default SessionHandler;
