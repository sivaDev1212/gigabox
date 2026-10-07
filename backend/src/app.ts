import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { apiRouter } from './routes';
import { errorBody, errorHandler } from './errors/errorHandler';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', apiRouter);
  app.use((_req, res) => {
    res.status(404).json(errorBody('NOT_FOUND', 'Route not found'));
  });
  app.use(errorHandler);
  return app;
}
