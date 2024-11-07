import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import type { NextFunction, Request, Response } from 'express';
import { errors as jose } from 'jose';
import { ZodError } from 'zod';

import config from '@/config';
import AppError from '@/util/app-error';
import sendError from '@/util/send-error';

/**
 * Formats a Zod error into a readable string.
 *
 * @param error - ZodError object.
 * @returns A formatted string of the error.
 */
const formatZodError = (error: ZodError): string => {
  const { issues } = error;
  if (issues.length) {
    const { path, message } = issues[0];
    const pathString = path.join('.');
    return `${pathString}: ${message}`;
  }
  return 'Unknown zod validation error';
};

/**
 * Sends an API error response to the requesting client. In development
 * phase, the API will send back `stack` property in the response.
 *
 * @param req - Express.js's request object.
 * @param res - Express.js's response object.
 * @param err - Error object in the form of `AppError`.
 */
const sendErrorResponse = (req: Request, res: Response, err: AppError) => {
  if (config.NODE_ENV === 'development') {
    sendError({ req, res, error: err, stack: err.stack });
    return;
  }

  sendError({ req, res, error: err });
};

/**
 * Handles errors for expected errors. Transforms most error objects into a readable format
 * which is `AppError`.
 *
 * @param err - The 'true' error which was thrown, casted to `any` as errors can take up many forms.
 * @returns A new error object that conforms to 'AppError'.
 */
const handleOperationalErrors = (err: Error) => {
  // Handle body parser errors.
  if (err instanceof SyntaxError) {
    return new AppError('Invalid JSON! Please insert a valid one.', 400);
  }

  // @ts-expect-error: Some errors may have this `type` property!
  if (err.type === 'entity.too.large') {
    return new AppError('Request too large! Please reduce your payload!', 413);
  }

  // Handle Prisma errors.
  if (
    err instanceof PrismaClientKnownRequestError ||
    err instanceof PrismaClientUnknownRequestError ||
    err instanceof PrismaClientInitializationError ||
    err instanceof PrismaClientValidationError
  ) {
    return new AppError(
      'Your request violates the constraints of the database. Please insert another data!',
      400,
    );
  }

  // Handle validation errors.
  if (err instanceof ZodError) {
    return new AppError(formatZodError(err), 400);
  }

  // Handle JWT errors.
  if (err instanceof jose.JWTClaimValidationFailed) {
    return new AppError('Failed to verify the integrity of the token.', 401);
  }

  if (err instanceof jose.JWSInvalid) {
    return new AppError('Failed to verify the integrity of the token.', 401);
  }

  if (err instanceof jose.JWSSignatureVerificationFailed) {
    return new AppError('Failed to verify the integrity of the token.', 401);
  }

  if (err instanceof jose.JWTExpired) {
    return new AppError('Failed to verify the integrity of the token.', 401);
  }

  // "express-jwt" error.
  if (err.name === 'UnauthorizedError') {
    return new AppError('Failed to verify the integrity of the token.', 401);
  }

  // If anything is not caught, then it is most likely an unknown error. We will
  // print the error to standard output and send back a generic `500` error.
  console.error(err);
  return new AppError('Internal server error!', 500);
};

/**
 * Custom error handling middleware for Express.js.
 *
 * @param err - Error object.
 * @param req - Express.js's request object.
 * @param res - Express.js's response object.
 * @param next - Express.js's next function.
 */
const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Catch expected errors.
  if (err instanceof AppError) {
    sendErrorResponse(req, res, err);
    return;
  }

  // Fallback to this error if error is not an `AppError`. We will try
  // to check if it is an operational error or not.
  if (err instanceof Error) {
    sendErrorResponse(req, res, handleOperationalErrors(err));
    return;
  }

  // Otherwise, it is unexpected and should be handled properly in both environments by
  // transforming them into an instance of `AppError` and printing the stack trace properly.
  const error = new AppError('Unknown error! Please try again later!', 500);

  // Print both errors to standard output. This is considered a critical failure.
  console.error(err);
  console.error(error);

  // Send stack in development, do not send stack in production.
  sendErrorResponse(req, res, error);

  // Go next.
  next();
};

export default errorHandler;
