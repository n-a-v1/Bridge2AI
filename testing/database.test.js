/**
 * database.test.js — Integration tests for the Database class
 *
 * All tests use a unique RUN_ID prefix to avoid polluting real data.
 * afterAll cleans up every row/table created during the test run.
 *
 * Requires: MySQL running with credentials from .env / defaults
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from '../src/database.js';

// Unique prefix for this test run — prevents collisions with real data or parallel runs
const RUN_ID = `test_${Date.now()}`;
const SESSION = `${RUN_ID}_session`;
const PROVIDER = `${RUN_ID}_prov`;
const RAW_TABLE = `raw_test_${Date.now()}`;

// Track import IDs created so we can drop their raw tables in afterAll
const createdImportIds = [];

let db;

beforeAll(async () => {
  db = new Database();
  await db.connect();
});

afterAll(async () => {
  // Remove test chat_history rows
  await db.connection.query(
    'DELETE FROM chat_history WHERE session_id LIKE ?',
    [`${RUN_ID}%`]
  );

  // Remove test api_key
  await db.connection.query(
    'DELETE FROM api_keys WHERE provider = ?',
    [PROVIDER]
  );

  // Remove test raw table created by createRawTable test
  await db.connection.query(`DROP TABLE IF EXISTS \`${RAW_TABLE}\``);

  // Remove any data_imports / data_profiles / raw tables created during this run
  for (const id of createdImportIds) {
    await db.connection.query('DELETE FROM data_profiles WHERE import_id = ?', [id]);
    await db.connection.query('DELETE FROM data_imports WHERE id = ?', [id]);
    await db.connection.query(`DROP TABLE IF EXISTS \`raw_import_${id}\``);
  }

  await db.close();
});

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

describe('Connection', () => {
  it('connects to MySQL without throwing', () => {
    // If beforeAll succeeded, connection is live
    expect(db.connection).not.toBeNull();
  });

  it('SELECT 1 returns the value 1', async () => {
    const [rows] = await db.connection.query('SELECT 1 AS val');
    expect(rows[0].val).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Table Initialization
// ---------------------------------------------------------------------------

describe('Table Initialization', () => {
  it('chat_history table exists', async () => {
    const [rows] = await db.connection.query(
      "SHOW TABLES LIKE 'chat_history'"
    );
    expect(rows.length).toBe(1);
  });

  it('api_keys table exists', async () => {
    const [rows] = await db.connection.query("SHOW TABLES LIKE 'api_keys'");
    expect(rows.length).toBe(1);
  });

  it('data_profiles table exists', async () => {
    const [rows] = await db.connection.query("SHOW TABLES LIKE 'data_profiles'");
    expect(rows.length).toBe(1);
  });

  it('data_imports table exists', async () => {
    const [rows] = await db.connection.query("SHOW TABLES LIKE 'data_imports'");
    expect(rows.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Chat History
// ---------------------------------------------------------------------------

describe('Chat History', () => {
  it('saveMessage saves a user message without throwing', async () => {
    await expect(
      db.saveMessage(SESSION, 'alice', 'user', 'hello', 'test-model')
    ).resolves.not.toThrow();
  });

  it('saveMessage saves an assistant message without throwing', async () => {
    await expect(
      db.saveMessage(SESSION, 'alice', 'assistant', 'hi there', 'test-model')
    ).resolves.not.toThrow();
  });

  it('getChatHistory returns messages for the session', async () => {
    const history = await db.getChatHistory(SESSION);
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('getChatHistory returns empty array for unknown session', async () => {
    const history = await db.getChatHistory(`${RUN_ID}_nonexistent_xyz`);
    expect(history).toEqual([]);
  });

  it('getChatHistory preserves role field correctly', async () => {
    const history = await db.getChatHistory(SESSION);
    const roles = history.map(m => m.role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');
  });

  it('getChatHistory preserves content correctly', async () => {
    const history = await db.getChatHistory(SESSION);
    const contents = history.map(m => m.content);
    expect(contents).toContain('hello');
    expect(contents).toContain('hi there');
  });

  it('getChatHistory respects LIMIT 20 — returns at most 20 rows', async () => {
    const limitSession = `${RUN_ID}_limit`;
    // Insert 21 messages
    for (let i = 0; i < 21; i++) {
      await db.saveMessage(limitSession, 'tester', 'user', `msg ${i}`, 'test-model');
    }
    const history = await db.getChatHistory(limitSession);
    expect(history.length).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------

describe('API Keys', () => {
  it('saveApiKey saves a provider without throwing', async () => {
    await expect(
      db.saveApiKey(PROVIDER, 'sk-test-key-abc123', 'claude-test')
    ).resolves.not.toThrow();
  });

  it('getApiKey retrieves key and model for saved provider', async () => {
    const result = await db.getApiKey(PROVIDER);
    expect(result).not.toBeNull();
    expect(result.api_key).toBe('sk-test-key-abc123');
    expect(result.model_name).toBe('claude-test');
  });

  it('getApiKey returns null for unknown provider', async () => {
    const result = await db.getApiKey(`${RUN_ID}_no_such_provider`);
    expect(result).toBeNull();
  });

  it('saveApiKey UPSERT updates an existing key', async () => {
    await db.saveApiKey(PROVIDER, 'sk-updated-key', 'claude-updated');
    const result = await db.getApiKey(PROVIDER);
    expect(result.api_key).toBe('sk-updated-key');
    expect(result.model_name).toBe('claude-updated');
  });
});

// ---------------------------------------------------------------------------
// Data Imports & Profiles
// ---------------------------------------------------------------------------

describe('Data Imports & Profiles', () => {
  let testImportId;

  it('saveDataImport returns a numeric insertId', async () => {
    testImportId = await db.saveDataImport(`${RUN_ID}_fixture.xlsx`, 5, 3);
    expect(typeof testImportId).toBe('number');
    expect(testImportId).toBeGreaterThan(0);
    createdImportIds.push(testImportId);
  });

  it('saveDataProfile stores a profile without throwing', async () => {
    const colInfo = [{ name: 'ColA', type: 'text' }, { name: 'ColB', type: 'text' }];
    await expect(
      db.saveDataProfile(
        testImportId,
        `${RUN_ID}_fixture.xlsx: 5 rows, 3 columns`,
        colInfo,
        `raw_import_${testImportId}`
      )
    ).resolves.not.toThrow();
  });

  it('getDataProfiles(limit) returns at most limit rows', async () => {
    const result = await db.getDataProfiles(1);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it('getAllDataProfiles returns an array', async () => {
    const result = await db.getAllDataProfiles();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Raw Tables
// ---------------------------------------------------------------------------

describe('Raw Tables', () => {
  const testCols = ['sku', 'qty', 'price'];
  const testRows = [
    { sku: 'PART-001', qty: '10', price: '$5.00' },
    { sku: 'PART-002', qty: '20', price: '$3.50' }
  ];

  it('createRawTable creates a table without throwing', async () => {
    // Drop if exists from a previous aborted run
    await db.connection.query(`DROP TABLE IF EXISTS \`${RAW_TABLE}\``);
    await expect(db.createRawTable(RAW_TABLE, testCols)).resolves.not.toThrow();
  });

  it('insertRawRows inserts rows without throwing', async () => {
    await expect(
      db.insertRawRows(RAW_TABLE, testCols, testRows)
    ).resolves.not.toThrow();
  });

  it('executeQuery returns an array', async () => {
    const result = await db.executeQuery(`SELECT * FROM \`${RAW_TABLE}\``);
    expect(Array.isArray(result)).toBe(true);
  });

  it('executeQuery returns the correct row count', async () => {
    const result = await db.executeQuery(`SELECT * FROM \`${RAW_TABLE}\``);
    expect(result.length).toBe(2);
  });

  it('executeQuery returns correct column values', async () => {
    const result = await db.executeQuery(
      `SELECT * FROM \`${RAW_TABLE}\` WHERE \`sku\` = 'PART-001'`
    );
    expect(result.length).toBe(1);
    expect(result[0].sku).toBe('PART-001');
    expect(result[0].qty).toBe('10');
  });
});

// ---------------------------------------------------------------------------
// Schema Validation — catches missing columns before runtime errors occur
// ---------------------------------------------------------------------------

describe('Schema Validation', () => {
  async function getColumns(table) {
    const [rows] = await db.connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table]
    );
    return rows.map(r => r.COLUMN_NAME);
  }

  it('api_keys has all required columns', async () => {
    const cols = await getColumns('api_keys');
    expect(cols).toContain('id');
    expect(cols).toContain('provider');
    expect(cols).toContain('api_key');
    expect(cols).toContain('model_name');   // most commonly missing in old schemas
    expect(cols).toContain('is_active');
  });

  it('chat_history has all required columns', async () => {
    const cols = await getColumns('chat_history');
    expect(cols).toContain('id');
    expect(cols).toContain('session_id');
    expect(cols).toContain('user_name');
    expect(cols).toContain('role');
    expect(cols).toContain('content');
    expect(cols).toContain('model');
    expect(cols).toContain('timestamp');
  });

  it('data_profiles has all required columns', async () => {
    const cols = await getColumns('data_profiles');
    expect(cols).toContain('id');
    expect(cols).toContain('import_id');
    expect(cols).toContain('dataset_summary');
    expect(cols).toContain('column_profiles');
    expect(cols).toContain('raw_table_name');
  });

  it('data_imports has all required columns', async () => {
    const cols = await getColumns('data_imports');
    expect(cols).toContain('id');
    expect(cols).toContain('filename');
    expect(cols).toContain('rows_imported');
    expect(cols).toContain('columns_imported');
  });

  it('saveApiKey roundtrip succeeds — proves model_name column is functional', async () => {
    // This is the exact operation that failed in production when model_name was missing.
    // A passing test here means the schema is correct and the column is writable.
    const testProvider = `${RUN_ID}_schema_check`;
    await expect(
      db.saveApiKey(testProvider, 'sk-schema-test', 'claude-schema-test')
    ).resolves.not.toThrow();
    const result = await db.getApiKey(testProvider);
    expect(result.model_name).toBe('claude-schema-test');
    // Cleanup
    await db.connection.query('DELETE FROM api_keys WHERE provider = ?', [testProvider]);
  });
});

// ---------------------------------------------------------------------------
// Close
// ---------------------------------------------------------------------------

describe('Close', () => {
  it('close() on a separate connection resolves without error', async () => {
    const tempDb = new Database();
    await tempDb.connect();
    await expect(tempDb.close()).resolves.not.toThrow();
  });
});
