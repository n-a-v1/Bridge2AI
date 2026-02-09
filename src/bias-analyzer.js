// src/bias-analyzer.js
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

export async function analyzeBias(data, columns, db, importId, filename) {
  const analysis = performDataAnalysis(data, columns, filename);

  const findings = formatFindings(analysis);
  const biasAdjustments = generateBiasAdjustments(analysis);
  const reasoning = generateReasoning(analysis, filename);
  const confidenceScore = calculateConfidence(data.length, columns.length);

  // Save to database
  await db.saveBiasLog(importId, analysis.type, findings, biasAdjustments, reasoning, confidenceScore);

  // Write to journal file
  writeJournalEntry(importId, filename, findings, biasAdjustments, reasoning, confidenceScore);

  // Print summary
  console.log(chalk.cyan('═══ AI BIAS ANALYSIS ═══\n'));
  console.log(chalk.white(findings));
  console.log(chalk.yellow('\n' + biasAdjustments));
  console.log(chalk.gray('\n' + reasoning));
  console.log(chalk.blue(`\n✓ Confidence Score: ${confidenceScore}%`));
}

// ── Core analysis ───────────────────────────────────────

function performDataAnalysis(data, columns, filename) {
  const analysis = {
    filename,
    rowCount: data.length,
    columnCount: columns.length,
    type: detectDataType(filename, columns),
    keyMetrics: {},
  };

  if (analysis.type === 'customer_otd' || filename.includes('COTD')) {
    analysis.keyMetrics = analyzeOTD(data, columns, 'customer');
  } else if (analysis.type === 'manufacturing_otd' || filename.includes('MOTD')) {
    analysis.keyMetrics = analyzeOTD(data, columns, 'manufacturing');
  } else if (analysis.type === 'purchase_otd' || filename.includes('Purchase')) {
    analysis.keyMetrics = analyzeOTD(data, columns, 'purchase');
  } else {
    // Generic numeric summary for other data types
    analysis.keyMetrics = analyzeGeneric(data, columns);
  }

  return analysis;
}

function detectDataType(filename, columns) {
  const fn = filename.toLowerCase();
  const cols = columns.map(c => c.toLowerCase());

  if (fn.includes('cotd') || cols.some(c => c.includes('customer')))  return 'customer_otd';
  if (fn.includes('motd'))                                             return 'manufacturing_otd';
  if (fn.includes('purchase') || cols.some(c => c.includes('vendor'))) return 'purchase_otd';
  if (fn.includes('budget') || fn.includes('rev'))                     return 'revenue_budget';
  if (fn.includes('target'))                                           return 'targets';
  return 'general';
}

// ── OTD-specific analysis ───────────────────────────────

function analyzeOTD(data, columns, type) {
  const metrics = {};

  const otpCols = columns.filter(c =>
    c.toLowerCase().includes('otp') || c.toLowerCase().includes('otd') || c.includes('zOTP')
  );
  const lateCols = columns.filter(c =>
    c.toLowerCase().includes('late') || c.includes('zLateCount')
  );
  const leadTimeCols = columns.filter(c =>
    c.toLowerCase().includes('leadtime') || c.toLowerCase().includes('lead') || c.includes('zLeadTime')
  );

  if (otpCols.length > 0) {
    const vals = data.map(r => r[otpCols[0]]).filter(v => v != null && !isNaN(v)).map(Number);
    if (vals.length > 0) {
      metrics.avgOTP = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
      metrics.otpAbove90 = ((vals.filter(v => v >= 90).length / vals.length) * 100).toFixed(1);
    }
  }

  if (lateCols.length > 0) {
    const vals = data.map(r => r[lateCols[0]]).filter(v => v != null && !isNaN(v)).map(Number);
    if (vals.length > 0) {
      const lateCount = vals.filter(v => v > 0).length;
      metrics.latePercentage = ((lateCount / data.length) * 100).toFixed(1);
    }
  }

  if (leadTimeCols.length > 0) {
    const vals = data.map(r => r[leadTimeCols[0]]).filter(v => v != null && !isNaN(v)).map(Number);
    if (vals.length > 0) {
      metrics.avgLeadTime = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
      metrics.leadTimeMin = Math.min(...vals);
      metrics.leadTimeMax = Math.max(...vals);
    }
  }

  // Vendor analysis for purchase data
  if (type === 'purchase') {
    const vendorCol = columns.find(c => c.includes('Vendor') && c.includes('Name'));
    if (vendorCol) {
      const vendors = [...new Set(data.map(r => r[vendorCol]).filter(Boolean))];
      metrics.uniqueVendors = vendors.length;
      metrics.topVendors = vendors.slice(0, 5);
    }
  }

  return metrics;
}

function analyzeGeneric(data, columns) {
  const metrics = {};
  // Pick first few numeric columns for a quick summary
  for (const col of columns.slice(0, 10)) {
    const vals = data.map(r => r[col]).filter(v => v != null && !isNaN(parseFloat(v))).map(Number);
    if (vals.length > data.length * 0.5) {
      metrics[`avg_${col}`] = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
    }
  }
  return metrics;
}

