<<<<<<< HEAD
# Welcome To the Initial Repo for the Project Specified for Bridge2AI
=======
# AI LLM Manager 🤖

**A terminal-based AI chatbot manager built with Python + MySQL that supports multiple AI providers (Anthropic Claude, OpenAI GPT, Google Gemini, local Ollama models) with persistent chat history, team collaboration, and custom training data.**

---

## 📖 What This Project Does

This application allows you to:

- 💬 **Chat with multiple AI providers** - Switch between Claude, ChatGPT, Gemini, or free local models
- 💾 **Persistent conversation history** - All chats saved to MySQL database with session management
- 👥 **Team collaboration** - Multiple users can share the same conversation sessions via SSH
- 🔑 **Centralized API key management** - Store and switch between multiple provider API keys
- 📚 **Custom training data** - Feed business-specific Q&A data to tailor AI responses
- 🌐 **Cross-platform** - Works on Windows, Linux, macOS
- 🐳 **Docker support** - Containerized deployment option

---

## 🏗️ Tech Stack

- **Language:** Python 3.11+
- **Database:** MySQL 8.0+ (stores chat history, API keys, training data, configurations)
- **AI Provider SDKs:** 
  - `anthropic` - Claude API
  - `openai` - GPT API  
  - `google-generativeai` - Gemini API
  - `requests` - Ollama (local models)
- **Database Driver:** `mysql-connector-python`
- **Configuration:** `python-dotenv` (.env file management)

---

## 🔌 How It Works
```
User Input (Terminal)
        ↓
   LLM Manager (Python)
        ↓
   ┌────┴────┐
   ↓         ↓
API Call   MySQL DB
   ↓         ↓
AI Provider  Save
(Claude/GPT)  Message
   ↓         ↓
Response ← Load History
   ↓
Display to User
```

1. **You type a message** in the terminal
2. **App loads your chat history** from MySQL for context
3. **Sends your message + history** to AI provider (Claude/GPT/Gemini)
4. **AI responds**, app saves both your message and AI response to database
5. **Next message has full context** from previous conversation

**Database stores:**
- Every message (user + AI) with timestamps
- API keys for different providers
- Training data for custom responses
- System configuration (prompts, settings)

---

## 🚀 Complete Setup Guide

### WINDOWS 11 SETUP

#### Step 1: Install Python

**Option A: Using winget (Fastest)**
```powershell
# Open PowerShell as Administrator
# (Right-click Start button → Terminal (Admin))

winget install Python.Python.3.11
```

**Option B: Manual Download**
1. Go to: https://www.python.org/downloads/
2. Download Python 3.11+
3. Run installer
4. ⚠️ **CRITICAL:** Check "Add Python to PATH"
5. Click "Install Now"

**Verify Installation:**
```powershell
# Close and reopen PowerShell
python --version
pip --version
```

Expected output:
```
Python 3.11.x
pip 24.x.x
```

If `python` or `pip` not recognized, use:
```powershell
python -m pip --version
```

---

#### Step 2: Install MySQL with XAMPP

**Why XAMPP:** Easiest MySQL setup for Windows with no password by default.

1. **Download XAMPP:**
   - Go to: https://www.apachefriends.org/download.html
   - Download Windows version
   - Run the `.exe` installer

2. **Install XAMPP:**
   - Click "Next" through installer
   - Install location: `C:\xampp` (default is fine)
   - Complete installation

3. **Start MySQL:**
   - Search "XAMPP Control Panel" in Windows Start
   - Right-click → "Run as Administrator"
   - Click "Start" button next to **MySQL**
   - It should turn green

4. **Add MySQL to PATH (Important for CLI access):**
```powershell
# Open PowerShell as Administrator

# Add MySQL to PATH permanently
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\xampp\mysql\bin", "Machine")

# Close and reopen PowerShell, then test:
mysql --version
```

Expected output:
```
mysql  Ver 8.0.x for Win64 on x86_64
```

