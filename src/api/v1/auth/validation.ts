import { z } from 'zod';

/**
 * Special auth validations to sanitize and analyze request bodies and parameters.
 */
const AuthValidation = {
  // POST /api/v1/auth/forgot-password
  forgotPassword: z.object({
    body: z.object({
      email: z.string().trim().email().toLowerCase(),
      username: z.string().toLowerCase().trim(),
    }),
  }),

  // POST /api/v1/auth/login
  login: z.object({
    body: z.object({
      username: z.string().trim(),
      password: z.string(),
    }),
  }),

  // POST /api/v1/auth/register
  register: z.object({
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
    }),
  }),

  // PATCH /api/v1/auth/reset-password/:token
  resetPassword: z.object({
    params: z.object({
      token: z.string(),
    }),
    body: z.object({
      newPassword: z.string().min(8).max(64),
      confirmPassword: z.string().min(8).max(64),
    }),
  }),

  // POST /api/v1/auth/otp?media=...
  sendOTP: z.object({
    query: z.object({
      media: z.enum(['email', 'sms', 'authenticator']),
    }),
  }),

  // PATCH /api/v1/auth/update-password
  updatePassword: z.object({
    body: z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8).max(64),
      confirmPassword: z.string().min(8).max(64),
    }),
  }),

  // PATCH /api/v1/auth/verify-email
  verifyEmail: z.object({
    params: z.object({
      code: z.string(),
      email: z.string().trim().email().toLowerCase(),
    }),
  }),
};

export default AuthValidation;
