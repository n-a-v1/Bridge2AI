# Bridge2AI — Twilio SMS Integration

This folder contains everything needed to expose Bridge2AI over SMS.
It is **fully isolated** — nothing in `src/` is modified.

---

## How It Works

```
User SMS → Twilio → POST /sms → webhook.js → adapter.js → LLMManager (raw mode) → JSON → SMS reply
```

`adapter.js` calls `LLMManager.chat()` with `mode = 'raw'`, which returns a JSON object instead of rendering terminal output. The adapter then formats that JSON into a concise, human-readable SMS reply (max 1600 chars).

---

## Setup

### 1. Install Express
```bash
npm install express
```

### 2. Start the webhook server
```bash
node twilio/webhook.js
```

### 3. Expose it publicly (development)
```bash
npx ngrok http 3000
```
Copy the `https://...ngrok.io` URL.

### 4. Configure Twilio
- Go to your Twilio phone number settings
- Set **Messaging → Webhook (when a message comes in)** to:
  ```
  https://<your-ngrok-url>/sms
  ```
- Method: `POST`

### 5. Text the number
Any SMS to your Twilio number will be answered by the AI using your imported supply-chain data.

---

## Environment Variables

Add to your `.env` file:
```
PORT=3000
```

---

## Files

| File | Purpose |
|------|---------|
| `webhook.js` | Express server, receives Twilio POST, returns TwiML |
| `adapter.js` | Wraps LLMManager, forces raw mode, formats for SMS |

---

## SMS Response Format

```
Results (15 found, showing top 10):
1. TECWISE SISTEMAS... | 448
2. Suncor Energy... | 591
...
[Bridge2AI]
```

---

## Milestone 3 Checklist

- [ ] Twilio account created
- [ ] Phone number purchased
- [ ] ngrok or VM with public IP set up
- [ ] Webhook URL configured in Twilio
- [ ] Test: text "Who had the most delays in 2025?"
- [ ] Test: text "Late orders in December 2025"
