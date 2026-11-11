const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { query } = require('./config/db');
const { authenticate, requireType } = require('./middleware/auth');
const { errorHandler, notFoundHandler, notFound } = require('./middleware/errors');
const { router: authRouter } = require('./routes/auth');
const usersRouter = require('./routes/users');
const operationsRouter = require('./routes/operations');
const insightsRouter = require('./routes/insights');
const portalRouter = require('./routes/portal');

function createApp(registry) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','), credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

  const api = express.Router();

  api.get('/health', async (_req, res) => {
    const [db] = await query(`SELECT 'up' AS status, TO_CHAR(SYSTIMESTAMP, 'YYYY-MM-DD"T"HH24:MI:SS') AS db_time FROM dual`);
    res.json({ status: 'ok', db });
  });

  api.use('/auth', authRouter);

  // everything below requires a valid token
  api.use(authenticate);

  api.get('/meta', (req, res) =>
    res.json(Object.fromEntries(registry.resources.map((r) => [r.def.path, r.meta(req.user, registry)]))));

  api.get('/lookups/:resource', requireType('EMPLOYEE'), async (req, res) => {
    const r = registry.byPath[req.params.resource];
    if (!r || !r.def.pk) throw notFound('Unknown lookup');
    res.json(await r.lookup());
  });

  api.use('/portal', portalRouter);
  api.use('/users', usersRouter);
  api.use(insightsRouter);
  api.use(operationsRouter); // custom workflow routes before generic CRUD
  for (const r of registry.resources) api.use(`/${r.def.path}`, r.router());

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