**If `mysql` command not found after reopening:**
```powershell
# Use full path temporarily
"C:\xampp\mysql\bin\mysql.exe" --version
```

5. **Verify MySQL is Running:**
```powershell
# Connect to MySQL (XAMPP default has no password)
mysql -u root

# You should see:
# Welcome to the MySQL monitor...
# Type 'exit' to quit
exit
```

---

#### Step 3: Clone/Download This Project

**If using Git:**
```powershell
cd C:\BCIT-T4
git clone https://github.com/YOUR-USERNAME/ai-llm-manager.git
cd ai-llm-manager
```

**If downloading ZIP:**
1. Download and extract to `C:\BCIT-T4\ai-llm-manager`
2. Open PowerShell:
```powershell
cd C:\BCIT-T4\ai-llm-manager
```

---

#### Step 4: Install Python Dependencies
```powershell
# Make sure you're in the project directory
cd C:\BCIT-T4\ai-llm-manager

# Install all required packages
pip install -r requirements.txt
```

Expected output:
```
Collecting mysql-connector-python==8.2.0
Collecting anthropic==0.40.0
Collecting openai==1.54.0
...
Successfully installed ...
```

**If `pip` not recognized:**
```powershell
python -m pip install -r requirements.txt
```

---

#### Step 5: Configure Database (.env file)
```powershell
# Create your .env file from template
copy .env.example .env

# Edit the .env file
notepad .env
```

**For XAMPP (no password):**
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=llm_manager
```

**Important Notes:**
- `DB_PASSWORD=` is **EMPTY** for XAMPP default setup
- If you set a MySQL password, put it after the equals sign
- Save and close the file

**What this does:**
- `DB_HOST=localhost` - MySQL is on your local machine
- `DB_USER=root` - Default MySQL admin user
- `DB_PASSWORD=` - XAMPP has no password by default
- `DB_NAME=llm_manager` - Database name (auto-created on first run)

---

#### Step 6: Get an API Key

**Choose ONE provider to start (Anthropic recommended for demo):**

##### Option A: Anthropic Claude (Recommended)

1. Go to: https://console.anthropic.com/
2. Click "Sign Up" (use Google for fastest setup)
3. Verify your email
4. Click your profile icon (top right) → "API Keys"
5. Click "Create Key"
6. Name it: "LLM Manager Demo"
7. Copy the ENTIRE key (starts with `sk-ant-api03-`)

**Example key format:**
```
sk-ant-api03-abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef9012ghij3456klmn
```

**Free Credits:** New accounts get $5 credit (~500+ messages)

##### Option B: OpenAI ChatGPT

1. Go to: https://platform.openai.com/signup
2. Sign up with email or Google
3. Verify your email
4. Go to: https://platform.openai.com/api-keys
5. Click "Create new secret key"
6. Name it: "LLM Manager"
7. Copy the key (starts with `sk-proj-`)

**Example key format:**
```
sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

**Free Credits:** $5 credit for new accounts

##### Option C: Google Gemini

1. Go to: https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key

**Free Tier:** 60 requests/minute

##### Option D: Ollama (100% Free - Local)

1. Download: https://ollama.ai/download/windows
2. Install and run Ollama
3. Open PowerShell:
```powershell
ollama pull llama2
```

**No API key needed - runs on your computer!**

---

#### Step 7: Add Your API Key to the App
```powershell
cd C:\BCIT-T4\ai-llm-manager

# For Anthropic Claude (replace with YOUR actual key)
python llm_manager.py --add-key anthropic sk-ant-api03-YOUR-ACTUAL-KEY-HERE

# For OpenAI
python llm_manager.py --add-key openai sk-proj-YOUR-ACTUAL-KEY-HERE

# For Gemini
python llm_manager.py --add-key gemini YOUR-KEY-HERE

# For Ollama (no key needed, skip this step)
```

**What happens:**
1. App connects to MySQL
2. Creates database `llm_manager` if it doesn't exist
3. Creates tables: `chat_history`, `api_keys`, `training_data`, `system_configs`
4. Saves your API key to the `api_keys` table

