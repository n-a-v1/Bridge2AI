/**
 * twilio/webhook.js — Express server that receives Twilio SMS webhooks.
 *
 * Setup:
 *   1. npm install express (in the project root)
 *   2. node twilio/webhook.js
 *   3. Expose with ngrok: ngrok http 3000
 *   4. Set your Twilio phone number webhook URL to:
 *      https://<ngrok-url>/sms
 *
 * Environment variables (add to .env):
 *   PORT=3000
 *   TWILIO_AUTH_TOKEN=your_token   (optional — for request validation)
 */

import express from 'express';
import { handleSMS } from './adapter.js';
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

const app  = express();
const PORT = process.env.PORT || 3000;

// Parse URL-encoded form bodies (how Twilio sends webhooks)
app.use(express.urlencoded({ extended: false }));

/**
 * POST /sms
 * Twilio sends: Body, From, To (and many others)
 * We respond with TwiML XML telling Twilio what to send back.
 */
app.post('/sms', async (req, res) => {
  const from    = req.body.From    || 'unknown';
  const message = (req.body.Body   || '').trim();

  console.log(`[SMS] From: ${from}  |  Message: ${message}`);

  let reply;
  try {
    reply = await handleSMS(from, message);
  } catch (e) {
    console.error('[SMS] Error:', e.message);
    reply = 'Sorry, something went wrong. Please try again.';
  }

  console.log(`[SMS] Replying: ${reply.slice(0, 80)}…`);

  // Respond with TwiML
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXML(reply)}</Message>
</Response>`);
});

/** Health check */
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'Bridge2AI Twilio Webhook' }));

function escapeXML(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

app.listen(PORT, () => {
  console.log(`\n  Bridge2AI Twilio webhook running on port ${PORT}`);
  console.log(`  Expose with ngrok: ngrok http ${PORT}`);
  console.log(`  Twilio webhook URL: https://<ngrok-url>/sms\n`);
});
