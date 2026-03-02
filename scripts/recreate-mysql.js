/**
 * recreate-mysql.js — Drop everything and rebuild a blank database.
 *
 * What it does:
 *   1. Drops ALL tables in llm_manager (chat_history, api_keys, data_profiles,
 *      data_imports, and every raw_import_* table)
 *   2. Reconnects and re-creates the schema (empty tables, correct columns)
 *
 * Your API key will be deleted. Re-add it with:
 *   node src/index.js add-key anthropic YOUR_KEY
 *
 * Usage:  node scripts/recreate-mysql.js
 *         node scripts/recreate-mysql.js --confirm   (skip the prompt)
 */

import mysql from 'mysql2/promise';
import Database from '../src/database.js';
import readline from 'readline';
import chalk from 'chalk';
import dotenv from 'dotenv';
dotenv.config();

async function confirm() {
  if (process.argv.includes('--confirm')) return true;
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(
      chalk.red('\n  ⚠️  This will DELETE all tables and data. Type YES to continue: '),
      ans => { rl.close(); resolve(ans.trim() === 'YES'); }
    );
  });
}

async function main() {
  if (!await confirm()) {
    console.log(chalk.gray('\n  Cancelled.\n'));
    return;
  }

  console.log(chalk.cyan('\n  Dropping all tables...\n'));

  // Connect without specifying a database so we can drop tables freely
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'demo-api',
    password: process.env.DB_PASSWORD || 'Bridge2AI',
    database: process.env.DB_NAME     || 'llm_manager',
  });

  // Find all raw_import_* tables
  const [rawTables] = await conn.query("SHOW TABLES LIKE 'raw_import_%'");
  for (const row of rawTables) {
    const tbl = Object.values(row)[0];
    await conn.query(`DROP TABLE IF EXISTS \`${tbl}\``);
    console.log(chalk.gray(`  dropped: ${tbl}`));
  }

  // Drop core tables
  for (const tbl of ['data_profiles', 'data_imports', 'chat_history', 'api_keys']) {
    await conn.query(`DROP TABLE IF EXISTS \`${tbl}\``);
    console.log(chalk.gray(`  dropped: ${tbl}`));
  }

  await conn.end();

  // Re-create schema via setup script logic
  console.log(chalk.cyan('\n  Rebuilding schema...\n'));
  const db = new Database();
  await db.connect();
  await db.close();

  console.log(chalk.green('\n  Database recreated — clean slate.\n'));
  console.log(chalk.yellow('  Next step: node src/index.js add-key anthropic YOUR_KEY\n'));
}

main().catch(console.error);
