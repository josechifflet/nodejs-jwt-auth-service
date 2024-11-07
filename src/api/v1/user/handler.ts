import { Router } from 'express';

import AttendanceHandler from '@/api/v1/attendance/handler';
import bodyParser from '@/modules/middleware/body-parser';
import getMe from '@/modules/middleware/get-me';
import hasJWT from '@/modules/middleware/has-jwt';
import hasRole from '@/modules/middleware/has-role';
import hasSession from '@/modules/middleware/has-session';
import rateLimit from '@/modules/middleware/rate-limit';
import asyncHandler from '@/util/async-handler';
import validate from '@/util/validate';

import UserController from './controller';
import UserValidation from './validation';

/**
 * Handler to take care of 'Users' entity.
 *
 * @returns Express router.
 */
const UserHandler = () => {
  const handler = Router();
  const userRateLimit = rateLimit(100, 'users-me', 15);
  const adminRateLimit = rateLimit(30, 'users-admin');

  // Route to 'Attendance' entity based on the current user for better REST-ful experience.
  handler.use('/:id/attendances', AttendanceHandler());

  // Below endpoints are allowed for only authenticated users.
  handler.use(asyncHandler(hasSession));

  // Allow user to get their own data and update their own data as well.
  handler
    .use(userRateLimit)
    .route('/me')
    .get(getMe, asyncHandler(UserController.getUser))
    .patch(
      getMe,
      bodyParser,
      validate(UserValidation.updateMe),
      asyncHandler(UserController.updateUser),
    )
    .delete(getMe, asyncHandler(UserController.deactivateUser));

  // Restrict endpoints for admins who are logged in and authenticated with MFA.
  handler.use(
    adminRateLimit,
    asyncHandler(hasRole('admin')),
    asyncHandler(hasJWT('otp-authorization')),
  );

  // Perform get and create operations on the general entity.
  handler
    .route('/')
    .get(asyncHandler(UserController.getUsers))
    .post(
      bodyParser,
      validate(UserValidation.createUser),
      asyncHandler(UserController.createUser),
    );

  // Perform get, update, and delete operations on a specific entity.
  handler
    .route('/:id')
    .get(validate(UserValidation.getUser), asyncHandler(UserController.getUser))
    .patch(
      bodyParser,
      validate(UserValidation.updateUser),
      asyncHandler(UserController.updateUser),
    )
    .delete(
      validate(UserValidation.deleteUser),
      asyncHandler(UserController.deleteUser),
    );

  return handler;
};

export default UserHandler;
