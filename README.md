# Bridge2AI — AI SQL Query System
### Milestone 2.2 — Data Accuracy Testing

This milestone adds a full integration test suite and rich terminal output to the AI-powered SQL query system. The focus is **verifiable accuracy**: every query the AI generates can be checked against documented ground truth sourced from manual PDF audits (`github/res_2026_02_27`).

---

## What This Is

A Node.js CLI that:
- Accepts natural-language questions about supply-chain data
- Uses Claude (Anthropic) to generate SQL queries
- Executes queries against your imported dataset in MySQL
- Displays results in formatted tables with a real "scanning" phase showing live dataset stats

---

## Prerequisites

- Node.js 18+
- MySQL 8.x running locally
- An Anthropic API key

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Create the MySQL user and database
In MySQL (as root):
```sql
CREATE USER IF NOT EXISTS 'demo-api'@'localhost' IDENTIFIED BY 'Bridge2AI';
GRANT ALL PRIVILEGES ON llm_manager.* TO 'demo-api'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Create a `.env` file at the project root
```
DB_HOST=localhost
DB_USER=demo-api
DB_PASSWORD=Bridge2AI
DB_NAME=llm_manager
```

### 4. Set up the database schema
```bash
npm run setup
```

### 5. Add your Anthropic API key
```bash
node src/index.js add-key anthropic YOUR_KEY
```

### 6. Import your data
```bash
# Import everything in the /data folder at once:
npm run import-all

# Or import a single file:
node src/index.js import path/to/file.xlsx
```

### 7. Start chatting
```bash
npm start
```

---

## Chat Commands

| Command | What it does |
|---------|-------------|
| `/history` | Show conversation history for this session |
| `/clear` | Reset in-memory context (DB history preserved) |
| `/import <file>` | Import a data file mid-conversation |
| `/profiles` | List imported datasets |
| `/exit` | Quit |

## CLI Options

```bash
node src/index.js chat --session demo --user alice --provider anthropic
node src/index.js list-keys
node src/index.js wipe-keys
node src/index.js profiles
```

---

## Utility Scripts

| Command | What it does |
|---------|-------------|
| `npm run setup` | Create/migrate DB schema (safe to re-run) |
| `npm run import-all` | Import all .xlsx/.xls/.csv files from `/data` |
| `npm run clear-context` | Back up and clear all chat history |
| `npm run recreate-db` | Drop and rebuild the entire database from scratch |

---

## Running Tests

```bash
# Run all tests (requires MySQL)
npm test

# Watch mode
npm run test:watch
```

### Test Files

| File | Tests | What it covers |
|------|-------|----------------|
| `database.test.js` | 32 | All Database class methods + schema validation |
| `import.test.js` | 13 | XLSX import pipeline end-to-end |
| `session.test.js` | 10 | Session isolation and user management |
| `llm.test.js` | 16 | LLM prompt builder, provider setup, live chat |
| `data.test.js` | 28 | Ground-truth accuracy checks against real dataset |

`data.test.js` skips automatically when no dataset has been imported. Import data first, then all 28 accuracy tests will run.

### Expected output (with data imported and API key set)

```
Test Files  5 passed
Tests       99 passed
```

---

## Data Accuracy Evidence

Manual test results are in `github/`:
- `res_2026_02_27 (1).pdf` — Q1–Q4 prompt/response log
- `res_2026_02_27 (2).pdf` — Full Q1–Q8 scorecard with expected vs actual

These PDFs are the ground truth that `testing/data.test.js` encodes as automated assertions.

---

## Project Structure

```
src/
  index.js        CLI entry point (commander)
  database.js     MySQL class — all DB operations
  llm-manager.js  Anthropic chat, SQL extraction
  import-data.js  XLSX/CSV → MySQL import
  display.js      Rich terminal output (boxes, tables, scan view)

scripts/
  setup-db.js         Initialize and migrate DB schema
  import-all-data.js  Batch import all files in /data
  clear-context.js    Back up and clear chat history
  recreate-mysql.js   Drop + rebuild entire database

testing/
  database.test.js    DB integration tests
  import.test.js      Import pipeline tests
  session.test.js     Session isolation tests
  llm.test.js         LLM provider and chat tests
  data.test.js        Data accuracy tests (ground truth)
  README.md           Test suite setup guide

github/
  res_2026_02_27 (1).pdf   Manual test log
  res_2026_02_27 (2).pdf   Full accuracy scorecard
  example1.png             Sample output
  example2.png             Sample output
```
