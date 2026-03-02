#!/usr/bin/env node
import { program } from 'commander';
import readline from 'readline';
import chalk from 'chalk';
import os from 'os';
import Database from './database.js';
import LLMManager from './llm-manager.js';
import { importData } from './import-data.js';
import { renderHistory, renderInfoBox } from './display.js';

const db = new Database();
const llm = new LLMManager(db);

program
  .name('js-llm-manager')
  .version('3.0.0-PRODUCTION');

// ─── add-key ──────────────────────────────────────────────────────────────────

program
  .command('add-key')
  .argument('<provider>', 'anthropic, openai, gemini')
  .argument('<apiKey>', 'API key')
  .action(async (provider, apiKey) => {
    await db.connect();
    await db.saveApiKey(provider, apiKey, null);
    console.log(chalk.green('✓ API key saved'));

    if (provider === 'anthropic') {
      const model = await llm.detectAnthropicModel(apiKey);
      await db.saveApiKey(provider, apiKey, model);
      console.log(chalk.green('✓ Detected: ' + model));
    }
    await db.close();
  });

// ─── list-keys ────────────────────────────────────────────────────────────────

program
  .command('list-keys')
  .description('List all stored API providers and their model names')
  .action(async () => {
    await db.connect();
    const [rows] = await db.connection.query(
      'SELECT provider, api_key, model_name, is_active FROM api_keys ORDER BY provider'
    );
    if (rows.length === 0) {
      console.log(chalk.yellow('\n  No API keys stored.\n'));
    } else {
      const tableRows = rows.map(r => [
        r.provider,
        r.model_name || '(not set)',
        '…' + r.api_key.slice(-8),
        r.is_active ? chalk.green('active') : chalk.gray('inactive'),
      ]);
      renderInfoBox('🔑 STORED API KEYS', [
        ['Provider', 'Model / Key (last 8) / Status'],
        ...tableRows.map(([p, m, k, s]) => [p, `${m}   ${k}   ${s}`]),
      ]);
    }
    await db.close();
  });

// ─── wipe-keys ────────────────────────────────────────────────────────────────

program
  .command('wipe-keys')
  .description('Delete ALL stored API keys (with confirmation)')
  .action(async () => {
    await db.connect();
    const [rows] = await db.connection.query('SELECT COUNT(*) as cnt FROM api_keys');
    const count = rows[0].cnt;

    if (count === 0) {
      console.log(chalk.yellow('\n  No API keys to delete.\n'));
      await db.close();
      return;
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(chalk.red(`\n  ⚠️  Delete ${count} key(s)? Type YES to confirm: `), async (ans) => {
      rl.close();
      if (ans.trim() === 'YES') {
        await db.connection.query('DELETE FROM api_keys');
        console.log(chalk.green('✓ All API keys deleted.\n'));
      } else {
        console.log(chalk.gray('  Cancelled.\n'));
      }
      await db.close();
    });
  });

// ─── chat ─────────────────────────────────────────────────────────────────────

program
  .command('chat')
  .option('--session <id>', 'Session ID for this conversation', 'default')
  .option('--user <name>', 'Your display name', os.userInfo().username)
  .option('--provider <name>', 'LLM provider to use', 'anthropic')
  .action(async (opts) => {
    await db.connect();

    if (!await llm.setProvider(opts.provider)) {
      console.log(chalk.red(`\n  No key found for provider "${opts.provider}". Run: node src/index.js add-key ${opts.provider} YOUR_KEY\n`));
      await db.close();
      return;
    }

    console.log(chalk.cyan('\n' + '='.repeat(62)));
    console.log(chalk.cyan('  AI LLM Manager — SQL Query System  v3.0.0'));
    console.log(chalk.cyan(`  Session: ${opts.session}  |  User: ${opts.user}  |  Provider: ${opts.provider}`));
    console.log(chalk.cyan('='.repeat(62)));
    console.log(chalk.gray('\nCommands: /exit  /history  /clear  /import <file>  /profiles\n'));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.yellow(`${opts.user}> `),
    });

    let history = await db.getChatHistory(opts.session);
    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();
      if (!input) { rl.prompt(); return; }

      // ── /exit ──────────────────────────────────────────────────────────────
      if (input === '/exit') {
        console.log(chalk.gray('\nBye!\n'));
        await db.close();
        process.exit(0);
      }

      // ── /history ───────────────────────────────────────────────────────────
      if (input === '/history') {
        renderHistory(history);
        rl.prompt();
        return;
      }

      // ── /clear ─────────────────────────────────────────────────────────────
      if (input === '/clear') {
        history = [];
        console.log(chalk.gray('\n  Context cleared (DB history preserved).\n'));
        rl.prompt();
        return;
      }

      // ── /profiles ──────────────────────────────────────────────────────────
      if (input === '/profiles') {
        const profs = await db.getDataProfiles(5);
        if (profs.length === 0) {
          console.log(chalk.yellow('\n  No data profiles found. Run: node src/index.js import <file>\n'));
        } else {
          renderInfoBox('📊 DATA PROFILES', profs.map(p => [p.raw_table_name, p.dataset_summary || '']));
        }
        rl.prompt();
        return;
      }

      // ── /import <filepath> ─────────────────────────────────────────────────
      if (input.startsWith('/import ')) {
        const filepath = input.slice(8).trim();
        if (!filepath) {
          console.log(chalk.yellow('\n  Usage: /import <path-to-xlsx>\n'));
        } else {
          console.log(chalk.gray(`\n  Importing ${filepath} ...\n`));
          await importData(filepath, db);
          history = await db.getChatHistory(opts.session);
        }
        rl.prompt();
        return;
      }

      // ── regular query ──────────────────────────────────────────────────────
      try {
        const response = await llm.chat(input, opts.session, opts.user, history);
        console.log(chalk.green('\nAI> ' + response + '\n'));
        history = await db.getChatHistory(opts.session);
      } catch (error) {
        console.log(chalk.red('\n✗ ' + error.message + '\n'));
      }

      rl.prompt();
    });

    rl.on('close', async () => {
      await db.close();
      process.exit(0);
    });
  });

// ─── import ───────────────────────────────────────────────────────────────────

program
  .command('import')
  .argument('<filepath>', 'Path to .xlsx file')
  .action(async (filepath) => {
    await db.connect();
    await importData(filepath, db);
    await db.close();
  });

// ─── profiles ─────────────────────────────────────────────────────────────────

program
  .command('profiles')
  .action(async () => {
    await db.connect();
    const profs = await db.getDataProfiles(10);
    if (profs.length === 0) {
      console.log(chalk.yellow('\n  No data profiles found.\n'));
    } else {
      renderInfoBox('📊 DATA PROFILES', profs.map(p => [p.raw_table_name, p.dataset_summary || '']));
    }
    await db.close();
  });

// ─── wipe-db ──────────────────────────────────────────────────────────────────

program
  .command('wipe-db')
  .action(async () => {
    await db.connect();
    await db.wipeDatabase();
    await db.close();
  });

// ─── Default to chat ──────────────────────────────────────────────────────────

if (process.argv.length === 2) {
  process.argv.push('chat');
}

program.parse();
