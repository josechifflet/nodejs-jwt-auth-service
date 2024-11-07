import { z } from 'zod';

/**
 * Special user validations to sanitize and analyze request bodies and parameters.
 */
const UserValidation = {
  // POST /api/v1/users
  createUser: z.object({
    body: z.object({
      username: z.string().trim().max(25),
      email: z.string().trim().email().toLowerCase().max(50),
      phoneNumber: z
        .string()
        .trim()
        .max(20)
        .regex(/^[-+0-9]+$/, { message: 'Invalid phone number format' }),
      password: z.string().min(8).max(64),
      fullName: z.string().trim().max(30),
      role: z.enum(['admin', 'user']).default('user'),
    }),
  }),

  // DELETE /api/v1/users/:id
  deleteUser: z.object({
    params: z.object({
      id: z.string().uuid(),
    }),
  }),

  // GET /api/v1/users/:id
  getUser: z.object({
    params: z.object({
      id: z.string().uuid(),
    }),
  }),

  // PATCH /api/v1/users/me
  updateMe: z.object({
    body: z.object({
      email: z.string().trim().toLowerCase().email().max(50).optional(),
      phoneNumber: z
        .string()
        .trim()
        .max(20)
        .regex(/^[-+0-9]+$/, { message: 'Invalid phone number format' })
        .optional(),
      fullName: z.string().trim().max(30).optional(),
    }),
  }),

  // PATCH /api/v1/users/:id
  updateUser: z.object({
    body: z.object({
      username: z.string().trim().max(25).optional(),
      email: z.string().trim().toLowerCase().email().max(50).optional(),
      phoneNumber: z
        .string()
        .trim()
        .max(20)
        .regex(/^[-+0-9]+$/, { message: 'Invalid phone number format' })
        .optional(),
      password: z.string().min(8).max(64).optional(),
      fullName: z.string().trim().max(30).optional(),
      role: z.enum(['admin', 'user']).optional(),
      isActive: z.boolean().optional(),
    }),
    params: z.object({
      id: z.string().uuid(),
    }),
  }),
};

export default UserValidation;
