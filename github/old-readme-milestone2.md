# js-llm-manager

JavaScript AI LLM Manager with MySQL persistence. Store API keys, chat with AI models, import datasets to bias/train responses, and share sessions across a team via SSH.

## Quick Start (Ubuntu)

### 1. Prerequisites

```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# MySQL
sudo apt install -y mysql-server
```

### 2. MySQL Setup

```bash
sudo mysql
```

Inside MySQL:

```sql
CREATE USER 'demo-api'@'localhost' IDENTIFIED BY 'Bridge2AI';
CREATE DATABASE llm_manager;
GRANT ALL PRIVILEGES ON llm_manager.* TO 'demo-api'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Install & Initialize

```bash
git clone <your-repo-url>
cd js-llm-manager
npm install
npm run setup    # creates database tables
```

### 4. Add Your API Key

```bash
# Anthropic (auto-detects which Claude model works with your key)
node src/index.js add-key anthropic sk-ant-api03-YOUR-KEY-HERE

# OpenAI
node src/index.js add-key openai sk-YOUR-OPENAI-KEY

# Gemini
node src/index.js add-key gemini YOUR-GEMINI-KEY

# With a specific model override
node src/index.js add-key anthropic sk-ant-YOUR-KEY claude-3-haiku-20240307
```

The system will test your Anthropic key against available models and save the one that works.

### 5. Import Data (Optional)

```bash
node src/index.js import "data/KPI Data - COTD.xlsx"
node src/index.js import "data/KPI Data - MOTD.xlsx"
node src/index.js import "data/Purchase Data.xlsx"
```

This parses the data, generates training entries, and writes a bias analysis journal to `bias-journal/`.

### 6. Start Chatting

```bash
node src/index.js chat

# Or with options:
node src/index.js chat --provider anthropic --session demo --user nick
```

### 7. Chat Commands

While in a chat session:

| Command | Description |
|---------|-------------|
| `/history` | View full chat history for this session |
| `/clear` | Clear conversation context (DB history preserved) |
| `/import <file>` | Import a data file mid-conversation |
| `/bias` | View current AI bias logs |
| `/exit` | Quit |

---

## All CLI Commands

```bash
node src/index.js add-key <provider> <apiKey> [model]   # Save API key
node src/index.js list-keys                              # Show stored keys
node src/index.js chat [options]                         # Start chat
node src/index.js import <filepath>                      # Import data file
node src/index.js set-prompt "You are a supply chain expert"  # Custom system prompt
node src/index.js wipe-keys                              # Delete all API keys
node src/index.js wipe-db                                # Wipe entire database
```

---

## Running Tests

```bash
npm test
```

Tests run independently against the database. They create and clean up their own test data.

---

## Project Structure

```
js-llm-manager/
├── src/
│   ├── index.js           # CLI entry point
│   ├── database.js        # MySQL operations
│   ├── llm-manager.js     # AI provider integration
│   ├── import-data.js     # Excel/CSV data import
│   └── bias-analyzer.js   # Data analysis & journal writer
├── tests/
│   ├── database.test.js   # DB integration tests
│   └── logic.test.js      # Pure logic unit tests
├── scripts/
│   └── setup-db.js        # Database initialization
├── data/                  # Sample OTD datasets
├── bias-journal/          # AI reasoning logs (auto-created)
├── .env                   # Database credentials
├── .env.example           # Credential template
├── package.json
├── jest.config.js
└── README.md
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `api_keys` | Stored provider keys and detected models |
| `chat_history` | All messages per session |
| `training_data` | Q&A pairs generated from imported data |
| `system_configs` | Custom prompts and settings |
| `bias_logs` | AI analysis reasoning per import |
| `data_imports` | Import tracking metadata |

---

## How Data Import Works

1. You run `import` with an `.xlsx` or `.csv` file.
2. The system parses the data and identifies the type (customer OTD, manufacturing OTD, purchase, etc.).
3. It calculates statistics and generates Q&A training entries stored in MySQL.
4. The bias analyzer writes a human-readable journal entry to `bias-journal/`.
5. When you chat, the AI's system prompt automatically includes the imported data context and bias adjustments.

---

## Multi-User / Team Usage

Multiple people can SSH into the same server and use different sessions:

```bash
# User A
node src/index.js chat --session team-session --user alice

# User B (different terminal)
node src/index.js chat --session team-session --user bob
```

Both share the same chat history and imported data.

---

## Troubleshooting

**`ERR_MODULE_NOT_FOUND`** — Run `npm install` to ensure all dependencies are installed.

**`ER_ACCESS_DENIED_ERROR`** — Check MySQL user/password in `.env` matches your MySQL setup.

**`ER_BAD_DB_ERROR`** — The system auto-creates the database. Make sure your MySQL user has `CREATE` privileges.

**Model detection fails** — Specify the model manually: `node src/index.js add-key anthropic YOUR-KEY claude-3-haiku-20240307`

---

## Environment Variables (.env)

```
DB_HOST=localhost
DB_USER=demo-api
DB_PASSWORD=Bridge2AI
DB_NAME=llm_manager
```