**Expected output:**
```
✓ Connected to MySQL database
✓ Database tables initialized
✓ API key saved for anthropic
```

**What this stores in the database:**
```sql
-- api_keys table
provider    | api_key              | is_active | created_at
------------|----------------------|-----------|-------------------
anthropic   | sk-ant-api03-xxx...  | TRUE      | 2026-02-01 12:00:00
```

---

#### Step 8: Start Chatting!
```powershell
# For Anthropic Claude
python llm_manager.py --provider anthropic --model claude-3-haiku-20240307

# For OpenAI GPT
python llm_manager.py --provider openai --model gpt-4o-mini

# For Gemini
python llm_manager.py --provider gemini --model gemini-pro

# For Ollama (local)
python llm_manager.py --provider ollama --model llama2
```

**You should see:**
```
✓ Connected to MySQL database
✓ Database tables initialized
✓ Active provider: anthropic (claude-3-haiku-20240307)
============================================================
  AI LLM Manager - Chat Session
  Session: default | User: user
  Provider: anthropic | Model: claude-3-haiku-20240307
============================================================

Commands: /history, /clear, /exit
Type your message and press Enter

user> _
```

**Type anything to chat!** Example:
```
user> Hello! What can you help me with?

AI> Hello! I'm an AI assistant that can help you with a wide variety 
of tasks including answering questions, writing, coding, analysis, 
brainstorming ideas, and much more. What would you like help with today?

user> Write a Python function to reverse a string

AI> Here's a simple Python function to reverse a string:

def reverse_string(text):
    return text[::-1]

# Example usage:
original = "Hello World"
reversed_text = reverse_string(original)
print(reversed_text)  # Output: dlroW olleH

user> /exit

Goodbye!
```

---

### LINUX (Ubuntu/Debian) SETUP

#### Step 1: Install Prerequisites
```bash
# Update package list
sudo apt update

# Install Python 3.11+
sudo apt install python3 python3-pip -y

# Install MySQL
sudo apt install mysql-server -y

# Verify installations
python3 --version
mysql --version
```

---

#### Step 2: Secure MySQL
```bash
# Run MySQL secure installation
sudo mysql_secure_installation

# Follow prompts:
# - Set root password (remember this!)
# - Remove anonymous users: Y
# - Disallow root login remotely: Y
# - Remove test database: Y
# - Reload privilege tables: Y
```

---

#### Step 3: Clone Project & Install Dependencies
```bash
# Clone repository
cd ~
git clone https://github.com/YOUR-USERNAME/ai-llm-manager.git
cd ai-llm-manager

# Install Python dependencies
pip3 install -r requirements.txt
```

---

#### Step 4: Configure .env
```bash
# Create .env file
cp .env.example .env

# Edit with nano (or vim/vi)
nano .env
```

**Set your MySQL password:**
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=llm_manager
```

**Save:** `Ctrl+O`, `Enter`, then `Ctrl+X` to exit

---

#### Step 5-8: Same as Windows

Follow Windows Steps 6-8 (getting API key, adding it, chatting)
```bash
# Add API key
python3 llm_manager.py --add-key anthropic sk-ant-YOUR-KEY

# Start chatting
python3 llm_manager.py --provider anthropic --model claude-3-haiku-20240307
```

---

### macOS SETUP

#### Step 1: Install Homebrew (if not installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

---

#### Step 2: Install Prerequisites
```bash
# Install Python
brew install python@3.11

# Install MySQL
brew install mysql

# Start MySQL service
brew services start mysql

# Verify
python3 --version
mysql --version
```

---

#### Step 3: Secure MySQL
```bash
# Set root password
mysql_secure_installation
```

---

#### Step 4-8: Same as Linux

Follow Linux steps 3-8 (clone, configure, add key, chat)

---

### DOCKER SETUP (Any Platform)
```bash
# Make sure Docker is installed
docker --version
docker-compose --version

