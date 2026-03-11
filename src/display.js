/**
 * display.js — Rich terminal output for the AI SQL query system.
 *
 * Provides: scan box, SQL box, results table (presentation mode),
 *           raw JSON output (raw mode), history view, info box.
 *
 * No DB writes. No API calls. Pure chalk + cli-table3 formatting.
 */

import chalk from 'chalk';
import Table from 'cli-table3';

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const ANSI_RE = /\x1B\[[0-9;]*m/g;

/** Visible character length — ignores ANSI escape codes */
function visLen(str) {
  return String(str).replace(ANSI_RE, '').length;
}

/** Pad/truncate to exact visible width, ANSI-safe */
function pad(str, width) {
  const s = String(str ?? '');
  const vl = visLen(s);
  if (vl > width) return s.replace(ANSI_RE, '').slice(0, width - 1) + '…';
  return s + ' '.repeat(width - vl);
}

// ─── Box drawing ──────────────────────────────────────────────────────────────

const BOX_W = 58; // inner content width (excluding side borders)

function boxLine(content, color = chalk.cyan) {
  return color('║ ') + pad(content, BOX_W - 2) + color(' ║');
}

function boxTop(title, color = chalk.cyan) {
  const t = title ? ` ${title} ` : '';
  const left  = Math.floor((BOX_W - visLen(t)) / 2);
  const right = BOX_W - visLen(t) - left;
  return color('╔' + '═'.repeat(left) + t + '═'.repeat(right) + '╗');
}

function boxDiv(color = chalk.cyan) {
  return color('╠' + '═'.repeat(BOX_W) + '╣');
}

function boxBot(color = chalk.cyan) {
  return color('╚' + '═'.repeat(BOX_W) + '╝');
}

// ─── Key column detection ─────────────────────────────────────────────────────

const KEY_COLUMNS = {
  OrderDtl_NeedByDate:      'date filter (need-by)',
  OrderHed_OrderDate:       'date filter (order)',
  zLateCount2:              'late flag ($N format)',
  Customer_Name:            'customer grouping',
  ShipDtl_PartNum:          'part number',
  ShipDtl_OrderNum:         'order number',
  OrderDtl_SellingQuantity: 'quantity',
};

// ─── Public: Presentation mode ────────────────────────────────────────────────

/**
 * Show a "scanning dataset" box with real stats pulled from the DB.
 * Skips silently if no raw_import_* tables exist.
 */
export async function renderScanBox(db, profiles) {
  if (!profiles || profiles.length === 0) return;

  const tableName = profiles[0].raw_table_name;
  let rowCount = '?';
  let colCount = '?';
  let keyFound = [];

  try {
    const countRes = await db.executeQuery(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
    rowCount = Number(countRes[0].cnt).toLocaleString();

    const colRes = await db.executeQuery(`SHOW COLUMNS FROM \`${tableName}\``);
    colCount = colRes.length - 1; // minus the auto id column
    keyFound = colRes
      .map(r => r.Field)
      .filter(f => KEY_COLUMNS[f])
      .slice(0, 4);
  } catch (_) {
    return; // table not accessible, skip silently
  }

  console.log();
  console.log(boxTop('🔍 SCANNING DATASET'));
  console.log(boxLine(''));
  console.log(boxLine('  Table  : ' + chalk.yellow(tableName)));
  console.log(boxLine('  Rows   : ' + chalk.green(rowCount)));
  console.log(boxLine('  Cols   : ' + chalk.green(String(colCount))));

  if (keyFound.length > 0) {
    console.log(boxDiv());
    console.log(boxLine('  Key columns detected:'));
    for (const col of keyFound) {
      console.log(boxLine('    • ' + col + chalk.gray(' — ' + KEY_COLUMNS[col])));
    }
  }

  console.log(boxBot());
  console.log();
}

/**
 * Render the generated SQL in a highlighted box.
 */
export function renderSQL(sql) {
  const lines = sql.trim().split('\n');
  const innerW = BOX_W;
  const top = chalk.blue('┌' + '─ SQL GENERATED ' + '─'.repeat(innerW - 15) + '┐');
  const bot = chalk.blue('└' + '─'.repeat(innerW + 2) + '┘');

  console.log(top);
  for (const line of lines) {
    const trimmed = line.trim();
    const colored = trimmed
      .replace(/\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|AND|OR|NOT IN|LIKE|COUNT|SUM|AVG|AS|CAST|REPLACE|BETWEEN)\b/g,
        m => chalk.magenta(m))
      .replace(/`[^`]+`/g, m => chalk.yellow(m))
      .replace(/"[^"]*"|'[^']*'/g, m => chalk.green(m));
    // Use plain text length for the right border — pad by visible length
    const plain = trimmed.replace(/\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|AND|OR|NOT IN|LIKE|COUNT|SUM|AVG|AS|CAST|REPLACE|BETWEEN)\b/g, m => m).replace(/`[^`]+`/g, m => m).replace(/"[^"]*"|'[^']*'/g, m => m);
    const padding = Math.max(0, innerW - 1 - plain.length);
    console.log(chalk.blue('│') + '  ' + colored + ' '.repeat(padding) + chalk.blue('│'));
  }
  console.log(bot);
  console.log();
}

/**
 * Render query results as a formatted ASCII table (presentation mode).
 * Enforces column widths so the right border never wraps.
 */
export function renderResultsTable(results, rowLimit = 20) {
  if (!results || results.length === 0) {
    console.log(chalk.yellow('  ⚠️  Query returned 0 rows\n'));
    return;
  }

  const cols = Object.keys(results[0]).filter(k => k !== 'id');
  const displayRows = results.slice(0, rowLimit);

  // Compute column widths — cap at 28, min 6
  // Use plain visible lengths only, so total row width stays predictable
  const widths = cols.map(col => {
    const maxVal = Math.max(
      col.length,
      ...displayRows.map(r => String(r[col] ?? '').length)
    );
    return Math.min(28, Math.max(6, maxVal));
  });

  // Build table — plain text in head, let style: { head: ['cyan'] } color it
  // This avoids ANSI-inflated string lengths throwing off border alignment
  const table = new Table({
    head:      cols.map((c, i) => pad(c, widths[i])),
    colWidths: widths.map(w => w + 2),
    style:     { head: ['cyan'], border: ['grey'] },
    chars: {
      top: '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      bottom: '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      left: '│', 'left-mid': '├', mid: '─', 'mid-mid': '┼',
      right: '│', 'right-mid': '┤', middle: '│',
    },
  });

  for (const row of displayRows) {
    table.push(cols.map((c, i) => {
      const val = String(row[c] ?? '');
      return val.length > widths[i] ? val.slice(0, widths[i] - 1) + '…' : val;
    }));
  }

  console.log(chalk.bold.green(
    `\n  🎯 ${results.length} RESULT${results.length !== 1 ? 'S' : ''}` +
    (results.length > rowLimit ? chalk.gray(` (showing first ${rowLimit})`) : '')
  ));
  console.log(table.toString());
  console.log();
}

// ─── Public: Raw mode ─────────────────────────────────────────────────────────

/**
 * Emit results as clean JSON (raw mode).
 * Suitable for Twilio, frontend APIs, or any programmatic consumer.
 */
export function renderRaw(sql, results) {
  return JSON.stringify(
    { query: sql, count: results.length, results },
    null,
    2
  );
}

// ─── Public: History, Info ────────────────────────────────────────────────────

/**
 * Render chat history in a readable format for /history command.
 */
export function renderHistory(messages) {
  if (!messages || messages.length === 0) {
    console.log(chalk.gray('\n  No history in this session.\n'));
    return;
  }

  console.log();
  console.log(chalk.cyan('╔' + '═'.repeat(BOX_W) + '╗'));
  console.log(boxLine(chalk.bold('  CHAT HISTORY')));
  console.log(chalk.cyan('╚' + '═'.repeat(BOX_W) + '╝'));
  console.log();

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'user') {
      console.log(chalk.yellow(`  [${i + 1}] You:`));
      console.log(chalk.white('    ' + m.content.replace(/\n/g, '\n    ')));
    } else {
      console.log(chalk.green(`  [${i + 1}] AI:`));
      const preview = m.content.length > 300
        ? m.content.slice(0, 300) + chalk.gray('… [truncated]')
        : m.content;
      console.log(chalk.white('    ' + preview.replace(/\n/g, '\n    ')));
    }
    console.log();
  }
}

/**
 * Render a key→value info box (used for list-keys, profiles, etc.)
 */
export function renderInfoBox(title, rows) {
  console.log();
  console.log(boxTop(title));
  for (const [label, value] of rows) {
    const labelStr = String(label).padEnd(16);
    console.log(boxLine('  ' + chalk.cyan(labelStr) + ' ' + String(value)));
  }
  console.log(boxBot());
  console.log();
}
