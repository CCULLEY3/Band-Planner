// api/src/config/db.js
// Neon-compatible PostgreSQL pool for Vercel serverless functions.
// Uses DATABASE_URL (set automatically by Vercel Postgres / Neon integration).
// Falls back to individual DB_* vars for local dev.

const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // required by Neon
        max: 3,                              // keep low for serverless
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 5_000,
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'band_planner',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || '',
      }
);

pool.on('error', (err) => console.error('[DB] pool error:', err.message));

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
