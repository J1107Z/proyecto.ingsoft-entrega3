const { Pool } = require('pg');
const config = require('../config');

let poolInstance = null;

/**
 * Lazily initializes and returns the PostgreSQL connection pool when `DATABASE_URL` is configured.
 * @param {Function} [PoolClass=Pool] - Optional Pool constructor override for testing.
 * @returns {import('pg').Pool|null}
 */
function getPool(PoolClass = Pool) {
  if (!config.databaseUrl) return null;
  if (!poolInstance) {
    poolInstance = new PoolClass({
      connectionString: config.databaseUrl,
      ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return poolInstance;
}

/**
 * Resets the singleton pool (used in tests).
 */
async function closePool() {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

/**
 * Executes a parameterized SQL statement against the pool.
 * @param {string} text - Parameterized SQL statement.
 * @param {unknown[]} [params=[]] - Bound values.
 */
async function query(text, params = []) {
  const pool = getPool();
  if (!pool) {
    throw new Error('DATABASE_URL no configurado; ejecutando en modo local');
  }
  return pool.query(text, params);
}

/**
 * Wraps a database callback in an explicit ACID SQL transaction (`BEGIN` / `COMMIT` / `ROLLBACK`).
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback - Transactional work.
 * @returns {Promise<T>}
 * @template T
 */
async function withTransaction(callback) {
  const pool = getPool();
  if (!pool) {
    throw new Error('DATABASE_URL no configurado; no se puede iniciar transacción SQL');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getPool,
  closePool,
  query,
  withTransaction,
};
