// scripts/setup-db.js
import Database from '../src/database.js';
import chalk from 'chalk';

async function setupDatabase() {
  console.log(chalk.cyan('\n🔧 Setting up database...\n'));

  const db = new Database();
  await db.connect();

  console.log(chalk.green('\n✓ Database setup complete!'));
  console.log(chalk.gray('  All tables created. Ready for use.\n'));

  await db.close();
}

setupDatabase().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
