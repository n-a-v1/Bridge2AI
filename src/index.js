#!/usr/bin/env node
// src/index.js  –  Main CLI entry point
import { program } from 'commander';
import readline from 'readline';
import chalk from 'chalk';
import Database from './database.js';
import LLMManager from './llm-manager.js';
import { importData } from './import-data.js';

// ── Commands ────────────────────────────────────────────

program
  .name('js-llm-manager')
  .description('JavaScript AI LLM Manager with MySQL persistence')
  .version('1.0.0');

// ── add-key ─────────────────────────────────────────────

program
  .command('add-key')
  .description('Add an API key for a provider')
  .argument('<provider>', 'Provider name (anthropic, openai, gemini)')
  .argument('<apiKey>', 'API key')
  .argument('[model]', 'Optional: specific model name')
  .action(async (provider, apiKey, model) => {
    const db = new Database();
    await db.connect();

    await db.saveApiKey(provider, apiKey, model || null);
    console.log(chalk.green(`✓ API key saved for ${provider}`));

    // Auto-detect Claude model if Anthropic and no model given
    if (provider === 'anthropic' && !model) {
      console.log(chalk.blue('🔍 Detecting compatible Claude model...'));
      const llm = new LLMManager(db);
      try {
        const detectedModel = await llm.detectAnthropicModel(apiKey);
        await db.saveApiKey(provider, apiKey, detectedModel);
        console.log(chalk.green(`✓ Detected and saved model: ${detectedModel}`));
      } catch (err) {
        console.error(chalk.red(`✗ Model detection failed: ${err.message}`));
        console.log(chalk.yellow('  You can specify a model manually:'));
        console.log(chalk.yellow(`  node src/index.js add-key ${provider} ${apiKey} claude-3-haiku-20240307`));
      }
    }

    await db.close();
  });

// ── list-keys ───────────────────────────────────────────

program
  .command('list-keys')
  .description('List all stored API keys')
  .action(async () => {
    const db = new Database();
    await db.connect();
    const keys = await db.listApiKeys();
    if (keys.length === 0) {
      console.log(chalk.yellow('No API keys stored.'));
    } else {
      console.log(chalk.cyan('\nStored API keys:'));
      for (const k of keys) {
        console.log(`  ${k.provider} | model: ${k.model_name || '(auto)'} | active: ${k.is_active ? 'yes' : 'no'}`);
      }
      console.log('');
    }
    await db.close();
  });

// ── chat ────────────────────────────────────────────────

