import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import prisma from '@/infra/prisma';
import CacheService from '@/modules/cache/service';

/**
 * Most session operations return these attributes, which are usually shown to the user,
 * keeping sensitive values restricted.
 */
const select = Prisma.validator<Prisma.SessionSelect>()({
  sessionPK: true,
  sessionID: true,
  userPK: true,
  lastActive: true,
  signedIn: true,
  device: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * Business logic and repositories for the 'Session' entity.
 */
const SessionService = {
  /**
   * Fetches all sessions from the database.
   *
   * @returns All sessions with specified attributes, omitting sensitive data.
   */
  getSessions: async () => prisma.session.findMany({ select }),

  /**
   * Fetches a single session by its unique identifier.
   *
   * @param where - Prisma's 'Where' object that accepts unique attributes only.
   * @returns A single session's data (all specified attributes).
   */
  getSessionComplete: async (where: Prisma.SessionWhereUniqueInput) =>
    prisma.session.findUnique({ where }),

  /**
   * Fetches a single session with restricted attributes for security purposes.
   *
   * @param where - Prisma's 'Where' object that accepts unique attributes only.
   * @returns A single session's data, with sensitive data removed.
   */
  getSession: async (where: Prisma.SessionWhereUniqueInput) =>
    prisma.session.findUnique({ where, select }),

  /**
   * Fetches a session by user identifier and device information.
   *
   * @param userPK - Primary key of the user.
   * @param device - Device information associated with the session.
   * @param ipAddress - IP address associated with the session.
   * @returns A single session's data if it exists.
   */
  getSessionByDeviceAndIP: async (
    userPK: number,
    device: string,
    ipAddress: string,
  ) =>
    prisma.session.findFirst({
      where: { userPK, device, ipAddress },
      select,
    }),

  /**
   * Creates or updates a session in the database. It generates a randomUUID for the sessionID if creating a new session.
   *
   * @param user - The user object containing userPK.
   * @param sessionData - Additional session data (e.g., device, ipAddress).
   * @returns The created or updated session object, with specified attributes.
   */
  createOrUpdateSession: async (
    user: Prisma.UserGetPayload<{ select: { userPK: true; userID: true } }>,
    sessionData: Omit<Prisma.SessionCreateInput, 'user'>,
  ) => {
    const session = await prisma.session.upsert({
      where: { userPK: user.userPK },
      update: { sessionID: randomUUID(), ...sessionData },
      create: { userPK: user.userPK, ...sessionData },
      select,
    });

    // Set the session in the cache.
    await CacheService.setSession(session.sessionID, user.userID);

    return session;
  },

  /**
   * Updates a session's data, such as the last active timestamp.
   *
   * @param where - Prisma's 'Where' object. Accepts unique attributes only.
   * @param data - A partial object to update the session.
   * @returns An updated 'Session' object, with specified attributes.
   */
  updateSession: async (
    where: Prisma.SessionWhereUniqueInput,
    data: Prisma.SessionUpdateInput,
  ) => {
    return prisma.session.update({ where, data, select });
  },

  /**
   * Deletes a session by its unique identifier.
   *
   * @param where - Prisma's 'where' object to determine which session to delete.
   * @returns The deleted 'Session' object.
   */
  deleteSession: async (where: Prisma.SessionWhereUniqueInput) => {
    // Delete the session from the database.
    const sessionDeleted = await prisma.session.delete({ where });

    // Delete the session from the Redis cache if it exists.
    if (sessionDeleted)
      await CacheService.deleteSession(sessionDeleted.sessionID);
  },
};

export default SessionService;
