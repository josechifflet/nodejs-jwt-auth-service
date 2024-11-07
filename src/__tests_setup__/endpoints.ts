import { z } from 'zod';

const base = z.object({
  status: z.string(),
  message: z.string(),
  type: z.string(),
});

const baseUser = z.object({
  userID: z.string(),
  email: z.string(),
  phoneNumber: z.string(),
  fullName: z.string(),
  role: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// POST /api/v1/auth/login
export const apiV1AuthLoginResponseValidator = base.extend({
  data: z.object({
    // User data
    user: baseUser,

    // Session JWT token
    token: z.string(),
  }),
});

// POST /api/v1/auth/logout
export const apiV1AuthLogoutResponseValidator = base.extend({
  data: z.array(z.string()),
});

// POST /api/v1/auth/forgot-password

// POST /api/v1/auth/otp

// POST /api/v1/auth/register
export const apiV1AuthRegisterResponseValidator = base.extend({
  data: baseUser.extend({ uri: z.string() }),
});

// PATCH /api/v1/auth/verify-email
export const apiV1AuthVerifyEmailResponseValidator = base.extend({
  data: baseUser,
});

// PATCH /api/v1/auth/update-password
export const apiV1AuthUpdatePasswordResponseValidator = base.extend({
  data: z.array(z.string()),
});
