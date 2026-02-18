#!/usr/bin/env node
import { program } from 'commander';
import readline from 'readline';
import chalk from 'chalk';
import Database from './database.js';
import LLMManager from './llm-manager.js';
import { importData } from './import-data.js';

const db = new Database();
const llm = new LLMManager(db);

program
  .name('js-llm-manager')
  .version('3.0.0-PRODUCTION');

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
      console.log(chalk.green('✓ Detected: '+model));
    }
    await db.close();
  });

program
  .command('chat')
  .action(async () => {
    await db.connect();
    
    if (!await llm.setProvider('anthropic')) {
      await db.close();
      return;
    }

    console.log(chalk.cyan('\n'+'='.repeat(60)));
    console.log(chalk.cyan('  AI LLM Manager - SQL Query System'));
    console.log(chalk.cyan('='.repeat(60)));
    console.log(chalk.gray('\nCommands: /exit, /profiles\n'));

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.yellow('nick> ')
    });

    let history = await db.getChatHistory('default');
    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();
      
      if (!input) { rl.prompt(); return; }
      if (input === '/exit') {
        console.log(chalk.gray('\nBye!'));
        await db.close();
        process.exit(0);
      }

      if (input === '/profiles') {
        const profs = await db.getDataProfiles(5);
        console.log(chalk.cyan('\n--- Data Profiles ---'));
        for (const p of profs) {
          console.log('Table: '+p.raw_table_name);
          console.log('Info: '+p.dataset_summary+'\n');
        }
        rl.prompt();
        return;
      }

      try {
        const response = await llm.chat(input, 'default', 'nick', history);
        console.log(chalk.green('\nAI> '+response+'\n'));
        history = await db.getChatHistory('default');
      } catch (error) {
        console.log(chalk.red('\n✗ '+error.message+'\n'));
      }

      rl.prompt();
    });

    rl.on('close', async () => {
      await db.close();
      process.exit(0);
    });
  });

program
  .command('import')
  .argument('<filepath>', 'Path to .xlsx file')
  .action(async (filepath) => {
    await db.connect();
    await importData(filepath, db);
    await db.close();
  });

program
  .command('profiles')
  .action(async () => {
    await db.connect();
    const profs = await db.getDataProfiles(10);
    console.log(chalk.cyan('\n--- Data Profiles ---\n'));
    for (const p of profs) {
      console.log('Table: '+p.raw_table_name);
      console.log('Info: '+p.dataset_summary+'\n');
    }
    await db.close();
  });

program
  .command('wipe-db')
  .action(async () => {
    await db.connect();
    await db.wipeDatabase();
    await db.close();
  });

if (process.argv.length === 2) {
  process.argv.push('chat');
}

program.parse();
