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
const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (isJsonSyntaxError(error)) {
    const body: Api.ErrorBody = { message: 'The request body is not valid JSON' };
    res.status(400).json(body);
    return;
  }

  // Logged with the request and the full stack, so the failing step can be found.
  console.error(`${req.method} ${req.originalUrl} failed:`, error);
  const body: Api.ErrorBody = { message: 'Something went wrong' };
  res.status(500).json(body);
};

const isJsonSyntaxError = (error: unknown): boolean =>
  error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed';
