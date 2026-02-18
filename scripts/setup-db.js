import Database from '../src/database.js';
import chalk from 'chalk';

async function setup() {
  console.log(chalk.cyan('\n🔧 Setting up database...\n'));
  const db = new Database();
  await db.connect();
  console.log(chalk.green('\n✓ Database ready!\n'));
  await db.close();
}

setup().catch(console.error);
