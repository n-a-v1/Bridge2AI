/**
 * import.test.js — Integration tests for XLSX importData()
 *
 * Creates a minimal XLSX fixture programmatically (5 rows, 5 cols).
 * Imports it, verifies DB state. Cleans up in afterAll.
 *
 * Requires: MySQL running, xlsx package installed (already a project dep)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import XLSX from 'xlsx';
import Database from '../src/database.js';
import { importData } from '../src/import-data.js';

// Derive __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename).replace(/\\/g, '/');

const RUN_ID = `test_${Date.now()}`;
const FIXTURE_NAME = `test_fixture_${RUN_ID}.xlsx`;
const FIXTURE_PATH = `${__dirname}/${FIXTURE_NAME}`;

// Second fixture for the "multiple imports" test
const FIXTURE2_NAME = `test_fixture2_${RUN_ID}.xlsx`;
const FIXTURE_PATH2 = `${__dirname}/${FIXTURE2_NAME}`;

const FIXTURE_ROWS = 5;
const FIXTURE_COLS = 5;

// Track import IDs created during this run for cleanup
const createdImportIds = [];

let db;

/**
 * Build a minimal XLSX workbook and write it to disk.
 * Returns { path, rows, cols } for assertions.
 */
function createFixture(filePath, fixtureId = '') {
  const wb = XLSX.utils.book_new();
  const aoa = [
    ['CustomerName', 'OrderDate', 'PartNum', 'Quantity', 'Status'],
    [`Acme Corp${fixtureId}`, '1/15/25', 'PART-001', '10', 'Open'],
    [`Beta Inc${fixtureId}`, '2/20/25', 'PART-002', '5', 'Closed'],
    [`Gamma LLC${fixtureId}`, '3/01/25', 'PART-003', '20', 'Open'],
    [`Delta Co${fixtureId}`, '4/15/25', 'PART-001', '8', 'Open'],
    [`Epsilon Ltd${fixtureId}`, '5/10/25', 'PART-002', '15', 'Closed'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filePath);
}

beforeAll(async () => {
  db = new Database();
  await db.connect();

  // Create fixture files
  createFixture(FIXTURE_PATH, '_A');
  createFixture(FIXTURE_PATH2, '_B');
});

afterAll(async () => {
  // Remove fixture files
  if (fs.existsSync(FIXTURE_PATH)) fs.unlinkSync(FIXTURE_PATH);
  if (fs.existsSync(FIXTURE_PATH2)) fs.unlinkSync(FIXTURE_PATH2);

  // Drop raw_import tables and delete DB records for each import created
  for (const id of createdImportIds) {
    await db.connection.query('DELETE FROM data_profiles WHERE import_id = ?', [id]);
    await db.connection.query('DELETE FROM data_imports WHERE id = ?', [id]);
    await db.connection.query(`DROP TABLE IF EXISTS \`raw_import_${id}\``);
  }

  await db.close();
});

/**
 * Helper: find the import ID for a given filename inserted after a known timestamp.
 * Queries data_imports for the most recent entry matching the filename.
 */
async function getImportIdByFilename(filename) {
  const [rows] = await db.connection.query(
    'SELECT id FROM data_imports WHERE filename = ? ORDER BY id DESC LIMIT 1',
    [filename]
  );
  return rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Happy Path Import
// ---------------------------------------------------------------------------

describe('Happy Path Import', () => {
  let importId;

  it('importData() does not throw for a valid XLSX file', async () => {
    await expect(importData(FIXTURE_PATH, db)).resolves.not.toThrow();
    importId = await getImportIdByFilename(FIXTURE_NAME);
    if (importId) createdImportIds.push(importId);
  });

  it('data_imports record is created with correct filename', async () => {
    expect(importId).not.toBeNull();
    expect(typeof importId).toBe('number');
  });

  it('raw_import_N table is created after import', async () => {
    const [rows] = await db.connection.query(
      `SHOW TABLES LIKE 'raw_import_${importId}'`
    );
    expect(rows.length).toBe(1);
  });

  it('row count in raw table matches fixture row count', async () => {
    const result = await db.executeQuery(
      `SELECT COUNT(*) as cnt FROM \`raw_import_${importId}\``
    );
    expect(result[0].cnt).toBe(FIXTURE_ROWS);
  });

  it('column count in data_imports matches fixture column count', async () => {
    const [rows] = await db.connection.query(
      'SELECT columns_imported FROM data_imports WHERE id = ?',
      [importId]
    );
    expect(rows[0].columns_imported).toBe(FIXTURE_COLS);
  });
});

// ---------------------------------------------------------------------------
// Data Profiles
// ---------------------------------------------------------------------------

describe('Data Profiles', () => {
  let importId;
  let profile;

  beforeAll(async () => {
    importId = await getImportIdByFilename(FIXTURE_NAME);
    if (!importId) return;
    const [rows] = await db.connection.query(
      'SELECT * FROM data_profiles WHERE import_id = ? LIMIT 1',
      [importId]
    );
    profile = rows[0];
  });

  it('data_profiles record is created for the import', () => {
    expect(profile).toBeDefined();
  });

  it('data_profiles.raw_table_name matches expected raw_import_N', () => {
    expect(profile?.raw_table_name).toBe(`raw_import_${importId}`);
  });

  it('column_profiles is valid JSON with column name objects', () => {
    expect(profile?.column_profiles).toBeDefined();
    let cols;
    expect(() => {
      cols = typeof profile.column_profiles === 'string'
        ? JSON.parse(profile.column_profiles)
        : profile.column_profiles;
    }).not.toThrow();
    expect(Array.isArray(cols)).toBe(true);
    expect(cols.length).toBe(FIXTURE_COLS);
    expect(cols[0]).toHaveProperty('name');
  });
});

// ---------------------------------------------------------------------------
// Querying Imported Data
// ---------------------------------------------------------------------------

describe('Querying Imported Data', () => {
  let importId;

  beforeAll(async () => {
    importId = await getImportIdByFilename(FIXTURE_NAME);
  });

  it('imported data is queryable via executeQuery', async () => {
    const result = await db.executeQuery(
      `SELECT * FROM \`raw_import_${importId}\` LIMIT 10`
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('LIKE filter works on imported column values', async () => {
    // All rows from FIXTURE_PATH have Status = 'Open' or 'Closed'
    const result = await db.executeQuery(
      `SELECT * FROM \`raw_import_${importId}\` WHERE \`Status\` LIKE 'Open'`
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    result.forEach(row => expect(row.Status).toBe('Open'));
  });
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  it('importData() does not throw for a missing file path', async () => {
    // importData() catches errors internally — should not propagate
    await expect(
      importData('/nonexistent/path/no_file.xlsx', db)
    ).resolves.not.toThrow();
  });

  it('multiple imports create separate data_imports records', async () => {
    await importData(FIXTURE_PATH2, db);
    const id2 = await getImportIdByFilename(FIXTURE2_NAME);
    if (id2) createdImportIds.push(id2);

    const id1 = await getImportIdByFilename(FIXTURE_NAME);
    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();
    expect(id1).not.toBe(id2);
  });

  it('second import creates a different raw table name than first', async () => {
    const id1 = await getImportIdByFilename(FIXTURE_NAME);
    const id2 = await getImportIdByFilename(FIXTURE2_NAME);
    expect(`raw_import_${id1}`).not.toBe(`raw_import_${id2}`);
  });
});
