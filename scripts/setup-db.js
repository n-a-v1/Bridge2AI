/**
 * setup-db.js — Initialize and migrate the llm_manager database.
 *
 * Safe to re-run on an existing database:
 *   - CREATE TABLE IF NOT EXISTS for new tables
 *   - Checks INFORMATION_SCHEMA before adding columns so existing data is never lost
 */

import Database from '../src/database.js';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import chalk from 'chalk';
dotenv.config();

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = ?
       AND COLUMN_NAME  = ?`,
    [table, column]
  );
  return Number(rows[0].cnt) > 0;
}

async function addColumnIfMissing(conn, table, column, definition) {
  if (!(await columnExists(conn, table, column))) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(chalk.yellow(`  ↳ migrated: ${table}.${column} (${definition})`));
  }
}

async function setup() {
  console.log(chalk.cyan('\n🔧 Setting up database...\n'));

  // Use Database class for initial table creation (handles DB-not-existing case)
  const db = new Database();
  await db.connect();

  // ── Column migrations — safe to run on any schema version ─────────────────
  // These handle cases where the table was created by an older version of the
  // code that was missing columns. INFORMATION_SCHEMA checks prevent errors
  // when columns already exist.

  console.log(chalk.cyan('  Checking schema migrations...'));

  const c = db.connection;

  // api_keys: model_name was missing in pre-v3 schemas
  await addColumnIfMissing(c, 'api_keys', 'model_name', 'VARCHAR(100)');

  // chat_history: user_name was missing in very early schemas
  await addColumnIfMissing(c, 'chat_history', 'user_name', 'VARCHAR(100)');

  // chat_history: model was missing in very early schemas
  await addColumnIfMissing(c, 'chat_history', 'model', 'VARCHAR(100)');

  console.log(chalk.green('\n✓ Database ready!\n'));
  await db.close();
}

setup().catch(console.error);