# Clone project
git clone https://github.com/YOUR-USERNAME/ai-llm-manager.git
cd ai-llm-manager

# Start services
docker-compose up -d

# Check status
docker-compose ps

# Access container
docker exec -it llm_manager_app bash

# Inside container - add API key
python llm_manager.py --add-key anthropic sk-ant-YOUR-KEY

# Start chatting
python llm_manager.py --provider anthropic --model claude-3-haiku-20240307

# Exit container
exit

# Stop services when done
docker-compose down
```

---

## 📚 Usage Examples

### Basic Chat
```powershell
python llm_manager.py --provider anthropic --model claude-3-haiku-20240307
```

### Team Sessions (Multiple Users Share Same Conversation)

**Person 1 (Instructor):**
```powershell
python llm_manager.py --provider anthropic --model claude-3-haiku-20240307 --session team-demo --user instructor
```

**Person 2 (Student) - on another computer or SSH session:**
```powershell
python llm_manager.py --provider anthropic --model claude-3-haiku-20240307 --session team-demo --user student
```

**Both see the same conversation history from MySQL!**

---

### Import Custom Training Data

**Create your CSV file (`company_data.csv`):**
```csv
category,question,answer
support,What are your support hours?,We offer 24/7 chat support and phone support from 9 AM to 6 PM EST.
product,What is your main product?,Our flagship product is an AI chatbot platform for customer support automation.
billing,Can I cancel anytime?,"Yes, you can cancel your subscription at any time with no penalties."
```

**Import it:**
```powershell
python import_csv.py company_data.csv
```

**Use the provided example:**
```powershell
python import_csv.py example_training_data.csv
```

**Now chat with custom knowledge:**
```powershell
python llm_manager.py --provider anthropic --model claude-3-haiku-20240307

user> What are your support hours?

AI> We offer 24/7 chat support and phone support from 9 AM to 6 PM EST.
```

**How it works:**
- Training data stored in MySQL `training_data` table
- Automatically added to AI's context on every message
- AI uses this data to answer questions about your business

---

### Custom System Prompt (Change AI Personality)
```powershell
python llm_manager.py --set-system-prompt "You are a helpful Python coding assistant. Always provide working code examples and explain them clearly."
```

**Stored in MySQL `system_configs` table - persists across sessions**

---

### Chat Commands (Inside Active Chat)

- `/history` - Show all messages in current session
- `/clear` - Clear context (start fresh conversation, but history stays in DB)
- `/exit` - Quit chat session

---

### Switch Between AI Providers
```powershell
# Use Claude (best quality for complex tasks)
python llm_manager.py --provider anthropic --model claude-3-haiku-20240307

# Use GPT (fast and cheap)
python llm_manager.py --provider openai --model gpt-4o-mini

# Use Gemini (free tier)
python llm_manager.py --provider gemini --model gemini-pro

# Use Ollama (100% free, runs locally, works offline)
python llm_manager.py --provider ollama --model llama2
```

---

## 🗄️ Database Schema

**Database:** `llm_manager` (auto-created on first run)

### Table: `chat_history`
Stores every conversation message.
```sql
CREATE TABLE chat_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255),        -- Groups messages by conversation
    user_name VARCHAR(100),          -- Who sent the message
    role ENUM('user', 'assistant'),  -- user = you, assistant = AI
    content TEXT,                    -- The actual message
    model VARCHAR(100),              -- Which AI model was used
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX(session_id),
    INDEX(timestamp)
);
```

**Example data:**
```
id | session_id | user_name | role      | content           | model              | timestamp
---|------------|-----------|-----------|-------------------|--------------------|-------------------
1  | default    | user      | user      | Hello world       | claude-3-haiku...  | 2026-02-01 12:30
2  | default    | user      | assistant | Hi! How can I...  | claude-3-haiku...  | 2026-02-01 12:30
3  | team-demo  | alice     | user      | What's 2+2?       | claude-3-haiku...  | 2026-02-01 12:35
4  | team-demo  | alice     | assistant | 2+2 equals 4      | claude-3-haiku...  | 2026-02-01 12:35
```

---

### Table: `api_keys`
Stores API credentials for different providers.
```sql
CREATE TABLE api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider VARCHAR(50) UNIQUE,     -- anthropic, openai, gemini, etc.
    api_key TEXT,                    -- The actual API key
    is_active BOOLEAN DEFAULT TRUE,  -- Can disable without deleting
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Example data:**
```
id | provider   | api_key              | is_active | created_at
---|------------|----------------------|-----------|-------------------
1  | anthropic  | sk-ant-api03-xxx...  | 1         | 2026-02-01 12:00
2  | openai     | sk-proj-xxx...       | 1         | 2026-02-01 12:05
```

