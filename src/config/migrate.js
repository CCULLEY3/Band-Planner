// src/config/migrate.js
// =============================================================================
//  Runs all SQL migration files in dependency order.
//  Usage:  npm run migrate:all
//          (or individually: npm run migrate, migrate:notifications, etc.)
//
//  Each file is idempotent (uses CREATE TABLE IF NOT EXISTS) — safe to re-run.
// =============================================================================

require('dotenv').config();
const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host: process.env.DB_HOST || 'localhost', port: +process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'band_planner',
        user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD || '' }
);

async function runFile(filename) {
  const filepath = path.join(__dirname, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`  ⚠  Skipping missing file: ${filename}`);
    return;
  }
  const sql = fs.readFileSync(filepath, 'utf8');
  await pool.query(sql);
  console.log(`  ✓  ${filename}`);
}

async function migrate() {
  console.log('\n⏳  Running Band Planner migrations…\n');
  try {
    // Order matters: base tables first, then extensions
    await runFile('schema.sql');              // users, bands, venues, tours, gigs, setlists, attachments
    await runFile('notifications_schema.sql'); // notification_preferences, push_subscriptions, notification_history
    await runFile('auth_schema.sql');          // refresh_tokens, band_invitations (+ role constraint)
    await runFile('analytics_schema.sql');     // financial_records (+ actual_payment/expenses columns on gigs)
    console.log('\n✅  All migrations complete.\n');
  } catch (err) {
    console.error('\n❌  Migration failed:', err.message);
    if (process.env.NODE_ENV === 'development') console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
