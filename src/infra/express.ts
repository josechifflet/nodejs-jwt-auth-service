import express, { Express, RequestHandler } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';

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

interface ExpressAppOptions {
  handlers: { path: string; handler: RequestHandler }[];
  extraMiddlewares?: RequestHandler[];
  apiRateLimit?: number;
}

export class SecureExpressApp {
  private app: Express;

  constructor(options: ExpressAppOptions) {
    this.app = express();
    this.configureApp();
    this.applyMiddlewares(options.extraMiddlewares);
    this.applyHandlers(options.handlers, options.apiRateLimit);
    this.applyErrorHandlers();
  }

  private configureApp(): void {
    if (config.NODE_ENV === 'production') {
      this.app.enable('trust proxy');
      this.app.use(
        morgan(
          ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms',
        ),
      );
    } else {
      this.app.use(morgan('dev'));
    }

    this.app.use(
      helmet({
        frameguard: { action: 'deny' },
        hidePoweredBy: false,
      }),
    );
    this.app.use(xRequestedWith());
    this.app.use(accept());
    this.app.use(busyHandler());
    this.app.use(hpp());
    this.app.use(xst());
    this.app.use(favicon());
    this.app.use(successLogger);
  }

  private applyMiddlewares(extraMiddlewares?: RequestHandler[]): void {
    if (extraMiddlewares) {
      extraMiddlewares.forEach((middleware) => this.app.use(middleware));
    }
  }

  private applyHandlers(
    handlers: { path: string; handler: RequestHandler }[],
    apiRateLimit = 75,
  ): void {
    this.app.use('/api', slowDown(apiRateLimit));

    handlers.forEach(({ path, handler }) => {
      this.app.use(path, handler);
    });

    this.app.all('*', notFound());
  }

  private applyErrorHandlers(): void {
    this.app.use(errorLogger);
    this.app.use(errorHandler);
  }

  public getApp(): Express {
    return this.app;
  }
}

export default SecureExpressApp;