---

### Table: `training_data`
Stores custom Q&A knowledge for business-specific responses.
```sql
CREATE TABLE training_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(100),           -- support, product, billing, etc.
    question TEXT,                   -- Question or topic
    expected_response TEXT,          -- How AI should respond
    metadata JSON,                   -- Extra info (tags, source, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX(category)
);
```

**Example data:**
```
id | category | question                    | expected_response           | created_at
---|----------|-----------------------------|-----------------------------|-------------------
1  | support  | What are support hours?     | 24/7 chat, 9AM-6PM phone   | 2026-02-01 12:00
2  | product  | What do you sell?           | AI chatbot platform        | 2026-02-01 12:00
```

---

### Table: `system_configs`
Stores system-wide settings (system prompts, configurations).
```sql
CREATE TABLE system_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE,  -- system_prompt, default_model, etc.
    config_value TEXT,               -- The actual value
    description TEXT,                -- What this config does
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Example data:**
```
id | config_key    | config_value                          | description
---|---------------|---------------------------------------|----------------------------
1  | system_prompt | You are a helpful coding assistant... | Main AI personality prompt
```

---

## 🔧 Troubleshooting

### Python Issues

**Error: `pip is not recognized`**
```powershell
# Use this instead
python -m pip install -r requirements.txt
```

**Error: `python is not recognized`**
- Python not installed or not in PATH
- Reinstall Python and CHECK "Add Python to PATH"
- Or use full path: `C:\Users\YourName\AppData\Local\Programs\Python\Python311\python.exe`

---

### MySQL Issues

**Error: `Access denied for user 'root'@'localhost'`**

Your password in `.env` is wrong.

**For XAMPP users:**
```env
DB_PASSWORD=
```
(Leave it EMPTY)

**For standalone MySQL users:**
```env
DB_PASSWORD=the_password_you_set_during_install
```

**To reset MySQL password (XAMPP):**
```powershell
# Stop MySQL in XAMPP Control Panel
# Start MySQL in XAMPP Control Panel
# Default password is empty (no password)
```

**To reset MySQL password (Standalone):**
```bash
# Linux/Mac
sudo mysql
ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
exit

# Windows
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p
# Enter old password, then:
ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
exit
```

---

**Error: `mysql command not found` (Windows)**

MySQL not in PATH. Use full path:
```powershell
"C:\xampp\mysql\bin\mysql.exe" -u root

