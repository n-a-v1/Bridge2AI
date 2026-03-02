/**
 * llm.test.js — Integration tests for LLMManager
 *
 * Split into two categories:
 *  1. No API key required — tests pure logic methods (_buildPrompt, _getSamples,
 *     setProvider with missing provider)
 *  2. Requires API key — tests setProvider with real key, chat(), and the critical
 *     failsafe when raw_import_1 does not exist.
 *
 * Uses ESM top-level await to detect whether an API key is stored in the DB.
 * Key-dependent tests are wrapped in describe.skipIf(!HAS_API_KEY).
 *
 * Requires: MySQL running. For LLM tests: Anthropic key loaded via:
 *   node src/index.js add-key anthropic YOUR_KEY
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from '../src/database.js';
import LLMManager from '../src/llm-manager.js';

// ---------------------------------------------------------------------------
// Top-level await: detect API key presence before any test runs
// ---------------------------------------------------------------------------

const _db = new Database();
await _db.connect();
const _key = await _db.getApiKey('anthropic');
const HAS_API_KEY = !!_key;
await _db.close();

// ---------------------------------------------------------------------------
// Shared DB + LLM instances (re-used across all test blocks)
// ---------------------------------------------------------------------------

const RUN_ID = `test_${Date.now()}`;

let db;
let llm;

beforeAll(async () => {
  db = new Database();
  await db.connect();
  llm = new LLMManager(db);
});

afterAll(async () => {
  // Clean up any chat messages saved during LLM tests
  await db.connection.query(
    'DELETE FROM chat_history WHERE session_id LIKE ?',
    [`${RUN_ID}%`]
  );
  await db.close();
});

// ---------------------------------------------------------------------------
// Prompt Builder — no API key required
// ---------------------------------------------------------------------------

describe('Prompt Builder — no API key required', () => {
  it('_buildPrompt returns a non-empty string', () => {
    const result = llm._buildPrompt([], []);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('_buildPrompt always starts with the SQL generator preamble', () => {
    const result = llm._buildPrompt([], []);
    expect(result).toContain('SQL query generator');
  });

  it('_buildPrompt includes table name when a profile with raw_table_name is provided', () => {
    const fakeProfiles = [
      {
        raw_table_name: 'raw_import_99',
        dataset_summary: 'test dataset',
        column_profiles: JSON.stringify([{ name: 'ColA', type: 'text' }])
      }
    ];
    const result = llm._buildPrompt(fakeProfiles, []);
    expect(result).toContain('raw_import_99');
  });

  it('_buildPrompt handles empty profiles array without throwing', () => {
    expect(() => llm._buildPrompt([], [])).not.toThrow();
  });

  it('_buildPrompt handles profiles with pre-parsed column_profiles object', () => {
    const fakeProfiles = [
      {
        raw_table_name: 'raw_import_42',
        dataset_summary: 'another test',
        column_profiles: [{ name: 'PartNum', type: 'text' }]  // already parsed
      }
    ];
    const result = llm._buildPrompt(fakeProfiles, []);
    expect(result).toContain('PartNum');
  });
});

// ---------------------------------------------------------------------------
// Samples — no API key required
// ---------------------------------------------------------------------------

describe('Samples (_getSamples) — no API key required', () => {
  it('_getSamples returns an array', async () => {
    const result = await llm._getSamples();
    expect(Array.isArray(result)).toBe(true);
  });

  it('_getSamples does not throw when raw_import_1 does not exist', async () => {
    // _getSamples always catches errors internally and returns []
    await expect(llm._getSamples()).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Provider Setup — no API key required
// ---------------------------------------------------------------------------

describe('Provider Setup — no API key required', () => {
  it('setProvider returns false for an unknown provider name', async () => {
    const result = await llm.setProvider(`${RUN_ID}_no_such_provider`);
    expect(result).toBe(false);
  });

  it('setProvider returns false for an empty string provider', async () => {
    const result = await llm.setProvider('');
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Provider Setup — requires API key
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_API_KEY)('Provider Setup — requires API key', () => {
  it('setProvider returns true with a valid stored key', async () => {
    const result = await llm.setProvider('anthropic');
    expect(result).toBe(true);
  });

  it('model is set to a non-empty string after setProvider', async () => {
    expect(typeof llm.model).toBe('string');
    expect(llm.model.length).toBeGreaterThan(0);
  });

  it('client is initialized (non-null) after setProvider', () => {
    expect(llm.client).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Chat — requires API key + live Anthropic API
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_API_KEY)('Chat — requires API key', () => {
  const CHAT_SESSION = `${RUN_ID}_chat`;

  beforeAll(async () => {
    // Ensure provider is set before chat tests run
    await llm.setProvider('anthropic');
  });

  it('chat() returns a string response', async () => {
    const result = await llm.chat(
      'How many rows are in the data?',
      CHAT_SESSION,
      'tester',
      []
    );
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('user message is saved to chat_history after chat()', async () => {
    const history = await db.getChatHistory(CHAT_SESSION);
    const userMessages = history.filter(m => m.role === 'user');
    expect(userMessages.length).toBeGreaterThan(0);
  });

  it('assistant message is saved to chat_history after chat()', async () => {
    const history = await db.getChatHistory(CHAT_SESSION);
    const assistantMessages = history.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);
  });

  /**
   * CRITICAL TEST — catches the known integration failure point.
   *
   * When raw_import_1 does not exist, the LLM may still generate SQL referencing
   * it. _getSamples() gracefully returns [], and any SQL execution error is caught
   * inside chat(). The method must return a string — it must NOT crash.
   */
  it('CRITICAL: chat() returns a string even when raw_import_1 does not exist', async () => {
    // Temporarily rename raw_import_1 to hide it, if it exists
    const [tables] = await db.connection.query("SHOW TABLES LIKE 'raw_import_1'");
    const exists = tables.length > 0;
    if (exists) {
      await db.connection.query('RENAME TABLE `raw_import_1` TO `raw_import_1_hidden`');
    }

    let result;
    try {
      result = await llm.chat(
        'list all orders',
        `${RUN_ID}_failsafe`,
        'tester',
        []
      );
    } finally {
      // Restore the table
      if (exists) {
        await db.connection.query('RENAME TABLE `raw_import_1_hidden` TO `raw_import_1`');
      }
    }

    expect(typeof result).toBe('string');
  });
});
