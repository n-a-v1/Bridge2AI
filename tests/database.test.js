// tests/database.test.js
import { jest } from '@jest/globals';
import Database from '../src/database.js';

describe('Database Module Tests', () => {
  let db;

  beforeAll(async () => {
    db = new Database();
    await db.connect();
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await db.connection.query("DELETE FROM api_keys WHERE provider LIKE 'test-%'");
      await db.connection.query("DELETE FROM chat_history WHERE session_id LIKE 'test-%'");
      await db.connection.query("DELETE FROM training_data WHERE category LIKE 'test-%'");
      await db.connection.query("DELETE FROM system_configs WHERE config_key LIKE 'test_%'");
      await db.connection.query("DELETE FROM bias_logs WHERE analysis_type LIKE 'test_%'");
    } catch { /* ignore */ }
    await db.close();
  });

  // ── Connection ──────────────────────────────────────

  test('should connect to MySQL database', () => {
    expect(db.connection).toBeTruthy();
  });

  // ── API Keys ────────────────────────────────────────

  describe('API Key Management', () => {
    test('should save an API key', async () => {
      await db.saveApiKey('test-provider', 'test-key-123', 'test-model');
      const result = await db.getApiKey('test-provider');
      expect(result).toBeTruthy();
      expect(result.api_key).toBe('test-key-123');
      expect(result.model_name).toBe('test-model');
    });

    test('should update an existing API key', async () => {
      await db.saveApiKey('test-provider', 'test-key-456', 'new-model');
      const result = await db.getApiKey('test-provider');
      expect(result.api_key).toBe('test-key-456');
      expect(result.model_name).toBe('new-model');
    });

    test('should return null for missing provider', async () => {
      const result = await db.getApiKey('nonexistent-provider');
      expect(result).toBeNull();
    });

    test('should list all API keys', async () => {
      const keys = await db.listApiKeys();
      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThan(0);
    });
  });

  // ── Chat History ────────────────────────────────────

  describe('Chat History', () => {
    test('should save a user message', async () => {
      await db.saveMessage('test-session-1', 'test-user', 'user', 'Hello', 'test-model');
      const history = await db.getChatHistory('test-session-1');
      expect(history.length).toBeGreaterThanOrEqual(1);
      const last = history[history.length - 1];
      expect(last.content).toBe('Hello');
      expect(last.role).toBe('user');
    });

    test('should save an assistant message', async () => {
      await db.saveMessage('test-session-1', 'test-user', 'assistant', 'Hi there!', 'test-model');
      const history = await db.getChatHistory('test-session-1');
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    test('should retrieve history in chronological order', async () => {
      const history = await db.getChatHistory('test-session-1');
      // timestamps should be ascending
      for (let i = 1; i < history.length; i++) {
        expect(new Date(history[i].timestamp) >= new Date(history[i - 1].timestamp)).toBe(true);
      }
    });

    test('should respect limit parameter', async () => {
      const history = await db.getChatHistory('test-session-1', 1);
      expect(history.length).toBeLessThanOrEqual(1);
    });

    test('should isolate sessions', async () => {
      await db.saveMessage('test-session-2', 'user2', 'user', 'Different session', 'test-model');
      const h1 = await db.getChatHistory('test-session-1');
      const h2 = await db.getChatHistory('test-session-2');
      expect(h1.every(m => m.content !== 'Different session')).toBe(true);
      expect(h2.some(m => m.content === 'Different session')).toBe(true);
    });
  });

  // ── Training Data ───────────────────────────────────

  describe('Training Data', () => {
    test('should save training data', async () => {
      await db.addTrainingData('test-cat', 'What is OTP?', 'On-Time Performance metric.', { test: true });
      const data = await db.getTrainingData('test-cat');
      expect(data.length).toBeGreaterThan(0);
    });

    test('should filter by category', async () => {
      await db.addTrainingData('test-cat-2', 'Another Q?', 'Another A.', {});
      const filtered = await db.getTrainingData('test-cat');
      expect(filtered.every(d => d.category === 'test-cat')).toBe(true);
    });

    test('should return all when no category', async () => {
      const all = await db.getTrainingData();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── System Config ───────────────────────────────────

  describe('System Config', () => {
    test('should set and get config', async () => {
      await db.setSystemConfig('test_key', 'test_value', 'A test');
      const val = await db.getSystemConfig('test_key');
      expect(val).toBe('test_value');
    });

    test('should update existing config', async () => {
      await db.setSystemConfig('test_key', 'new_value', 'Updated');
      const val = await db.getSystemConfig('test_key');
      expect(val).toBe('new_value');
    });

    test('should return null for missing config', async () => {
      const val = await db.getSystemConfig('nonexistent_key_xyz');
      expect(val).toBeNull();
    });
  });

  // ── Bias Logs ───────────────────────────────────────

  describe('Bias Logs', () => {
    test('should save a bias log', async () => {
      await db.saveBiasLog(999, 'test_analysis', 'findings', 'adjustments', 'reasoning', 85.5);
      const logs = await db.getBiasLogs(1);
      expect(logs.length).toBeGreaterThan(0);
    });

    test('should respect limit', async () => {
      await db.saveBiasLog(999, 'test_analysis', 'f2', 'a2', 'r2', 90.0);
      const logs = await db.getBiasLogs(1);
      expect(logs.length).toBe(1);
    });
  });

  // ── Data Imports ────────────────────────────────────

  describe('Data Imports', () => {
    test('should save a data import record', async () => {
      const id = await db.saveDataImport('test.xlsx', 'xlsx', 100, 10, 'completed', null, { test: true });
      expect(id).toBeGreaterThan(0);
    });

    test('should save a failed import', async () => {
      const id = await db.saveDataImport('bad.csv', 'csv', 0, 0, 'failed', 'Parse error', null);
      expect(id).toBeGreaterThan(0);
    });
  });
});