# Or add to PATH permanently:
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\xampp\mysql\bin", "Machine")
```

---

**Error: `Port 3306 already in use` (XAMPP)**

You already have MySQL installed outside XAMPP.

**Option 1: Use existing MySQL**
- Find your MySQL password
- Update `.env` with correct password
- Don't use XAMPP

**Option 2: Stop existing MySQL**
```powershell
# Open Services (Win+R → services.msc)
# Find "MySQL" or "MySQL80"
# Right-click → Stop
# Then start XAMPP MySQL
```

---

### API Key Issues

**Error: `401 Authentication Error - invalid x-api-key`**

Your API key is wrong or expired.

**Fix:**
1. Go back to provider website (console.anthropic.com or platform.openai.com)
2. Create a NEW key
3. Copy the ENTIRE key (don't cut it off)
4. Replace old key:
```powershell
python llm_manager.py --add-key anthropic sk-ant-YOUR-NEW-KEY-HERE
```

---

**Error: `404 Model Not Found`**

Model name is wrong or not available in your account tier.

**Try these working models:**

**Anthropic:**
```powershell
python llm_manager.py --provider anthropic --model claude-3-haiku-20240307
```

**OpenAI:**
```powershell
python llm_manager.py --provider openai --model gpt-4o-mini
```

**Gemini:**
```powershell
python llm_manager.py --provider gemini --model gemini-pro
```

---

**Error: `429 Quota Exceeded`**

You ran out of free credits.

**Fix:**
- Add payment method to your account (OpenAI/Anthropic)
- OR switch to Ollama (free, local):
```powershell
# Install Ollama from https://ollama.ai
ollama pull llama2
python llm_manager.py --provider ollama --model llama2
```

---

### Module/Import Errors

**Error: `ModuleNotFoundError: No module named 'anthropic'`**

Dependencies not installed.
```powershell
pip install -r requirements.txt

# Or install specific package:
pip install anthropic
pip install openai
pip install google-generativeai
pip install mysql-connector-python
```

---

**Error: `TypeError: Client.__init__() got unexpected keyword argument 'proxies'`**

OpenAI library version conflict.
```powershell
pip uninstall openai -y
pip install "openai>=1.0.0,<2.0.0"
```

---

### Database Connection Test

**Test if MySQL is running:**
```powershell
# XAMPP
"C:\xampp\mysql\bin\mysql.exe" -u root

# Standalone
mysql -u root -p

# You should see:
# Welcome to the MySQL monitor...
```

**Test if database exists:**
```powershell
mysql -u root -p

USE llm_manager;
SHOW TABLES;

# Should show:
# chat_history, api_keys, training_data, system_configs
```

---

### Clear Everything and Start Fresh

**Delete all API keys:**
```powershell
mysql -u root -p

USE llm_manager;
DELETE FROM api_keys;
exit
```

**Delete entire database:**
```powershell
mysql -u root -p

DROP DATABASE llm_manager;
exit

# Will be recreated on next run
```

**Reset training data:**
```powershell
mysql -u root -p

USE llm_manager;
DELETE FROM training_data;
exit
```

---

## 🎯 Advanced Features

### Multiple API Keys for Same Provider
```powershell
# Add production key
python llm_manager.py --add-key anthropic sk-ant-prod-key

# Later, replace with staging key
python llm_manager.py --add-key anthropic sk-ant-staging-key

# Only one key per provider is active at a time (last one added)
```

---

### Custom Training Data from Python
```python
from llm_manager import Database

db = Database()

# Add single entry
db.add_training_data(
    category="support",
    question="How do I reset my password?",
    expected_response="Click 'Forgot Password' on the login page and follow the email instructions.",
    metadata={"priority": "high", "source": "support_docs"}
)

# Add multiple entries
faqs = [
    ("billing", "How do I upgrade?", "Go to Account Settings → Billing → Change Plan"),
    ("product", "What's included?", "All plans include API access, 24/7 support, and analytics"),
]

for category, question, answer in faqs:
    db.add_training_data(category, question, answer)

db.close()
print("Training data added!")
```

---

### View All Data in Database
```powershell
mysql -u root -p

USE llm_manager;

-- View all chat messages
SELECT * FROM chat_history ORDER BY timestamp DESC LIMIT 10;

-- View all API keys
SELECT provider, is_active, created_at FROM api_keys;

-- View all training data
SELECT category, question, expected_response FROM training_data;

-- View system config
SELECT * FROM system_configs;

exit
```

---

### Export Chat History
```powershell
mysql -u root -p

USE llm_manager;

-- Export specific session to CSV
SELECT session_id, user_name, role, content, timestamp 
FROM chat_history 
WHERE session_id = 'team-demo'
INTO OUTFILE 'C:/chat_export.csv'
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"'
LINES TERMINATED BY '\n';

