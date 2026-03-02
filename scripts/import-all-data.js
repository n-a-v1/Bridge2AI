/**
 * import-all-data.js — Import every supported data file from the /data folder.
 *
 * Supported formats:  .xlsx  .xls  .csv
 *
 * Each file becomes its own raw_import_N table in the database.
 * Files that fail are logged and skipped — other imports continue.
 *
 * Usage:
 *   node scripts/import-all-data.js              (uses ./data by default)
 *   node scripts/import-all-data.js ./my-folder  (custom folder)
 */

import Database from '../src/database.js';
import { importData } from '../src/import-data.js';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const SUPPORTED = ['.xlsx', '.xls', '.csv'];

const dataDir = path.resolve(process.argv[2] || './data');

async function main() {
  if (!fs.existsSync(dataDir)) {
    console.error(chalk.red(`\n  Folder not found: ${dataDir}\n`));
    process.exit(1);
  }

  const files = fs.readdirSync(dataDir)
    .filter(f => SUPPORTED.includes(path.extname(f).toLowerCase()))
    .map(f => path.join(dataDir, f));

  if (files.length === 0) {
    console.log(chalk.yellow(`\n  No supported files found in ${dataDir}\n`));
    console.log(chalk.gray(`  Supported: ${SUPPORTED.join(', ')}\n`));
    return;
  }

  console.log(chalk.cyan(`\n  Found ${files.length} file(s) in ${dataDir}\n`));

  const db = new Database();
  await db.connect();

  let ok = 0;
  let fail = 0;

  for (const filePath of files) {
    const name = path.basename(filePath);
    try {
      console.log(chalk.gray(`  → ${name}`));
      await importData(filePath, db);
      ok++;
    } catch (e) {
      console.log(chalk.red(`  ✗ ${name}: ${e.message}`));
      fail++;
    }
  }

  await db.close();

  console.log(chalk.cyan('\n  ─────────────────────────────'));
  console.log(chalk.green(`  ✓ ${ok} imported successfully`));
  if (fail > 0) console.log(chalk.red(`  ✗ ${fail} failed`));
  console.log(chalk.cyan('  ─────────────────────────────\n'));
}

main().catch(console.error);
