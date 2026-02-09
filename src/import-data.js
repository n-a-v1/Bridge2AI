// src/import-data.js
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { analyzeBias } from './bias-analyzer.js';

export async function importData(filepath, db) {
  try {
    const resolvedPath = path.resolve(filepath);

    if (!fs.existsSync(resolvedPath)) {
      console.log(chalk.red(`✗ File not found: ${resolvedPath}`));
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const filename = path.basename(resolvedPath);

    console.log(chalk.blue(`📊 Processing: ${filename}`));

    let data, columns;

    if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(resolvedPath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(sheet);
      columns = Object.keys(data[0] || {});
    } else if (ext === '.csv') {
      const Papa = (await import('papaparse')).default;
      const fileContent = fs.readFileSync(resolvedPath, 'utf8');
      const result = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      data = result.data;
      columns = result.meta.fields || [];
    } else {
      console.log(chalk.red('✗ Unsupported file type. Use .xlsx, .xls, or .csv'));
      return;
    }

    const rows = data.length;
    console.log(chalk.green(`✓ Parsed ${rows} rows, ${columns.length} columns`));
    console.log(chalk.gray(`  Columns: ${columns.slice(0, 8).join(', ')}${columns.length > 8 ? '...' : ''}`));

    // Save import record
    const importId = await db.saveDataImport(
      filename, ext.substring(1), rows, columns.length,
      'completed', null,
      { columns, sample: data.slice(0, 3) }
    );

    // Generate training entries from data
    await processDataForTraining(data, columns, db, filename);

    // AI bias analysis
    console.log(chalk.blue('\n🤖 Analyzing data and generating bias adjustments...\n'));
    await analyzeBias(data, columns, db, importId, filename);

    console.log(chalk.green(`\n✓ Data import complete! Import ID: ${importId}`));

  } catch (error) {
    console.error(chalk.red(`✗ Import error: ${error.message}`));

    try {
      await db.saveDataImport(
        path.basename(filepath), path.extname(filepath).substring(1),
        0, 0, 'failed', error.message, null
      );
    } catch { /* ignore secondary error */ }
  }
}

// ── Training data generation ────────────────────────────

async function processDataForTraining(data, columns, db, filename) {
  // Detect category
  let category = 'general';
  if (filename.includes('COTD') || columns.some(c => c.includes('Customer'))) {
    category = 'customer_otd';
  } else if (filename.includes('MOTD') || columns.some(c => c.includes('Manufacturing'))) {
    category = 'manufacturing_otd';
  } else if (filename.includes('Purchase') || columns.some(c => c.includes('Vendor'))) {
    category = 'purchase_otd';
  } else if (filename.includes('Budget') || filename.includes('Rev')) {
    category = 'revenue_budget';
  } else if (filename.includes('Target')) {
    category = 'targets';
  }

  const stats = calculateStats(data, columns);
  const trainingEntries = [];

  // Record count
  trainingEntries.push({
    category,
    question: `How many ${category.replace(/_/g, ' ')} records are in the dataset?`,
    answer: `The dataset contains ${data.length} ${category.replace(/_/g, ' ')} records across ${columns.length} fields.`,
    metadata: { source: filename, type: 'count' },
  });

  // Column summary
  trainingEntries.push({
    category,
    question: `What fields are available in the ${category.replace(/_/g, ' ')} data?`,
    answer: `The dataset includes these columns: ${columns.join(', ')}.`,
    metadata: { source: filename, type: 'schema' },
  });

  // Stats-based entries
  for (const [col, colStats] of Object.entries(stats)) {
    if (colStats.type === 'numeric' && colStats.mean !== undefined) {
      trainingEntries.push({
        category,
        question: `What is the average ${col}?`,
        answer: `The average ${col} is ${colStats.mean.toFixed(2)} (min: ${colStats.min}, max: ${colStats.max}, count: ${colStats.count}).`,
        metadata: { source: filename, column: col, type: 'statistic' },
      });
    } else if (colStats.type === 'categorical' && colStats.unique <= 30) {
      trainingEntries.push({
        category,
        question: `What are the distinct values for ${col}?`,
        answer: `There are ${colStats.unique} unique values. Sample: ${colStats.sample.join(', ')}.`,
        metadata: { source: filename, column: col, type: 'categorical' },
      });
    }
  }

  // Save all
  for (const entry of trainingEntries) {
    await db.addTrainingData(entry.category, entry.question, entry.answer, entry.metadata);
  }

  console.log(chalk.green(`✓ Created ${trainingEntries.length} training entries (category: ${category})`));
}

// ── Statistics helper ───────────────────────────────────

function calculateStats(data, columns) {
  const stats = {};

  for (const col of columns) {
    const values = data.map(row => row[col]).filter(v => v != null && v !== '');

    if (values.length === 0) continue;

    const numericValues = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));

    if (numericValues.length > values.length * 0.8) {
      stats[col] = {
        type: 'numeric',
        count: numericValues.length,
        mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
      };
    } else {
      const uniqueValues = [...new Set(values)];
      stats[col] = {
        type: 'categorical',
        count: values.length,
        unique: uniqueValues.length,
        sample: uniqueValues.slice(0, 5),
      };
    }
  }

  return stats;
}
