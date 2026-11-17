const path = require('path');
require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'minemarket_dev_secret_change_in_production_key_123',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  frontendOrigin: process.env.FRONTEND_ORIGIN || '*',
  dataFile:
    process.env.MINEMARKET_DATA_FILE || path.join(__dirname, '..', '..', 'data', 'store.json'),
  memoryOnly: process.env.NODE_ENV === 'test' || process.env.MINEMARKET_MEMORY_ONLY === 'true',
};
