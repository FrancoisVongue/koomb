import express, { type ErrorRequestHandler } from 'express';
import type { Api } from 'shared';
import { pagesRoutes } from './models/pages/routes.ts';
import type { Services } from './services/index.ts';

export const createApp = (services: Services) => {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/pages', pagesRoutes(services));
  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'Not found' } satisfies Api.ErrorBody);
  });

  app.use(errorHandler);
  return app;
};

/** Last stop for anything thrown: bad JSON is the client's fault, the rest is ours. */
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (isJsonSyntaxError(error)) {
    res.status(400).json({ message: 'The request body is not valid JSON' } satisfies Api.ErrorBody);
    return;
  }
  console.error(error);
  res.status(500).json({ message: 'Something went wrong' } satisfies Api.ErrorBody);
};

const isJsonSyntaxError = (error: unknown): boolean =>
  error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed';
