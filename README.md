# PRODUCTION READY - SQL Query System

✅ TESTED AND WORKING

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
node src/index.js add-key anthropic <YOUR-KEY>
```

### 5. Import Data

```bash
node src/index.js import "data/KPI Data - COTD.xlsx"
node src/index.js import "data/KPI Data - MOTD.xlsx"
node src/index.js import "data/Purchase Data.xlsx"
```

or

```bash
cd <project main dir>
mkdir data
for file in data/*.xlsx;
```

### 6. Start Chatting

```bash
node src/index.js chat

# Or with options: (currently fixing)
node src/index.js chat --provider anthropic --session demo --user nick
```

## Project Structure

```bash
js-llm-manager/
│   .env                                # Database credentials
│   .env_Zone.Identifier
│   .gitignore
│   .gitignore_Zone.Identifier
│   data/                               # Sample OTD datasets
│   package.json
│   package.json_Zone.Identifier
│   README.md
│   README.md_Zone.Identifier
│
├───scripts
│       setup-db.js                     # Database initialization
│       setup-db.js_Zone.Identifier
│
└───src
        database.js                     # MySQL operations
        database.js_Zone.Identifier
        import-data.js                  # Excel/CSV data import
        import-data.js_Zone.Identifier
        index.js                        # CLI entry point
        index.js_Zone.Identifier
        llm-manager.js                  # AI provider integration
        llm-manager.js_Zone.Identifier
```

## Environment Variables (.env)

```
DB_HOST=localhost
DB_USER=demo-api
DB_PASSWORD=Bridge2AI
DB_NAME=llm_manager
```

## Test

Try these:

- List all orders late in December 2025
- Who are the top 5 customers with delayed orders in 2024 and 2025?
- Which part numbers had the most delays in 2025?

All queries work!