program
  .command('chat')
  .description('Start a chat session')
  .option('-p, --provider <provider>', 'AI provider', 'anthropic')
  .option('-m, --model <model>', 'Specific model name')
  .option('-s, --session <session>', 'Session ID', 'default')
  .option('-u, --user <user>', 'User name', process.env.USER || 'user')
  .action(async (options) => {
    const db = new Database();
    const llm = new LLMManager(db);
    await db.connect();

    if (!(await llm.setProvider(options.provider, options.model))) {
      await db.close();
      return;
    }

    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.cyan('  AI LLM Manager – Chat Session'));
    console.log(chalk.cyan(`  Session: ${options.session} | User: ${options.user}`));
    console.log(chalk.cyan(`  Provider: ${options.provider} | Model: ${llm.model}`));
    console.log(chalk.cyan('='.repeat(60)));
    console.log(chalk.gray('\nCommands: /history  /clear  /import <file>  /bias  /exit'));
    console.log('Type your message and press Enter.\n');

    // Load existing chat history
    let history = await db.getChatHistory(options.session);

    if (history.length > 0) {
      console.log(chalk.gray(`--- Previous messages (${history.length}) ---`));
      for (const msg of history.slice(-5)) {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const role = msg.role.toUpperCase();
        const preview = msg.content.substring(0, 100);
        console.log(chalk.gray(`[${time}] ${role}: ${preview}${msg.content.length > 100 ? '...' : ''}`));
      }
      console.log('');
    }

    // Interactive chat loop
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.yellow(`${options.user}> `),
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();

      if (!input) { rl.prompt(); return; }

      // ── Slash commands ──
      if (input === '/exit' || input === '/quit') {
        console.log(chalk.gray('\nGoodbye!'));
        rl.close();
        await db.close();
        process.exit(0);
      }

      if (input === '/history') {
        history = await db.getChatHistory(options.session);
        console.log(chalk.cyan('\n--- Chat History ---'));
        for (const msg of history) {
          const time = new Date(msg.timestamp).toLocaleTimeString();
          const prefix = msg.role === 'user' ? chalk.yellow('YOU') : chalk.green('AI');
          console.log(`[${time}] ${prefix}: ${msg.content}`);
        }
        console.log('');
        rl.prompt();
        return;
      }

      if (input === '/clear') {
        history = [];
        console.log(chalk.green('✓ Context cleared (history preserved in DB)\n'));
        rl.prompt();
        return;
      }

      if (input === '/bias') {
        const logs = await db.getBiasLogs(5);
        if (logs.length === 0) {
          console.log(chalk.yellow('\nNo bias logs yet. Import data first: /import <file>\n'));
        } else {
          console.log(chalk.cyan('\n--- AI Bias Logs ---'));
          for (const log of logs) {
            console.log(chalk.white(log.findings));
            console.log(chalk.yellow(log.bias_adjustments));
            console.log(chalk.gray(`Confidence: ${log.confidence_score}%`));
            console.log('---');
          }
          console.log('');
        }
        rl.prompt();
        return;
      }

      if (input.startsWith('/import ')) {
        const filepath = input.substring(8).trim();
        console.log(chalk.blue(`\n📥 Importing data from ${filepath}...\n`));
        try {
          await importData(filepath, db);
        } catch (err) {
          console.error(chalk.red(`✗ Import error: ${err.message}`));
        }
        console.log('');
        rl.prompt();
        return;
      }

      // ── Normal chat message ──
      try {
        process.stdout.write(chalk.gray('Thinking...\r'));
        const response = await llm.chat(input, options.session, options.user, history);
        // Clear "Thinking..." line
        process.stdout.write('              \r');
        console.log(chalk.green(`\nAI> ${response}\n`));
        history = await db.getChatHistory(options.session);
      } catch (error) {
        console.log(chalk.red(`\n✗ Error: ${error.message}\n`));
      }

      rl.prompt();
    });

    rl.on('close', async () => {
      await db.close();
      process.exit(0);
    });
  });

// ── import ──────────────────────────────────────────────

program
  .command('import')
  .description('Import training data from CSV or Excel file')
  .argument('<filepath>', 'Path to data file')
  .action(async (filepath) => {
    const db = new Database();
    await db.connect();
    await importData(filepath, db);
    await db.close();
  });

// ── set-prompt ──────────────────────────────────────────

program
  .command('set-prompt')
  .description('Set a custom system prompt for the AI')
  .argument('<prompt>', 'System prompt text')
  .action(async (prompt) => {
    const db = new Database();
    await db.connect();
    await db.setSystemConfig('system_prompt', prompt, 'Custom AI system prompt');
    console.log(chalk.green('✓ System prompt updated'));
    await db.close();
  });

// ── wipe-keys ───────────────────────────────────────────

program
  .command('wipe-keys')
  .description('Delete all API keys')
  .action(async () => {
    const db = new Database();
    await db.connect();
    await db.wipeApiKeys();
    await db.close();
  });

// ── wipe-db ─────────────────────────────────────────────

program
  .command('wipe-db')
  .description('Wipe entire database (WARNING: deletes everything!)')
  .action(async () => {
    const db = new Database();
    await db.connect();
    console.log(chalk.red('⚠️  WARNING: This will delete ALL data!'));

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Type "yes" to confirm: ', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        await db.wipeDatabase();
      } else {
        console.log('Cancelled.');
      }
      rl.close();
      await db.close();
    });
  });

// ── Default to chat if no args ──────────────────────────

if (process.argv.length === 2) {
  process.argv.push('chat');
}

program.parse();
