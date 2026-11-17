const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const { securityHeaders } = require('./middleware/security');
const { apiRateLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const deliveryRoutes = require('./routes/deliveries');
const auditRoutes = require('./routes/audit');

/**
 * Builds the configured MineMarket Express application without binding a TCP port.
 * @returns {import('express').Express}
 */
function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(securityHeaders);
  app.use(
    cors({
      origin: config.frontendOrigin === '*' ? true : config.frontendOrigin.split(','),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    })
  );
  app.use(express.json({ limit: '64kb' }));
  if (config.nodeEnv !== 'test') {
    app.use(morgan('tiny'));
  }

  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'minemarket-api',
      mode: config.databaseUrl ? 'postgres' : 'json-memory',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api', apiRateLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/deliveries', deliveryRoutes);
  app.use('/api/audit', auditRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint no encontrado' });
  });

  app.use(errorHandler);
  return app;
}

module.exports = {
  createApp,
};
