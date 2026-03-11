#!/usr/bin/env node
/**
 * index.js — Bridge2AI centralized interactive CLI.
 *
 * Entry point for everything: chat, API keys, database management.
 * The user never needs to type raw "node src/index.js add-key anthropic KEY".
 * They just run "npm start" and navigate the menu.
 *
 * Also supports direct CLI commands for scripts/automation:
 *   node src/index.js chat              (legacy compat)
 *   node src/index.js add-key <p> <k>  (legacy compat)
 *   node src/index.js import <file>     (scripted import)
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';

import Database from './database.js';
import LLMManager from './llm-manager.js';
import { importData } from './import-data.js';
import { renderHistory, renderInfoBox } from './display.js';
import { drawBanner, drawMenu } from './menu.js';

// ─── Single shared readline ───────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve =>
    rl.question(chalk.yellow('  › ') + question + ' ', resolve)
  );
}

async function pickFrom(title, options) {
  while (true) {
    drawMenu(title, options);
    const raw = (await ask('')).trim();
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= options.length) return n;
    console.log(chalk.red(`  ✗ Enter a number between 1 and ${options.length}\n`));
  }
}

// ─── First-run .env wizard ────────────────────────────────────────────────────

async function ensureEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config();
    return;
  }

  console.log(chalk.yellow('\n  ⚠️  No .env file found — let\'s create one.\n'));
  console.log(chalk.gray('  This file stores your MySQL connection settings.\n'));

  const host = (await ask('MySQL host   [localhost]:')) || 'localhost';
  const user = (await ask('MySQL user   [demo-api]:')).trim()  || 'demo-api';
  const pass = (await ask('MySQL pass   [Bridge2AI]:')).trim() || 'Bridge2AI';
  const name = (await ask('MySQL db     [llm_manager]:')).trim() || 'llm_manager';

  const content = `DB_HOST=${host}\nDB_USER=${user}\nDB_PASSWORD=${pass}\nDB_NAME=${name}\n`;
  fs.writeFileSync(envPath, content);
  console.log(chalk.green('\n  ✓ .env created!\n'));
  dotenv.config();
}

// ─── DB connection with helpful error ─────────────────────────────────────────

async function connectDB(db) {
  try {
    await db.connect();
    return true;
  } catch (e) {
    console.log(chalk.red('\n  ✗ MySQL connection failed: ' + e.message + '\n'));
    console.log(chalk.gray('  Make sure MySQL is running and run this SQL as root:\n'));
    console.log(chalk.white("    CREATE USER IF NOT EXISTS 'demo-api'@'localhost' IDENTIFIED BY 'Bridge2AI';"));
    console.log(chalk.white("    GRANT ALL PRIVILEGES ON llm_manager.* TO 'demo-api'@'localhost';"));
    console.log(chalk.white("    FLUSH PRIVILEGES;\n"));
    return false;
  }
}

// ─── API Keys menu ────────────────────────────────────────────────────────────

async function apiKeysMenu(db, llm) {
  while (true) {
    const choice = await pickFrom('API KEY MANAGEMENT', [
      'Add / update a key',
      'List saved keys',
      'Delete all keys',
      'Back',
    ]);

    if (choice === 1) {
      console.log(chalk.gray('\n  Supported providers: anthropic, openai, gemini, ollama\n'));
      const provider = (await ask('Provider:')).trim().toLowerCase();
      const validProviders = ['anthropic', 'openai', 'gemini', 'ollama'];
      if (!validProviders.includes(provider)) {
        console.log(chalk.red('  ✗ Unknown provider. Supported: ' + validProviders.join(', ') + '\n'));
        continue;
      }
      const key = (await ask('Paste your API key:')).trim();
      if (!key) { console.log(chalk.red('  ✗ No key entered.\n')); continue; }

      await db.saveApiKey(provider, key, null);
      console.log(chalk.green('\n  ✓ Key saved.'));

      if (provider === 'anthropic') {
        console.log(chalk.gray('  Detecting model... (may take a moment)'));
        const model = await llm.detectAnthropicModel(key);
        await db.saveApiKey(provider, key, model);
        console.log(chalk.green('  ✓ Model detected: ' + model + '\n'));
      } else {
        console.log();
      }

    } else if (choice === 2) {
      const [rows] = await db.connection.query(
        'SELECT provider, api_key, model_name, is_active FROM api_keys ORDER BY provider'
      );
      if (rows.length === 0) {
        console.log(chalk.yellow('\n  No API keys stored yet.\n'));
      } else {
        renderInfoBox('🔑 STORED API KEYS', rows.map(r => [
          r.provider,
          (r.model_name || '(no model)') + '   …' + r.api_key.slice(-8),
        ]));
      }

    } else if (choice === 3) {
      const [rows] = await db.connection.query('SELECT COUNT(*) as cnt FROM api_keys');
      const count = Number(rows[0].cnt);
      if (count === 0) { console.log(chalk.yellow('\n  No keys to delete.\n')); continue; }
      const confirm = (await ask(chalk.red(`Delete all ${count} key(s)? Type YES to confirm:`))).trim();
      if (confirm === 'YES') {
        await db.connection.query('DELETE FROM api_keys');
        console.log(chalk.green('  ✓ All API keys deleted.\n'));
      } else {
        console.log(chalk.gray('  Cancelled.\n'));
      }

    } else {
      return;
    }
  }
}

// ─── Database menu ────────────────────────────────────────────────────────────

async function databaseMenu(db) {
  while (true) {
    const choice = await pickFrom('DATABASE MANAGEMENT', [
      'Initialize / migrate tables  (safe)',
      'Recreate tables — DROP + rebuild  ⚠️',
      'Clear all chat history  (backup saved)',
      'Wipe entire database — ALL DATA LOST  ⚠️',
      'Import all data files from /data folder',
      'Back',
    ]);

    if (choice === 1) {
      // Tables are created on connect. Run migrations inline.
      try {
        await db.initializeTables();
        console.log(chalk.green('\n  ✓ Tables initialized / migrated.\n'));
      } catch (e) {
        console.log(chalk.red('  ✗ ' + e.message + '\n'));
      }

    } else if (choice === 2) {
      const confirm = (await ask(chalk.red('DROP all tables and rebuild? Type YES:'))).trim();
      if (confirm !== 'YES') { console.log(chalk.gray('  Cancelled.\n')); continue; }
      try {
        // Drop raw_import tables
        const [raw] = await db.connection.query("SHOW TABLES LIKE 'raw_import_%'");
        for (const row of raw) {
          await db.connection.query('DROP TABLE IF EXISTS `' + Object.values(row)[0] + '`');
        }
        // Drop core tables
        for (const tbl of ['data_profiles', 'data_imports', 'chat_history', 'api_keys']) {
          await db.connection.query('DROP TABLE IF EXISTS `' + tbl + '`');
        }
        await db.initializeTables();
        console.log(chalk.green('\n  ✓ Database recreated — clean slate.\n'));
      } catch (e) {
        console.log(chalk.red('  ✗ ' + e.message + '\n'));
      }

    } else if (choice === 3) {
      const [countRows] = await db.connection.query('SELECT COUNT(*) as cnt FROM chat_history');
      const total = Number(countRows[0].cnt);
      if (total === 0) { console.log(chalk.yellow('\n  No chat history to clear.\n')); continue; }

      const confirm = (await ask(`Clear ${total} message(s) and save backup? Type YES:`)).trim();
      if (confirm !== 'YES') { console.log(chalk.gray('  Cancelled.\n')); continue; }

      // Backup to file
      const [allRows] = await db.connection.query('SELECT * FROM chat_history ORDER BY id ASC');
      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(backupDir, `chat-history-${ts}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(allRows, null, 2));

      await db.connection.query('DELETE FROM chat_history');
      console.log(chalk.green(`\n  ✓ Cleared. Backup saved → ${backupFile}\n`));

    } else if (choice === 4) {
      const confirm = (await ask(chalk.red('Wipe EVERYTHING (data, keys, history)? Type YES:'))).trim();
      if (confirm !== 'YES') { console.log(chalk.gray('  Cancelled.\n')); continue; }
      try {
        await db.wipeDatabase();
        console.log(chalk.green('  ✓ Database wiped.\n'));
      } catch (e) {
        console.log(chalk.red('  ✗ ' + e.message + '\n'));
      }

    } else if (choice === 5) {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        console.log(chalk.yellow('\n  No /data folder found. Create it and drop in .xlsx/.csv files.\n'));
        continue;
      }
      const SUPPORTED = ['.xlsx', '.xls', '.csv'];
      const files = fs.readdirSync(dataDir)
        .filter(f => SUPPORTED.includes(path.extname(f).toLowerCase()));
      if (files.length === 0) {
        console.log(chalk.yellow('\n  /data folder is empty. Add .xlsx or .csv files first.\n'));
        continue;
      }
      console.log(chalk.cyan(`\n  Found ${files.length} file(s). Importing...\n`));
      let ok = 0, fail = 0;
      for (const f of files) {
        try {
          await importData(path.join(dataDir, f), db);
          ok++;
        } catch (e) {
          console.log(chalk.red('  ✗ ' + f + ': ' + e.message));
          fail++;
        }
      }
      console.log(chalk.green(`\n  ✓ ${ok} imported` + (fail ? chalk.red(`, ${fail} failed`) : '') + '\n'));

    } else {
      return;
    }
  }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

async function runChat(db, llm, session, user, autoClear = false) {
  if (!await llm.setProvider('anthropic')) {
    console.log(chalk.red('\n  ✗ No Anthropic API key. Go to API Keys → Add / update a key.\n'));
    return;
  }

  // Auto-clear: wipe this session's history before starting
  if (autoClear) {
    await db.connection.query('DELETE FROM chat_history WHERE session_id = ?', [session]);
    console.log(chalk.gray('  (Previous chat history cleared — fresh session)\n'));
  }

  let mode = 'present'; // 'present' | 'raw'
  let history = await db.getChatHistory(session);

  console.log(chalk.cyan('\n' + '═'.repeat(60)));
  console.log(chalk.cyan('  Bridge2AI Chat'));
  console.log(chalk.cyan('  Session: ' + session + '  |  User: ' + user));
  console.log(chalk.cyan('  Mode: ' + chalk.white(mode) + '  →  type /mode raw  or  /mode present'));
  console.log(chalk.cyan('  Commands: /exit  /history  /clear  /import <file>  /profiles'));
  console.log(chalk.cyan('═'.repeat(60) + '\n'));

  while (true) {
    const input = (await ask(chalk.bold(user + '>'))).trim();
    if (!input) continue;

    if (input === '/exit') {
      console.log(chalk.gray('\n  Leaving chat...\n'));
      break;
    }

    if (input === '/mode raw') {
      mode = 'raw';
      console.log(chalk.cyan('\n  Mode → RAW  (JSON output, Twilio-friendly)\n'));
      continue;
    }

    if (input === '/mode present') {
      mode = 'present';
      console.log(chalk.cyan('\n  Mode → PRESENTATION  (formatted tables)\n'));
      continue;
    }

    if (input === '/history') {
      renderHistory(history);
      continue;
    }

    if (input === '/clear') {
      history = [];
      console.log(chalk.gray('\n  In-memory context cleared. DB history preserved.\n'));
      continue;
    }

    if (input === '/profiles') {
      const profs = await db.getDataProfiles(10);
      if (profs.length === 0) {
        console.log(chalk.yellow('\n  No data imported yet. Use Database → Import all data.\n'));
      } else {
        renderInfoBox('📊 DATA PROFILES', profs.map(p => [p.raw_table_name, p.dataset_summary || '']));
      }
      continue;
    }

    if (input.startsWith('/import ')) {
      const fp = input.slice(8).trim();
      if (!fp) { console.log(chalk.yellow('\n  Usage: /import <path>\n')); continue; }
      console.log(chalk.gray('\n  Importing ' + fp + '...\n'));
      await importData(fp, db);
      history = await db.getChatHistory(session);
      continue;
    }

    // Regular AI query
    try {
      const response = await llm.chat(input, session, user, history, mode);
      if (mode === 'raw') {
        console.log(chalk.gray('\n  [RAW JSON OUTPUT]\n') + response + '\n');
      } else {
        console.log(chalk.green('\n  AI › ') + response + '\n');
      }
      history = await db.getChatHistory(session);
    } catch (e) {
      console.log(chalk.red('\n  ✗ ' + e.message + '\n'));
    }
  }
}

async function chatMenu(db, llm, autoClear = false) {
  while (true) {
    const choice = await pickFrom('CHAT — AI MODEL', [
      'New chat  (default session)',
      'Chat as named user / session',
      'List saved sessions',
      'Back',
    ]);

    if (choice === 1) {
      await runChat(db, llm, 'default', 'User', autoClear);

    } else if (choice === 2) {
      const session = (await ask('Session name:')).trim() || 'default';
      const user    = (await ask('Your name:')).trim() || 'User';
      await runChat(db, llm, session, user, autoClear);

    } else if (choice === 3) {
      const [rows] = await db.connection.query(
        `SELECT session_id, COUNT(*) as messages, MAX(timestamp) as last_active
         FROM chat_history
         GROUP BY session_id
         ORDER BY last_active DESC
         LIMIT 20`
      );
      if (rows.length === 0) {
        console.log(chalk.yellow('\n  No saved sessions yet.\n'));
      } else {
        renderInfoBox('💬 SAVED SESSIONS', rows.map(r => [
          r.session_id,
          r.messages + ' msgs — ' + new Date(r.last_active).toLocaleString(),
        ]));
      }

    } else {
      return;
    }
  }
}

// ─── Legacy CLI compat ────────────────────────────────────────────────────────
// Supports direct invocation for scripts/CI: node src/index.js add-key anthropic KEY

async function handleLegacyCLI(db, llm, args) {
  const cmd = args[0];

  if (cmd === 'add-key') {
    const [provider, apiKey] = [args[1], args[2]];
    if (!provider || !apiKey) {
      console.log(chalk.red('  Usage: node src/index.js add-key <provider> <key>\n'));
      return true;
    }
    await db.connect();
    await db.saveApiKey(provider, apiKey, null);
    console.log(chalk.green('  ✓ Key saved'));
    if (provider === 'anthropic') {
      const model = await llm.detectAnthropicModel(apiKey);
      await db.saveApiKey(provider, apiKey, model);
      console.log(chalk.green('  ✓ Model: ' + model));
    }
    await db.close();
    return true;
  }

  if (cmd === 'import') {
    const fp = args[1];
    if (!fp) { console.log(chalk.red('  Usage: node src/index.js import <file>\n')); return true; }
    await db.connect();
    await importData(fp, db);
    await db.close();
    return true;
  }

  if (cmd === 'list-keys') {
    await db.connect();
    const [rows] = await db.connection.query('SELECT provider, api_key, model_name FROM api_keys');
    renderInfoBox('🔑 API KEYS', rows.map(r => [r.provider, (r.model_name || '?') + '  …' + r.api_key.slice(-8)]));
    await db.close();
    return true;
  }

  if (cmd === 'profiles') {
    await db.connect();
    const profs = await db.getDataProfiles(10);
    renderInfoBox('📊 PROFILES', profs.map(p => [p.raw_table_name, p.dataset_summary || '']));
    await db.close();
    return true;
  }

  return false; // not a legacy command — fall through to interactive menu
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await ensureEnv();

  const db  = new Database();
  const llm = new LLMManager(db);

  // Handle direct CLI invocations (add-key, import, etc.)
  const cliArgs = process.argv.slice(2);
  if (cliArgs.length > 0) {
    const handled = await handleLegacyCLI(db, llm, cliArgs);
    if (handled) { rl.close(); return; }
  }

  // Interactive mode
  const ok = await connectDB(db);
  if (!ok) { rl.close(); process.exit(1); }

  drawBanner();

  let autoClear = false;

  while (true) {
    const clearLabel = autoClear
      ? 'Auto-clear chat on start: ' + chalk.green('ON ')
      : 'Auto-clear chat on start: ' + chalk.gray('OFF');

    const choice = await pickFrom('MAIN MENU', [
      'Chat with AI',
      'API Keys',
      'Database',
      clearLabel,
      'Exit',
    ]);

    if      (choice === 1) await chatMenu(db, llm, autoClear);
    else if (choice === 2) await apiKeysMenu(db, llm);
    else if (choice === 3) await databaseMenu(db);
    else if (choice === 4) {
      autoClear = !autoClear;
      console.log(chalk.cyan(`\n  Auto-clear chat toggled: ${autoClear ? chalk.green('ON') : chalk.gray('OFF')}\n`));
    }
    else {
      console.log(chalk.gray('\n  Goodbye!\n'));
      await db.close();
      rl.close();
      process.exit(0);
    }
  }
}

main().catch(e => {
  console.error(chalk.red('\n  ✗ Fatal: ' + e.message + '\n'));
  process.exit(1);
});
