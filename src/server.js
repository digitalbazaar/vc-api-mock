import {createStore} from './store/index.js';
import {credentialsRouter} from './routes/credentials.js';
import {errorHandler} from './middleware/problemDetails.js';
import {interactionsRouter} from './routes/interactions.js';
import {presentationsRouter} from './routes/presentations.js';
import {statusRouter} from './routes/status.js';
import {workflowsRouter} from './routes/workflows.js';

import express from 'express';

/**
 * Creates and configures the Express app.
 * Does not call listen — callers handle that (or use supertest directly).
 *
 * @param {ReturnType<typeof createStore>} [store] - Optional store override
 *   for testing
 * @returns {import('express').Application}
 */
export function createApp(store = createStore()) {
  const app = express();
  app.use(express.json());

  app.use('/credentials', credentialsRouter(store));
  app.use('/presentations', presentationsRouter(store));
  app.use('/status-lists', statusRouter(store));
  app.use('/workflows', workflowsRouter(store));
  app.use('/', interactionsRouter(store));

  app.use(errorHandler);
  return app;
}
