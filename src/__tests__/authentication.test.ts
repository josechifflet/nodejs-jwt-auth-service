import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import app from '@/app';
import prisma from '@/infra/prisma';

import {
  apiV1AuthLoginResponseValidator,
  apiV1AuthLogoutResponseValidator,
  apiV1AuthRegisterResponseValidator,
  apiV1AuthUpdatePasswordResponseValidator,
  apiV1AuthVerifyEmailResponseValidator,
} from '../__tests_setup__/endpoints';
import flushDb from '../__tests_setup__/flushDb';
import flushRedis from '../__tests_setup__/flushRedis';

/**
 * Authentication flow endpoints tests.
 *
 * Order of execution matters:
 * 1. Register a new user.
 * 2. Verify the user email.
 * 3. Login with the new user credentials.
 * 4. Update the user password.
 * 5. Logout the user.
 */
describe('[Authentication]', () => {
  beforeAll(async () => {
    await flushDb();
    await flushRedis();
    vi.clearAllMocks();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const testApp = app;
  let registeredUserID: string;

  let loggedInUserToken: string;

  describe('POST /api/v1/auth/register', () => {
    it('should create a new user with valid data', async () => {
      const { status, body } = await request(testApp)
        .post('/api/v1/auth/register')
        .set('x-requested-with', 'authaas')
        .set('accept', 'application/json')
        .set('accept', 'application/vnd.auth.v1+json')
        .send({
          username: 'NewUser',
          email: 'newuser@example.com',
          phoneNumber: '+1234567890',
          password: 'SecurePassword1!',
          fullName: 'New User',
        });

      expect(status).toBe(201);
      const validation = apiV1AuthRegisterResponseValidator.safeParse(body);
      expect(validation.success).toBe(true);
      if (validation.data) registeredUserID = validation.data.data.userID;
      expect(registeredUserID).toBeDefined();
    });

    it('should fail to create a new user with invalid credentials (existing user)', async () => {
      const { status, body } = await request(testApp)
        .post('/api/v1/auth/register')
        .set('x-requested-with', 'authaas')
        .set('accept', 'application/json')
        .set('accept', 'application/vnd.auth.v1+json')
        .send({
          username: 'NewUser',
          email: 'newuser@example.com',
          phoneNumber: '+1234567890',
          password: 'SecurePassword1!',
          fullName: 'New User',
        });

      expect(status).toBe(422);
      expect(body).toHaveProperty(
        'message',
        'Not possible to create a user with those credentials!',
      );
    });

    it('should fail to create a new user with invalid credentials (existing user)', async () => {
      const { status, body } = await request(testApp)
        .post('/api/v1/auth/register')
        .set('x-requested-with', 'authaas')
        .set('accept', 'application/json')
        .set('accept', 'application/vnd.auth.v1+json')
        .send({
          username: 'NewUser',
          email: 'newuserexample.com',
          phoneNumber: '+1234567890',
          password: 'SecurePassword1!',
          fullName: 'New User',
        });

      expect(status).toBe(400);
      expect(body).toHaveProperty('message', 'body.email: Invalid email');
    });
  });

  describe('PATCH /api/v1/auth/verify-email', () => {
    it('should verify a user email', async () => {
      const email = 'newuser@example.com';
      const user = await prisma.user.findFirst({
        where: { email },
        select: { confirmationCode: true },
      });
      if (!user) throw new Error('No user found');
      const { confirmationCode } = user;

      const { status, body } = await request(testApp)
        .patch(`/api/v1/auth/verify-email/${confirmationCode}/${email}`)
        .set('x-requested-with', 'authaas')
        .set('accept', 'application/json')
        .set('accept', 'application/vnd.auth.v1+json');

      expect(status).toBe(200);
      const validation = apiV1AuthVerifyEmailResponseValidator.safeParse(body);
      expect(validation.success).toBe(true);

      if (validation.data) expect(validation.data.data.isActive).toBe(true);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login a user with valid credentials', async () => {
      const { status, body } = await request(testApp)
        .post('/api/v1/auth/login')
        .set('x-requested-with', 'authaas')
        .set('accept', 'application/json')
        .set('accept', 'application/vnd.auth.v1+json')
        .send({
          username: 'NewUser',
          password: 'SecurePassword1!',
        });

      expect(status).toBe(200);
      const validation = apiV1AuthLoginResponseValidator.safeParse(body);
      expect(validation.success).toBe(true);
      if (validation.data) {
        expect(validation.data.data.user.userID).toBe(registeredUserID);
        loggedInUserToken = validation.data.data.token;
      }
    });

    it('should fail to login a user with invalid credentials', async () => {
      const { status, body } = await request(testApp)
        .post('/api/v1/auth/login')
        .set('x-requested-with', 'authaas')
        .set('accept', 'application/json')
        .set('accept', 'application/vnd.auth.v1+json')
        .send({
          username: 'NewUser',
          password: 'InvalidPassword',
        });

      expect(status).toBe(401);
      expect(body).toHaveProperty(
        'message',
        'Invalid username and/or password!',
      );
    });
  });

  describe('PATCH /api/v1/auth/update-password', () => {
    it('should update a user password', async () => {
      const { status, body } = await request(testApp)
        .patch('/api/v1/auth/update-password')
        .set('x-requested-with', 'authaas')
        .set('accept', 'application/json')
        .set('accept', 'application/vnd.auth.v1+json')
        .set('Authorization', `Bearer ${loggedInUserToken}`)
        .send({
          currentPassword: 'SecurePassword1!',
          newPassword: 'NewSecurePassword1!',
          confirmPassword: 'NewSecurePassword1!',
        });

      expect(status).toBe(200);
      const validation =
        apiV1AuthUpdatePasswordResponseValidator.safeParse(body);
      expect(validation.success).toBe(true);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout a user', async () => {
      const loginRequest = await request(testApp)
        .post('/api/v1/auth/login')
        .set('x-requested-with', 'authaas')
        .set('accept', 'application/json')
        .set('accept', 'application/vnd.auth.v1+json')
        .send({
          username: 'NewUser',
          password: 'NewSecurePassword1!',
        });

      const { status, body } = await request(testApp)
        .post('/api/v1/auth/logout')
        .set('x-requested-with', 'authaas')
        .set('accept', 'application/json')
        .set('accept', 'application/vnd.auth.v1+json')
        .set('Authorization', `Bearer ${loginRequest.body.data.token}`);

      expect(status).toBe(200);
      const validation = apiV1AuthLogoutResponseValidator.safeParse(body);
      expect(validation.success).toBe(true);
      if (validation.data) expect(validation.data.data).toEqual([]);
    });

    it('should fail to logout a user without a valid token', async () => {
      const { status, body } = await request(testApp)
        .post('/api/v1/auth/logout')
        .set('x-requested-with', 'authaas')
        .set('accept', 'application/json')
        .set('accept', 'application/vnd.auth.v1+json');

      expect(status).toBe(401);
      expect(body).toHaveProperty(
        'message',
        'Failed to verify the integrity of the token.',
      );
    });
  });
});
