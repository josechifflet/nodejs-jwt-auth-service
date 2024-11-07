import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';

import AttendanceHandler from '@/api/v1/attendance/handler';
import AuthHandler from '@/api/v1/auth/handler';
import HealthHandler from '@/api/v1/health/handler';
import SessionHandler from '@/api/v1/session/handler';
import UserHandler from '@/api/v1/user/handler';
import config from '@/config';
import errorHandler from '@/modules/error';
import accept from '@/modules/middleware/accept';
import busyHandler from '@/modules/middleware/busy-handler';
import favicon from '@/modules/middleware/favicon';
import { errorLogger, successLogger } from '@/modules/middleware/logger';
import notFound from '@/modules/middleware/not-found';
import slowDown from '@/modules/middleware/slow-down';
import xRequestedWith from '@/modules/middleware/x-requested-with';
import xst from '@/modules/middleware/xst';

/**
 * Loads an Express application.
 */
function loadExpress() {
  // Create Express application.
  const app = express();

  // Allow proxies on our nginx server in production.
  if (config.NODE_ENV === 'production') {
    app.enable('trust proxy');
  }

  // Use logging on application.
  if (config.NODE_ENV === 'production') {
    app.use(
      morgan(
        ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms',
      ),
    );
  } else {
    app.use(morgan('dev'));
  }

  // Security headers.
  app.use(
    helmet({
      frameguard: {
        action: 'deny',
      },
      hidePoweredBy: false,
    }),
  );

  // Check for CSRF via the Header method.
  app.use(xRequestedWith());

  // Validate `Accept` header.
  app.use(accept());

  // Handle if server is too busy.
  app.use(busyHandler());

  // Prevent parameter pollution.
  app.use(hpp());

  // Only allow the following methods: [OPTIONS, HEAD, CONNECT, GET, POST, PATCH, PUT, DELETE].
  app.use(xst());

  // Send 204 on icon requests.
  app.use(favicon());

  // Define handlers.
  const attendanceHandler = AttendanceHandler();
  const authHandler = AuthHandler();
  const healthHandler = HealthHandler();
  const sessionHandler = SessionHandler();
  const userHandler = UserHandler();

  // Log requests (successful requests).
  app.use(successLogger);

  // Define API routes. Throttle '/api' route to prevent spammers.
  app.use('/api', slowDown(75));
  app.use('/api/v1', healthHandler);
  app.use('/api/v1/attendance', attendanceHandler);
  app.use('/api/v1/auth', authHandler);
  app.use('/api/v1/session', sessionHandler);
  app.use('/api/v1/user', userHandler);

  // Catch-all routes for API.
  app.all('*', notFound());

  // Log errors.
  app.use(errorLogger);

  // Define error handlers.
  app.use(errorHandler);

  // Return configured app.
  return app;
}

export default loadExpress;
