# Bridge2AI
### AI-powered business data analyst — Milestone 2 Final

Ask questions about your business data in plain English. Bridge2AI reads your spreadsheets, generates SQL, and gives you answers — in a clean terminal interface or as raw JSON for integrations.

---

## What it does

1. You import your data files (`.xlsx` / `.csv`)
2. You ask questions in plain English
3. The AI generates SQL, runs it, and shows you the results

That's it. No manual queries. No configuration per dataset. Just import and ask.

---

## Requirements

- **Node.js 18+**
- **MySQL 8** running locally
- **An Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)

---

## Setup (first time only)

### 1. Install dependencies
```bash
npm install
```

### 2. Create the MySQL user
Open MySQL as root and run:
```sql
CREATE USER IF NOT EXISTS 'demo-api'@'localhost' IDENTIFIED BY 'Bridge2AI';
GRANT ALL PRIVILEGES ON llm_manager.* TO 'demo-api'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Create your `.env` file
Copy `.env.example` to `.env` — or just create `.env` with:
```
DB_HOST=localhost
DB_USER=demo-api
DB_PASSWORD=Bridge2AI
DB_NAME=llm_manager
```
> If you skip this step, the app will walk you through it on first launch.

### 4. Run the app
```bash
npm start
```

The app is fully menu-driven from here. Everything else (API key setup, database init, data import) is done inside the interface.

---

## Using the app

```
npm start
```

You'll see a main menu:

```
╔══════════════════════════════════════════════════╗
║  Bridge2AI  —  AI Data Tool  v3.1.0              ║
╠══════════════════════════════════════════════════╣
║  1. Chat with AI                                 ║
║  2. API Keys                                     ║
║  3. Database                                     ║
║  4. Auto-clear chat on start: OFF                ║
║  5. Exit                                         ║
╚══════════════════════════════════════════════════╝
```

### First run checklist (do these in order)
1. **API Keys → Add / update a key** — paste your Anthropic key
2. **Database → Initialize / migrate tables** — sets up the schema
3. **Database → Import all data files from /data folder** — drop your `.xlsx` / `.csv` files into a `/data` folder first
4. **Chat with AI** — start asking questions

---

## Inside the chat

```
Commands you can type while chatting:

/exit              Leave chat, return to main menu
/mode raw          Switch to raw JSON output (for integrations)
/mode present      Switch to formatted table output (default)
/history           Show this session's conversation history
/clear             Clear AI memory (history stays in DB)
/profiles          List all imported datasets
/import <file>     Import a new file mid-conversation
```

### Two output modes

**Presentation mode** (default) — formatted for humans:
```
  🎯 100 RESULTS
┌──────────────────────┬─────────────┐
│ ShipDtl_PartNum      │ delay_count │
├──────────────────────┼─────────────┤
│ EL380004-INST        │ 76          │
│ DATA LOGGER-SE       │ 49          │
└──────────────────────┴─────────────┘
```

**Raw mode** (`/mode raw`) — clean JSON for scripts, APIs, or Twilio:
```json
{
  "query": "SELECT ...",
  "count": 100,
  "results": [
    { "ShipDtl_PartNum": "EL380004-INST", "delay_count": "76" },
    ...
  ]
}
```

---

## Running the tests

Requires MySQL to be running and an API key to be stored.

```bash
npm test
```

| Test file | Tests | Covers |
|-----------|-------|--------|
| `database.test.js` | 32 | All DB operations and schema |
| `import.test.js` | 13 | XLSX/CSV import pipeline |
| `session.test.js` | 10 | Session isolation |
| `llm.test.js` | 16 | AI provider setup and chat |
| `data.test.js` | 28 | Ground-truth accuracy (auto-skips if no data) |

**Expected result:**
```
Tests  99 passed       ← with data imported
Tests  71 passed | 28 skipped  ← without data (normal)
```

---

## Project structure

```
src/
  index.js          Main entry point — interactive CLI menu
  database.js       All MySQL operations
  llm-manager.js    AI chat, SQL generation and parsing
  import-data.js    Imports .xlsx/.csv files into MySQL
  display.js        Terminal output — tables, boxes, formatting
  menu.js           Menu drawing helpers

scripts/
  setup-db.js         Initialize / migrate database schema
  import-all-data.js  Batch import everything in /data
  clear-context.js    Back up and wipe chat history
  recreate-mysql.js   Drop and rebuild the entire database

testing/
  database.test.js
  import.test.js
  session.test.js
  llm.test.js
  data.test.js

twilio/
  webhook.js        Express server for Twilio SMS webhooks
  adapter.js        Connects Twilio to the AI (raw mode, SMS formatting)
  README.md         Twilio setup guide
```

---

## Twilio / integration

The `twilio/` folder is a self-contained SMS integration. It does **not** modify any core code.

```bash
# Install express (one-time)
npm install

# Start the webhook server
node twilio/webhook.js
```

See `twilio/README.md` for full setup instructions.

When a user texts your Twilio number, the AI answers using your imported data. Responses are automatically formatted for SMS.

---

## Utility scripts (can also be run directly)

```bash
npm run setup          # Initialize/migrate DB schema
npm run import-all     # Import all files in /data
npm run clear-context  # Back up and wipe chat history
npm run recreate-db    # Drop everything and start fresh
npm run twilio         # Start Twilio webhook server
npm test               # Run test suite
```

---

## Roadmap

| Milestone | Status | Goal |
|-----------|--------|------|
| M2 Final | ✅ This branch | Friendly CLI, dual output modes, Twilio stub, 99 tests |
| M3 | 🔜 Next | Live Twilio SMS — user texts a number, AI answers |
| M4 | 🔜 Expo | Frontend UI, projector demo, handwritten docs |
