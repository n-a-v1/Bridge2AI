/**
 * twilio/adapter.js — Bridge between Twilio SMS and LLMManager.
 *
 * This file is the ONLY integration point between Twilio and the core app.
 * It does NOT modify anything in src/. It imports LLMManager, forces raw mode,
 * and formats the JSON response into a human-readable SMS reply.
 *
 * Used by: twilio/webhook.js
 */

import Database from '../src/database.js';
import LLMManager from '../src/llm-manager.js';
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

// Shared DB + LLM instance (created once, reused across requests)
const db  = new Database();
const llm = new LLMManager(db);

let initialized = false;

async function init() {
  if (initialized) return;
  await db.connect();
  const ok = await llm.setProvider('anthropic');
  if (!ok) throw new Error('No Anthropic API key stored. Run the app and add a key first.');
  initialized = true;
}

/**
 * Handle a single SMS message from a user.
 *
 * @param {string} from     Twilio "From" number (used as session ID)
 * @param {string} message  The user's text message
 * @returns {string}        SMS reply (max ~1600 chars for Twilio)
 */
export async function handleSMS(from, message) {
  await init();

  const session = 'twilio-' + from.replace(/\D/g, '');
  const history = await db.getChatHistory(session);

  // Always use raw mode — adapter formats the response for SMS
  const rawResponse = await llm.chat(message, session, from, history, 'raw');

  return formatForSMS(rawResponse);
}

/**
 * Format a raw JSON response into a concise SMS-friendly string.
 * Falls back gracefully if the response is not valid JSON.
 */
function formatForSMS(raw) {
  try {
    const data = JSON.parse(raw);

    if (data.error) {
      return 'Sorry, I ran into an issue: ' + data.error;
    }

    if (!Array.isArray(data.results) || data.results.length === 0) {
      return 'No results found for your query.';
    }

    const lines = [];
    const cols  = Object.keys(data.results[0]).filter(k => k !== 'id');
    const limit = Math.min(data.results.length, 10); // cap SMS at 10 rows

    for (let i = 0; i < limit; i++) {
      const row   = data.results[i];
      const parts = cols.map(c => String(row[c] ?? '').slice(0, 40));
      lines.push((i + 1) + '. ' + parts.join(' | '));
    }

    const header = `Results (${data.count} found${data.count > limit ? ', showing top ' + limit : ''}):\n`;
    const footer = '\n[Bridge2AI]';
    const body   = lines.join('\n');

    // Twilio SMS max is 1600 chars — truncate if needed
    const full = header + body + footer;
    return full.length > 1550 ? full.slice(0, 1547) + '…' : full;

  } catch (_) {
    // Response was plain text (no SQL was generated) — return as-is
    return String(raw).slice(0, 1550);
  }
}
