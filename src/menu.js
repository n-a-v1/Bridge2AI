/**
 * menu.js — Centralized CLI menu rendering and prompt helpers.
 * No DB calls. No API calls. Pure readline + chalk.
 */

import chalk from 'chalk';

const ANSI_RE = /\x1B\[[0-9;]*m/g;
const W = 52; // total box width including side borders

/** Visible character length (ignores ANSI escape codes) */
function visLen(str) {
  return String(str).replace(ANSI_RE, '').length;
}

/** Pad/truncate a string to exact visible width, ANSI-safe */
function pad(str, width) {
  const s = String(str ?? '');
  const vl = visLen(s);
  if (vl > width) {
    // Truncate by visible chars — strip ANSI, slice, add ellipsis
    return s.replace(ANSI_RE, '').slice(0, width - 1) + '…';
  }
  return s + ' '.repeat(width - vl);
}

function boxLine(text = '') {
  return chalk.cyan('║ ') + pad(text, W - 4) + chalk.cyan(' ║');
}

/** App banner shown on startup */
export function drawBanner() {
  const inner = W - 2;
  const title = '  Bridge2AI  —  AI Data Tool  v3.1.0  ';
  const sub   = '  Supply-chain intelligence. SQL-powered.  ';
  console.log('\n' + chalk.cyan('╔' + '═'.repeat(inner) + '╗'));
  console.log(chalk.cyan('║') + chalk.bold.white(pad(title, inner)) + chalk.cyan('║'));
  console.log(chalk.cyan('║') + chalk.gray(pad(sub, inner)) + chalk.cyan('║'));
  console.log(chalk.cyan('╚' + '═'.repeat(inner) + '╝\n'));
}

/**
 * Draw a numbered option menu box.
 * @param {string} title
 * @param {string[]} options
 */
export function drawMenu(title, options) {
  const inner = W - 2;
  console.log('\n' + chalk.cyan('╔' + '═'.repeat(inner) + '╗'));
  console.log(boxLine(chalk.bold.white(title)));
  console.log(chalk.cyan('╠' + '═'.repeat(inner) + '╣'));
  for (let i = 0; i < options.length; i++) {
    const isExit = i === options.length - 1 &&
      (options[i].toLowerCase().includes('back') || options[i].toLowerCase().includes('exit'));
    const label = isExit
      ? chalk.gray(`  ${i + 1}. ${options[i]}`)
      : chalk.white(`  ${i + 1}. ${options[i]}`);
    console.log(boxLine(label));
  }
  console.log(chalk.cyan('╚' + '═'.repeat(inner) + '╝'));
}

/**
 * Draw an info/status box (non-interactive).
 * @param {string} title
 * @param {string[]} lines
 */
export function drawInfoBox(title, lines, color = chalk.cyan) {
  const inner = W - 2;
  console.log('\n' + color('╔' + '═'.repeat(inner) + '╗'));
  console.log(chalk.cyan('║') + chalk.bold.white(pad('  ' + title, inner)) + chalk.cyan('║'));
  console.log(color('╠' + '═'.repeat(inner) + '╣'));
  for (const line of lines) {
    console.log(chalk.cyan('║ ') + pad(line, W - 4) + chalk.cyan(' ║'));
  }
  console.log(color('╚' + '═'.repeat(inner) + '╝\n'));
}
