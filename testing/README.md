# Test Suite — js-llm-manager

Integration tests for the v3.0.0-PRODUCTION build.

## Prerequisites

- MySQL running with a user that matches `.env` credentials
- `.env` at project root (defaults: `DB_USER=demo-api`, `DB_PASSWORD=Bridge2AI`)
- The MySQL user must exist and have full privileges on `llm_manager`:
  ```sql
  CREATE USER IF NOT EXISTS 'demo-api'@'localhost' IDENTIFIED BY 'Bridge2AI';
  GRANT ALL PRIVILEGES ON llm_manager.* TO 'demo-api'@'localhost';
  FLUSH PRIVILEGES;
  ```
- Run DB setup once after creating the user: `npm run setup`
- Node.js 18+

## Install

```bash
npm install
```

## Run Tests

```bash
# Run all tests once (CI-style)
npm test

# Watch mode (re-runs on file change)
npm run test:watch
```

## Test Files

| File | Tests | Needs API Key? |
|------|-------|---------------|
| `database.test.js` | ~27 | No |
| `import.test.js` | ~12 | No |
| `session.test.js` | ~10 | No |
| `llm.test.js` | ~14 (6 skip without key) | Some |

**~49 tests pass immediately with only a DB connection.**
**~14 additional tests run when an Anthropic API key is loaded.**

## Load an API Key (for LLM tests)

```bash
node src/index.js add-key anthropic YOUR_ANTHROPIC_API_KEY
```

Then re-run `npm test` — the previously-skipped LLM tests will execute.

## Test Isolation

Each test run uses a `test_<timestamp>` prefix for all session IDs, provider
names, and temporary table names. `afterAll` deletes every row and table
created during the run — real data is never touched.

## Expected Output (no API key)

```
✓ database.test.js (27 tests)
✓ import.test.js (12 tests)
✓ session.test.js (10 tests)
↓ llm.test.js (8 pass, 6 skipped — no API key)

Test Files  4 passed
Tests       57 passed | 6 skipped
```
