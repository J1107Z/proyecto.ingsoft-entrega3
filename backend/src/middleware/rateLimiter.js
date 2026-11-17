const rateLimit = require('express-rate-limit');
const config = require('../config');

const isTestEnv = () => config.nodeEnv === 'test' || process.env.DISABLE_RATE_LIMIT === 'true';

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  message: {
    error: 'Demasiados intentos de autenticación. Por favor, espera unos minutos.',
  },
});

const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  message: {
    error: 'Límite de peticiones excedido. Intenta de nuevo en breve.',
  },
});

module.exports = {
  authRateLimiter,
  apiRateLimiter,
};
