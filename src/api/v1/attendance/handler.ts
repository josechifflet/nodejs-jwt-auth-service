import { Router } from 'express';

import bodyParser from '@/modules/middleware/body-parser';
import hasJWT from '@/modules/middleware/has-jwt';
import hasRole from '@/modules/middleware/has-role';
import hasSession from '@/modules/middleware/has-session';
import rateLimit from '@/modules/middleware/rate-limit';
import asyncHandler from '@/util/async-handler';
import validate from '@/util/validate';

import AttendanceController from './controller';
import AttendanceValidation from './validation';

/**
 * Handler to take care of 'Attendance' entity.
 *
 * @returns Express router.
 */
const AttendanceHandler = () => {
  const handler = Router({ mergeParams: true });
  const userAttendanceRateLimit = rateLimit(100, 'attendance-me');
  const attendanceRateLimit = rateLimit(15, 'attendance-check');

  // Endpoints are only for authenticated users,
  handler.use(asyncHandler(hasSession));

  // Check out current day status. Almost never blocked by rate limiter.
  handler.get('/status', asyncHandler(AttendanceController.getStatus));

  // Check in for today. Protect with rate limiter.
  handler.post(
    '/in',
    attendanceRateLimit,
    asyncHandler(hasJWT('otp-authorization')),
    bodyParser,
    validate(AttendanceValidation.in),
    asyncHandler(AttendanceController.in),
  );

  // Check out for today. Protect with rate limiter.
  handler.patch(
    '/out',
    attendanceRateLimit,
    asyncHandler(hasJWT('otp-authorization')),
    bodyParser,
    validate(AttendanceValidation.out),
    asyncHandler(AttendanceController.out),
  );

  // Get personal attendance data.
  handler.get(
    '/me',
    userAttendanceRateLimit,
    asyncHandler(AttendanceController.getMyAttendances),
  );

  // Gets all attendances data.
  handler.get(
    '/',
    asyncHandler(hasRole('admin')),
    validate(AttendanceValidation.getAttendances),
    asyncHandler(AttendanceController.getAttendances),
  );

  return handler;
};

export default AttendanceHandler;