// ── Formatters ──────────────────────────────────────────

function formatFindings(analysis) {
  let findings = `DATA IMPORT: ${analysis.filename}\n`;
  findings += `Records Analyzed: ${analysis.rowCount.toLocaleString()}\n`;
  findings += `Columns: ${analysis.columnCount}\n`;
  findings += `Data Type: ${analysis.type.replace(/_/g, ' ').toUpperCase()}\n\n`;
  findings += `KEY FINDINGS:\n`;

  let n = 1;
  for (const [key, value] of Object.entries(analysis.keyMetrics)) {
    if (key === 'avgOTP')          findings += `${n}. Average On-Time Performance: ${value}%\n`;
    else if (key === 'otpAbove90') findings += `${n}. Orders with >90% OTP: ${value}%\n`;
    else if (key === 'latePercentage') findings += `${n}. Late Delivery Rate: ${value}%\n`;
    else if (key === 'avgLeadTime')    findings += `${n}. Average Lead Time: ${value} days\n`;
    else if (key === 'uniqueVendors')  findings += `${n}. Unique Vendors: ${value}\n`;
    else if (key === 'topVendors')     findings += `${n}. Top Vendors: ${value.join(', ')}\n`;
    else if (typeof value === 'string' || typeof value === 'number')
      findings += `${n}. ${key}: ${value}\n`;
    else continue;
    n++;
  }

  return findings;
}

function generateBiasAdjustments(analysis) {
  let adj = `BIAS ADJUSTMENTS:\n`;
  const m = analysis.keyMetrics;

  if (m.avgOTP)  adj += `- Benchmark OTP at ${m.avgOTP}% when discussing delivery performance\n`;
  if (m.latePercentage) {
    const lr = parseFloat(m.latePercentage);
    if (lr > 20) adj += `- HIGH ALERT: Late delivery rate of ${m.latePercentage}% requires attention\n`;
    else         adj += `- Late delivery rate of ${m.latePercentage}% is within acceptable range\n`;
  }
  if (m.avgLeadTime)    adj += `- Reference ${m.avgLeadTime} days as standard lead time\n`;
  if (m.uniqueVendors)  adj += `- Vendor pool consists of ${m.uniqueVendors} suppliers\n`;

  adj += `\n- Prioritize data-driven insights over general knowledge\n`;
  adj += `- Reference specific metrics when discussing ${analysis.type.replace(/_/g, ' ')}`;
  return adj;
}

function generateReasoning(analysis) {
  const dt = analysis.type.replace(/_/g, ' ');
  let r = `REASONING:\n`;
  r += `This ${dt} dataset provides concrete performance metrics for ${analysis.rowCount.toLocaleString()} records. `;

  if (analysis.keyMetrics.avgOTP) {
    r += `With an average OTP of ${analysis.keyMetrics.avgOTP}%, this becomes our benchmark for evaluating delivery performance. `;
  }
  if (analysis.keyMetrics.latePercentage && parseFloat(analysis.keyMetrics.latePercentage) > 20) {
    r += `The ${analysis.keyMetrics.latePercentage}% late delivery rate indicates significant room for improvement. `;
  }

  r += `\n\nAI responses will now be adjusted to:\n`;
  r += `1. Reference actual performance data rather than theoretical best practices\n`;
  r += `2. Provide context using these specific metrics\n`;
  r += `3. Identify patterns and anomalies based on this dataset\n`;
  r += `4. Offer recommendations grounded in observed performance trends\n`;
  r += `\nThis ensures responses are tailored to the organization's actual operational data.`;
  return r;
}

function calculateConfidence(rows, columns) {
  let c = 50;
  if      (rows > 10000) c += 30;
  else if (rows > 1000)  c += 20;
  else if (rows > 100)   c += 10;
  if      (columns > 30) c += 15;
  else if (columns > 20) c += 10;
  else if (columns > 10) c += 5;
  return Math.min(c, 95);
}

// ── Journal file writer ─────────────────────────────────

function writeJournalEntry(importId, filename, findings, biasAdjustments, reasoning, confidenceScore) {
  const journalDir = './bias-journal';
  if (!fs.existsSync(journalDir)) fs.mkdirSync(journalDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const journalFile = path.join(journalDir, `import-${importId}-${ts}.txt`);

  const entry = [
    '='.repeat(80),
    'AI BIAS ANALYSIS JOURNAL',
    `Import ID: ${importId}`,
    `File: ${filename}`,
    `Timestamp: ${new Date().toLocaleString()}`,
    `Confidence Score: ${confidenceScore}%`,
    '='.repeat(80),
    '',
    findings,
    '',
    biasAdjustments,
    '',
    reasoning,
    '',
    '='.repeat(80),
    'END OF ANALYSIS',
    '='.repeat(80),
  ].join('\n');

  fs.writeFileSync(journalFile, entry);
  console.log(chalk.gray(`\n📝 Journal entry saved: ${journalFile}`));
}
