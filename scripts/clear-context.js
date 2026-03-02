/**
 * clear-context.js — Reset all chat context so the AI starts fresh.
 *
 * What it does:
 *   1. Backs up the full chat_history to  backups/chat-history-<timestamp>.json
 *   2. Deletes all rows from chat_history (DB table is cleared)
 *   3. The AI now has zero prior context — like a brand-new session
 *
 * The backup file is your permanent record. The DB is clean.
 *
 * Usage:  node scripts/clear-context.js
 *         node scripts/clear-context.js --session default   (clear one session only)
 */

import Database from '../src/database.js';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const SESSION = process.argv.find((a, i) => process.argv[i - 1] === '--session') || null;

async function main() {
  const db = new Database();
  await db.connect();

  // Count rows to be cleared
  const [countRows] = await db.connection.query(
    SESSION
      ? 'SELECT COUNT(*) as cnt FROM chat_history WHERE session_id = ?'
      : 'SELECT COUNT(*) as cnt FROM chat_history',
    SESSION ? [SESSION] : []
  );
  const total = Number(countRows[0].cnt);

  if (total === 0) {
    console.log(chalk.yellow('\n  No chat context to clear.\n'));
    await db.close();
    return;
  }

  // Back up to JSON
  const [allRows] = await db.connection.query(
    SESSION
      ? 'SELECT * FROM chat_history WHERE session_id = ? ORDER BY id ASC'
      : 'SELECT * FROM chat_history ORDER BY id ASC',
    SESSION ? [SESSION] : []
  );

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const label = SESSION ? `session-${SESSION}-` : '';
  const backupFile = path.join(backupDir, `chat-history-${label}${ts}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(allRows, null, 2));

  // Clear DB
  await db.connection.query(
    SESSION
      ? 'DELETE FROM chat_history WHERE session_id = ?'
      : 'DELETE FROM chat_history',
    SESSION ? [SESSION] : []
  );

  console.log(chalk.cyan('\n  Context cleared'));
  console.log(chalk.gray(`  Backed up ${total} message(s) → ${backupFile}`));
  console.log(chalk.green('  AI starts fresh on next chat.\n'));

  await db.close();
}

main().catch(console.error);
