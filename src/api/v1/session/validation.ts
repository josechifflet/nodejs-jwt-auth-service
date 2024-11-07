import { z } from 'zod';

/**
 * Special session validations to sanitize and analyze request bodies and parameters.
 */
const SessionValidation = {
  // DELETE /api/v1/sessions/me/:id
  deleteUserSession: z.object({
    params: z.object({
      id: z.string(),
    }),
  }),

  // DELETE /api/v1/sessions/:id
  deleteSession: z.object({
    params: z.object({
      id: z.string(),
    }),
  }),
};

export default SessionValidation;