exit
```

---

### Run on Remote Server (Team Access)

**On Server:**
```bash
# Install everything (Steps 1-5)
# Start chat with specific session
python3 llm_manager.py --provider anthropic --model claude-3-haiku-20240307 --session team-project --user server
```

**Team Members SSH in:**
```bash
ssh user@server-ip
cd /path/to/ai-llm-manager
python3 llm_manager.py --provider anthropic --model claude-3-haiku-20240307 --session team-project --user alice

# Everyone sees same conversation!
```

---

## 🔐 Security Notes

⚠️ **This is a DEMO project.** For production use:

1. **Encrypt API keys in database**
   - Currently stored as plain text
   - Use `cryptography` library to encrypt before storing

2. **Use environment secrets**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault

3. **Add user authentication**
   - Login system
   - Per-user API keys
   - Role-based access control

4. **Enable SSL/TLS for MySQL**
```python
   connection = mysql.connector.connect(
       ssl_ca='/path/to/ca.pem',
       ssl_disabled=False
   )
```

5. **Rate limiting**
   - Prevent API abuse
   - Track usage per user

6. **Never commit `.env`**
   - Already in `.gitignore`
   - Double-check before pushing to GitHub

---

## 📁 Project Structure
```
ai-llm-manager/
│
├── llm_manager.py              # Main application (530 lines)
│   ├── Database class          # MySQL operations
│   ├── LLMManager class        # AI provider integration
│   └── main() function         # CLI interface
│
├── requirements.txt            # Python dependencies
│   ├── mysql-connector-python  # Database driver
│   ├── anthropic               # Claude API
│   ├── openai                  # GPT API
│   ├── google-generativeai     # Gemini API
│   ├── python-dotenv           # .env file support
│   └── requests                # Ollama API
│
├── .env.example               # Configuration template
├── .env                       # Your config (NOT in git)
│
├── import_csv.py              # Bulk import training data
├── example_training_data.csv  # Sample Q&A data
│
├── demo.py                    # Quick Ollama demo (no API key)
│
├── setup.sh                   # Linux/Mac automated setup
├── setup.bat                  # Windows automated setup
│
├── Dockerfile                 # Docker container config
├── docker-compose.yml         # Docker services (MySQL + App)
│
├── .gitignore                 # Exclude .env, __pycache__, etc.
│
├── README.md                  # This file (complete guide)
├── SETUP_GUIDE.md             # Detailed setup walkthrough
└── PROJECT_STRUCTURE.md       # Architecture documentation
```

---

## 🤝 Contributing

Want to add features or fix bugs?

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Test with multiple providers (Claude, GPT, Gemini)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

---

## 📝 License

MIT License - Free for personal and commercial use.

See `LICENSE` file for details.

---

## 🆘 Support

**Issues:** https://github.com/YOUR-USERNAME/ai-llm-manager/issues

**Questions:** Open a GitHub discussion

**Quick Demo:** Run `python demo.py` (requires Ollama)

---

## ✅ Tested On

- ✅ Windows 11 (Python 3.11 + MySQL 8.0 via XAMPP)
- ✅ Windows 11 (Python 3.11 + MySQL 8.0 standalone)
- ✅ Ubuntu 22.04 LTS (Python 3.10+ + MySQL 8.0)
- ✅ macOS Monterey+ (Python 3.10+ + MySQL 8.0)
- ✅ Docker (Ubuntu 24 base image)

---

## 🎓 Educational Use

This project demonstrates:
- **Database integration** with Python
- **API consumption** (multiple providers)
- **Session management** for multi-user systems
- **Configuration management** (.env files)
- **CLI application** design
- **Error handling** and logging
- **Cross-platform** compatibility
- **Docker containerization**

Perfect for learning full-stack development with Python + MySQL!

---

**Created:** February 2026  
**Last Updated:** February 2026  
**Version:** 1.0.0

**Happy chatting! 🚀**
>>>>>>> 7c8b851 (demo AI api key connector | mysql, python)