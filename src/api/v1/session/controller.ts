import type { NextFunction, Request, Response } from 'express';

import CacheService from '@/modules/cache/service';
import AppError from '@/util/app-error';
import sendResponse from '@/util/send-response';

import SessionService from './service';

/**
 * Handle all requests from 'SessionHandler'.
 */
const SessionController = {
  /**
   * Deletes a single session specific for a single user. A user has to 'own' this session
   * before they can proceed with the deletion.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   * @param next - Express.js's next function.
   */
  deleteMySession: async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { userID, sessionPK } = req.session;

    if (!userID) {
      next(new AppError('No session detected. Please log in again.', 401));
      return;
    }

    // Validates whether the session belongs to the user or not.
    const currentSessions = await CacheService.getUserSessions(userID);
    const mySess = currentSessions.some((sess) => sess.sid === id);
    if (!mySess) {
      next(new AppError('You do not have a session with that ID.', 404));
      return;
    }

    // If the session in question is the current session, delete it by destroying it.
    await SessionService.deleteSession({ sessionPK });

    res.status(204).send();
  },

  /**
   * Deletes a single session without any validations whatsoever. Intentionally
   * made like this to prevent bad UX (sessions are highly flexible and we can accidentally
   * delete an invalid session).
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   * @param next - Express.js's next function.
   */
  deleteSession: async (req: Request, res: Response) => {
    // Arbitrary session ID to delete.
    const { id } = req.params;

    await SessionService.deleteSession({ sessionID: id });

    res.status(204).send();
  },

  /**
   * Gets all sessions in the cache.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   */
  getAllSessions: async (req: Request, res: Response) => {
    const sessions = await CacheService.getSessions();

    sendResponse({
      req,
      res,
      status: 'success',
      statusCode: 200,
      data: sessions,
      message: 'Successfully fetched all sessions!',
      type: 'sessions',
    });
  },

  /**
   * Gets all sessions related to a single user.
   *
   * @param req - Express.js's request object.
   * @param res - Express.js's response object.
   */
  getUserSessions: async (req: Request, res: Response) => {
    const { id } = req.params;

    const sessions = await CacheService.getUserSessions(id);

    sendResponse({
      req,
      res,
      status: 'success',
      statusCode: 200,
      data: sessions,
      message: 'Successfully fetched all sessions of this user!',
      type: 'sessions',
    });
  },
};

export default SessionController;
