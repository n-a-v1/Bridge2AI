/**
 * data.test.js — Data accuracy tests against the Bridge2AI supply-chain dataset
 *
 * Tests are skipped automatically when the dataset has not been imported yet.
 * Ground truth is sourced from manual PDF checks (github/res_2026_02_27).
 *
 * The correct table is detected at runtime by searching for any raw_import_*
 * table that contains the expected Bridge2AI columns (OrderDtl_NeedByDate,
 * zLateCount2, Customer_Name). This makes the tests independent of import order
 * — the table ID does not need to be "1".
 *
 * Run with: npm test
 * Requires:  MySQL + at least one data file imported via:
 *   node src/index.js import <file>      (or)
 *   node scripts/import-all-data.js
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from '../src/database.js';

// ---------------------------------------------------------------------------
// Top-level await: detect the Bridge2AI dataset table before any test runs
// ---------------------------------------------------------------------------

const _db = new Database();
await _db.connect();

// Find a raw_import_* table that has the key Bridge2AI supply-chain columns
const [_candidateRows] = await _db.connection.query(`
  SELECT TABLE_NAME
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   LIKE 'raw_import_%'
    AND COLUMN_NAME  = 'OrderDtl_NeedByDate'
  GROUP BY TABLE_NAME
  ORDER BY TABLE_NAME ASC
  LIMIT 1
`);

const DATA_TABLE = _candidateRows[0]?.TABLE_NAME ?? null;
const HAS_DATA   = !!DATA_TABLE;

await _db.close();

// ---------------------------------------------------------------------------
// Shared DB instance
// ---------------------------------------------------------------------------

let db;

beforeAll(async () => {
  db = new Database();
  await db.connect();
});

afterAll(async () => {
  await db.close();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function q(sql) {
  // Replace the placeholder token with the detected table name
  return db.executeQuery(sql.replace(/`DATA_TABLE`/g, `\`${DATA_TABLE}\``));
}

// ---------------------------------------------------------------------------
// Q1 — Late orders in December 2025
// Ground truth: IBC SUPPLY CHAIN SOLUTIONS LTD appears in results
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_DATA)('Q1 — Late orders December 2025', () => {
  const SQL = `
    SELECT *
    FROM \`DATA_TABLE\`
    WHERE \`OrderDtl_NeedByDate\` LIKE '12/%/25'
      AND \`zLateCount2\` NOT IN ('$0', '$-', '')
    LIMIT 100
  `;

  let results;
  beforeAll(async () => { results = await q(SQL); });

  it('returns at least one late December 2025 order', () => {
    expect(results.length).toBeGreaterThan(0);
  });

  it('IBC SUPPLY CHAIN SOLUTIONS LTD appears in results', () => {
    const found = results.some(r =>
      (r.Customer_Name || '').toUpperCase().includes('IBC SUPPLY CHAIN')
    );
    expect(found).toBe(true);
  });

  it('all rows have a NeedByDate in December 2025 (LIKE 12/%/25)', () => {
    for (const row of results) {
      expect(row.OrderDtl_NeedByDate).toMatch(/^12\//);
      expect(row.OrderDtl_NeedByDate).toMatch(/\/25$/);
    }
  });

  it('no row has zLateCount2 equal to $0 or $-', () => {
    for (const row of results) {
      expect(['$0', '$-', '']).not.toContain(row.zLateCount2);
    }
  });
});

// ---------------------------------------------------------------------------
// Q2 — Top 5 delayed customers 2024-2025
// Ground truth:
//   #1 TECWISE SISTEMAS DE AUTOMAÇÃO LTDA. → 448
//   Top-5 sum → 1365
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_DATA)('Q2 — Top 5 delayed customers 2024-2025', () => {
  const SQL = `
    SELECT \`Customer_Name\`, COUNT(*) as cnt
    FROM \`DATA_TABLE\`
    WHERE (\`OrderHed_OrderDate\` LIKE '%/24' OR \`OrderHed_OrderDate\` LIKE '%/25')
      AND \`zLateCount2\` NOT IN ('$0', '$-', '')
    GROUP BY \`Customer_Name\`
    ORDER BY cnt DESC
    LIMIT 5
  `;

  let results;
  beforeAll(async () => { results = await q(SQL); });

  it('returns exactly 5 rows', () => {
    expect(results.length).toBe(5);
  });

  it('#1 customer is TECWISE SISTEMAS DE AUTOMAÇÃO LTDA.', () => {
    expect(results[0].Customer_Name).toContain('TECWISE SISTEMAS');
  });

  it('#1 count is 448', () => {
    expect(Number(results[0].cnt)).toBe(448);
  });

  it('top-5 total equals 1365', () => {
    const total = results.reduce((s, r) => s + Number(r.cnt), 0);
    expect(total).toBe(1365);
  });
});

// ---------------------------------------------------------------------------
// Q3 — Most delayed parts in 2025
// Ground truth:
//   #1 EL380004-INST → 76
//   #2 DATA LOGGER-SE → 49
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_DATA)('Q3 — Most delayed parts 2025', () => {
  const SQL = `
    SELECT \`ShipDtl_PartNum\`, COUNT(*) as delay_count
    FROM \`DATA_TABLE\`
    WHERE \`OrderHed_OrderDate\` LIKE '%/25'
      AND \`zLateCount2\` NOT IN ('$0', '$-', '')
    GROUP BY \`ShipDtl_PartNum\`
    ORDER BY delay_count DESC
    LIMIT 10
  `;

  let results;
  beforeAll(async () => { results = await q(SQL); });

  it('returns at least 2 rows', () => {
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('#1 part is EL380004-INST', () => {
    expect(results[0].ShipDtl_PartNum).toBe('EL380004-INST');
  });

  it('#1 delay count is 76', () => {
    expect(Number(results[0].delay_count)).toBe(76);
  });

  it('#2 part is DATA LOGGER-SE', () => {
    expect(results[1].ShipDtl_PartNum).toBe('DATA LOGGER-SE');
  });

  it('#2 delay count is 49', () => {
    expect(Number(results[1].delay_count)).toBe(49);
  });
});

// ---------------------------------------------------------------------------
// Q3b — Parts with 50–100 delays in 2025 (range filter)
// Ground truth: EXACTLY 1 part — EL380004-INST (76)
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_DATA)('Q3b — Parts in 50–100 delay range 2025', () => {
  const SQL = `
    SELECT \`ShipDtl_PartNum\`, COUNT(*) as delay_count
    FROM \`DATA_TABLE\`
    WHERE \`OrderHed_OrderDate\` LIKE '%/25'
      AND \`zLateCount2\` NOT IN ('$0', '$-', '')
    GROUP BY \`ShipDtl_PartNum\`
    HAVING delay_count BETWEEN 50 AND 100
    ORDER BY delay_count DESC
  `;

  let results;
  beforeAll(async () => { results = await q(SQL); });

  it('returns exactly 1 row in the 50–100 range', () => {
    expect(results.length).toBe(1);
  });

  it('that part is EL380004-INST with delay_count 76', () => {
    expect(results[0].ShipDtl_PartNum).toBe('EL380004-INST');
    expect(Number(results[0].delay_count)).toBe(76);
  });
});

// ---------------------------------------------------------------------------
// Q4 — Operator precedence correctness
// Bug: OR without parens lets AND steal the right operand.
//   WRONG:  A LIKE '%/25' OR A LIKE '%/26' AND zLate NOT IN (...)
//   CORRECT: (A LIKE '%/25' OR A LIKE '%/26') AND zLate NOT IN (...)
// The two queries must return different counts; correct returns fewer.
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_DATA)('Q4 — SQL operator precedence (AND/OR bug)', () => {
  const SQL_WRONG = `
    SELECT COUNT(*) as cnt
    FROM \`DATA_TABLE\`
    WHERE \`OrderHed_OrderDate\` LIKE '%/25'
       OR \`OrderHed_OrderDate\` LIKE '%/26'
      AND \`zLateCount2\` NOT IN ('$0', '$-', '')
  `;

  const SQL_CORRECT = `
    SELECT COUNT(*) as cnt
    FROM \`DATA_TABLE\`
    WHERE (\`OrderHed_OrderDate\` LIKE '%/25' OR \`OrderHed_OrderDate\` LIKE '%/26')
      AND \`zLateCount2\` NOT IN ('$0', '$-', '')
  `;

  let wrongCount;
  let correctCount;

  beforeAll(async () => {
    const [w, c] = await Promise.all([q(SQL_WRONG), q(SQL_CORRECT)]);
    wrongCount  = Number(w[0].cnt);
    correctCount = Number(c[0].cnt);
  });

  it('the two queries return DIFFERENT row counts (precedence matters)', () => {
    expect(wrongCount).not.toBe(correctCount);
  });

  it('the WRONG (no-parens) version returns MORE rows than correct', () => {
    expect(wrongCount).toBeGreaterThan(correctCount);
  });

  it('the CORRECT (parenthesised) version returns a non-zero count', () => {
    expect(correctCount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Q5 — Customer order frequency 2024-2025
// Ground truth:
//   #1 TECWISE SISTEMAS DE AUTOMAÇÃO LTDA. → 641
//   #2 Suncor Energy Oil Sands Limited → 591
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_DATA)('Q5 — Customer order frequency 2024-2025', () => {
  const SQL = `
    SELECT \`Customer_Name\`, COUNT(*) as total_ordered
    FROM \`DATA_TABLE\`
    WHERE (\`OrderHed_OrderDate\` LIKE '%/24' OR \`OrderHed_OrderDate\` LIKE '%/25')
    GROUP BY \`Customer_Name\`
    ORDER BY total_ordered DESC
    LIMIT 5
  `;

  let results;
  beforeAll(async () => { results = await q(SQL); });

  it('returns at least 2 rows', () => {
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('#1 customer is TECWISE SISTEMAS with 641 total orders', () => {
    expect(results[0].Customer_Name).toContain('TECWISE SISTEMAS');
    expect(Number(results[0].total_ordered)).toBe(641);
  });

  it('#2 customer is Suncor Energy Oil Sands Limited with 591 total orders', () => {
    expect(results[1].Customer_Name).toContain('Suncor');
    expect(Number(results[1].total_ordered)).toBe(591);
  });
});

// ---------------------------------------------------------------------------
// Q3c — First and Last December 2025 order by ShipDtl_OrderNum
// Ground truth:
//   First (ASC): 243213 — IBC SUPPLY CHAIN SOLUTIONS LTD
//   Last  (DESC): 243980 — Site Engineering Surveys Ltd.
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_DATA)('Q3c — First and Last December 2025 orders', () => {
  const SQL_FIRST = `
    SELECT \`ShipDtl_OrderNum\`, \`Customer_Name\`
    FROM \`DATA_TABLE\`
    WHERE \`OrderDtl_NeedByDate\` LIKE '12/%/25'
    ORDER BY \`ShipDtl_OrderNum\` ASC
    LIMIT 1
  `;

  const SQL_LAST = `
    SELECT \`ShipDtl_OrderNum\`, \`Customer_Name\`
    FROM \`DATA_TABLE\`
    WHERE \`OrderDtl_NeedByDate\` LIKE '12/%/25'
    ORDER BY \`ShipDtl_OrderNum\` DESC
    LIMIT 1
  `;

  let first;
  let last;

  beforeAll(async () => {
    const [f, l] = await Promise.all([q(SQL_FIRST), q(SQL_LAST)]);
    first = f[0];
    last  = l[0];
  });

  it('first December 2025 order number is 243213', () => {
    expect(String(first.ShipDtl_OrderNum)).toBe('243213');
  });

  it('first order belongs to IBC SUPPLY CHAIN', () => {
    expect((first.Customer_Name || '').toUpperCase()).toContain('IBC SUPPLY CHAIN');
  });

  it('last December 2025 order number is 243980', () => {
    expect(String(last.ShipDtl_OrderNum)).toBe('243980');
  });

  it('last order belongs to Site Engineering Surveys', () => {
    expect(last.Customer_Name || '').toMatch(/Site Engineering/i);
  });
});

// ---------------------------------------------------------------------------
// Q6 — Customers with ≤5 orders in 2025-2026
// All returned rows must have count ≤ 5 and count > 0
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_DATA)('Q6 — Customers with ≤5 orders 2025-2026', () => {
  const SQL = `
    SELECT \`Customer_Name\`, COUNT(*) as cnt
    FROM \`DATA_TABLE\`
    WHERE (\`OrderHed_OrderDate\` LIKE '%/25' OR \`OrderHed_OrderDate\` LIKE '%/26')
    GROUP BY \`Customer_Name\`
    HAVING cnt <= 5
    ORDER BY cnt ASC
    LIMIT 100
  `;

  let results;
  beforeAll(async () => { results = await q(SQL); });

  it('returns at least one low-frequency customer', () => {
    expect(results.length).toBeGreaterThan(0);
  });

  it('all returned customers have 5 or fewer orders', () => {
    for (const row of results) {
      expect(Number(row.cnt)).toBeLessThanOrEqual(5);
    }
  });

  it('all returned counts are positive (no zero-count rows)', () => {
    for (const row of results) {
      expect(Number(row.cnt)).toBeGreaterThan(0);
    }
  });
});
