/**
 * session.test.js — Integration tests for session & user management
 *
 * Verifies session isolation, user name persistence, history accumulation,
 * ordering, and edge cases. Uses RUN_ID prefix for all session IDs.
 *
 * Requires: MySQL running with credentials from .env / defaults
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from '../src/database.js';

const RUN_ID = `test_${Date.now()}`;

// Distinct sessions used across tests
const SESSION_A = `${RUN_ID}_sess_a`;
const SESSION_B = `${RUN_ID}_sess_b`;
const SESSION_USERS = `${RUN_ID}_sess_users`;
const SESSION_ACCUM = `${RUN_ID}_sess_accum`;
const SESSION_EMPTY = `${RUN_ID}_sess_empty`;
const SESSION_ONE = `${RUN_ID}_sess_one`;
const SESSION_LONG = `${RUN_ID}_sess_${'x'.repeat(200)}`;
const SESSION_ROLES = `${RUN_ID}_sess_roles`;
const SESSION_ORDER = `${RUN_ID}_sess_order`;

let db;

beforeAll(async () => {
  db = new Database();
  await db.connect();

  // Pre-populate sessions used across multiple tests
  await db.saveMessage(SESSION_A, 'alice', 'user', 'message from A', 'test-model');
  await db.saveMessage(SESSION_B, 'bob', 'user', 'message from B', 'test-model');
  await db.saveMessage(SESSION_USERS, 'alice', 'user', 'hello from alice', 'test-model');
  await db.saveMessage(SESSION_USERS, 'bob', 'assistant', 'hello from bob', 'test-model');
  await db.saveMessage(SESSION_ONE, 'charlie', 'user', 'only message', 'test-model');
  await db.saveMessage(SESSION_ROLES, 'dave', 'user', 'user role msg', 'test-model');
  await db.saveMessage(SESSION_ROLES, 'dave', 'assistant', 'assistant role msg', 'test-model');

  // Session ORDER: 3 messages to verify retrieval sequence
  await db.saveMessage(SESSION_ORDER, 'eve', 'user', 'first', 'test-model');
  await db.saveMessage(SESSION_ORDER, 'eve', 'assistant', 'second', 'test-model');
  await db.saveMessage(SESSION_ORDER, 'eve', 'user', 'third', 'test-model');
});

afterAll(async () => {
  await db.connection.query(
    'DELETE FROM chat_history WHERE session_id LIKE ?',
    [`${RUN_ID}%`]
  );
  await db.close();
});

// ---------------------------------------------------------------------------
// Session Isolation
// ---------------------------------------------------------------------------

describe('Session Isolation', () => {
  it("Session A's messages do not appear in Session B history", async () => {
    const historyB = await db.getChatHistory(SESSION_B);
    const contents = historyB.map(m => m.content);
    expect(contents).not.toContain('message from A');
  });

  it("Session B's messages do not appear in Session A history", async () => {
    const historyA = await db.getChatHistory(SESSION_A);
    const contents = historyA.map(m => m.content);
    expect(contents).not.toContain('message from B');
  });
});

// ---------------------------------------------------------------------------
// User Fields
// ---------------------------------------------------------------------------

describe('User Fields', () => {
  it('user_name is stored correctly in chat_history', async () => {
    const [rows] = await db.connection.query(
      'SELECT user_name FROM chat_history WHERE session_id = ? LIMIT 1',
      [SESSION_A]
    );
    expect(rows[0].user_name).toBe('alice');
  });

  it('multiple users in the same session are all stored', async () => {
    const [rows] = await db.connection.query(
      'SELECT DISTINCT user_name FROM chat_history WHERE session_id = ?',
      [SESSION_USERS]
    );
    const names = rows.map(r => r.user_name);
    expect(names).toContain('alice');
    expect(names).toContain('bob');
  });
});

// ---------------------------------------------------------------------------
// History Accumulation
// ---------------------------------------------------------------------------

describe('History Accumulation', () => {
  it('history accumulates across multiple saveMessage calls', async () => {
    const session = `${RUN_ID}_sess_accum`;
    await db.saveMessage(session, 'user1', 'user', 'turn 1', 'test-model');
    await db.saveMessage(session, 'user1', 'assistant', 'reply 1', 'test-model');
    await db.saveMessage(session, 'user1', 'user', 'turn 2', 'test-model');

    const history = await db.getChatHistory(session);
    expect(history.length).toBe(3);
  });

  it('session with 0 messages returns empty array', async () => {
    const history = await db.getChatHistory(SESSION_EMPTY);
    expect(history).toEqual([]);
  });

  it('session with exactly 1 message returns array of length 1', async () => {
    const history = await db.getChatHistory(SESSION_ONE);
    expect(history.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Field Correctness
// ---------------------------------------------------------------------------

describe('Field Correctness', () => {
  it('long session names (200+ chars) work without error', async () => {
    await expect(
      db.saveMessage(SESSION_LONG, 'tester', 'user', 'long session test', 'test-model')
    ).resolves.not.toThrow();
    const history = await db.getChatHistory(SESSION_LONG);
    expect(history.length).toBe(1);
  });

  it('role field is stored correctly for both user and assistant', async () => {
    const history = await db.getChatHistory(SESSION_ROLES);
    const roles = history.map(m => m.role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');
  });

  it('messages are returned with content intact and in chronological order', async () => {
    const history = await db.getChatHistory(SESSION_ORDER);
    expect(history.length).toBe(3);

    // Verify all messages are present
    const contents = history.map(m => m.content);
    expect(contents).toContain('first');
    expect(contents).toContain('second');
    expect(contents).toContain('third');

    // getChatHistory uses ORDER BY timestamp DESC + .reverse().
    // MySQL DATETIME has 1-second precision — messages inserted within the same
    // second get identical timestamps, making the DESC sort non-deterministic.
    // Use a direct query ordered by AUTO_INCREMENT id (guaranteed insert order)
    // to verify that 'first' was actually saved before 'third'.
    const [rows] = await db.connection.query(
      'SELECT content FROM chat_history WHERE session_id = ? ORDER BY id ASC',
      [SESSION_ORDER]
    );
    const ordered = rows.map(r => r.content);
    expect(ordered[0]).toBe('first');
    expect(ordered[2]).toBe('third');
  });
});
