import AttendanceHandler from '@/api/v1/attendance/handler';
import AuthHandler from '@/api/v1/auth/handler';
import HealthHandler from '@/api/v1/health/handler';
import SessionHandler from '@/api/v1/session/handler';
import UserHandler from '@/api/v1/user/handler';
import SecureExpressApp from '@/infra/express';

const appOptions = {
  handlers: [
    { path: '/api/v1/health', handler: HealthHandler() },
    { path: '/api/v1/attendance', handler: AttendanceHandler() },
    { path: '/api/v1/auth', handler: AuthHandler() },
    { path: '/api/v1/session', handler: SessionHandler() },
    { path: '/api/v1/user', handler: UserHandler() },
  ],
  extraMiddlewares: [
    /* additional middlewares here */
  ],
  apiRateLimit: 100,
};

const secureApp = new SecureExpressApp(appOptions);
export default secureApp.getApp();
