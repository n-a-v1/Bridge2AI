# QUICK START GUIDE 🚀

Get your AI LLM Manager running in **5 minutes**!

## For Windows 11 Users

### Step 1: Install Prerequisites
```powershell
# Install Python (if not installed)
winget install Python.Python.3.11

# Install MySQL (choose one option)
# Option A: Via winget
winget install Oracle.MySQL

# Option B: Download XAMPP (easier for beginners)
# https://www.apachefriends.org/download.html
```

### Step 2: Setup Project
```powershell
# Navigate to project folder
cd path\to\ai-llm-manager

# Run setup script
setup.bat

# Edit database credentials
notepad .env
```

### Step 3: Choose Your AI Provider

**Option A: Free Local AI (Recommended for testing)**
```powershell
# Install Ollama
# Download from: https://ollama.ai/download/windows

# Pull a model
ollama pull llama2

# Run demo
python demo.py
```

**Option B: Cloud AI (Better quality, requires API key)**
```powershell
# Get free API key from:
# Anthropic: https://console.anthropic.com/
# OpenAI: https://platform.openai.com/

# Add your API key
python llm_manager.py --add-key anthropic sk-ant-xxxxx

# Start chatting
python llm_manager.py
```

---

## For Linux Users

### Step 1: Install Prerequisites
```bash
# Update system
sudo apt update

# Install Python & MySQL
sudo apt install python3 python3-pip mysql-server

# Secure MySQL
sudo mysql_secure_installation
```

### Step 2: Setup Project
```bash
# Navigate to project
cd ~/ai-llm-manager

# Run setup
chmod +x setup.sh
./setup.sh

# Edit config
nano .env
```

### Step 3: Choose Your AI Provider

**Option A: Free Local AI**
```bash
# Install Ollama
curl https://ollama.ai/install.sh | sh

# Pull model
ollama pull llama2

# Run demo
python3 demo.py
```

**Option B: Cloud AI**
```bash
# Add API key
python3 llm_manager.py --add-key anthropic sk-ant-xxxxx

# Start chatting
python3 llm_manager.py
```

---

## Using Docker (Any Platform)

```bash
# Build and run
docker-compose up -d

# Access container
docker exec -it llm_manager_app bash

# Inside container
python llm_manager.py --add-key anthropic YOUR_KEY
python llm_manager.py
```

---

## Common First Tasks

### 1. Import Company Knowledge
```bash
# Edit example_training_data.csv with your data
# Then import it:
python import_csv.py example_training_data.csv
```

### 2. Customize AI Personality
```bash
python llm_manager.py --set-system-prompt "You are ACME Corp's friendly support assistant. Always be helpful and professional."
```

### 3. Start Team Session
```bash
# On shared server, each team member runs:
python llm_manager.py --session team-project --user alice
```

### 4. Switch Between AI Models
```bash
# Fast & cheap
python llm_manager.py --provider openai --model gpt-4o-mini

# Most capable
python llm_manager.py --provider anthropic --model claude-sonnet-4-20250514

# Privacy-first (local)
python llm_manager.py --provider ollama --model llama2
```

---

## Getting API Keys (Free Tiers)

### Anthropic Claude
1. Go to: https://console.anthropic.com/
2. Sign up (free)
3. Get API key from dashboard
4. Free tier: Limited usage
5. Best model: `claude-3-5-sonnet-20241022`

### OpenAI GPT
1. Go to: https://platform.openai.com/
2. Sign up
3. Get $5 free credit
4. Best budget model: `gpt-4o-mini`

### Google Gemini
1. Go to: https://ai.google.dev/
2. Get API key
3. Free tier: 60 requests/minute
4. Model: `gemini-pro`

### Ollama (Completely Free, Local)
1. Install: https://ollama.ai
2. Pull models: `ollama pull llama2`
3. No API key needed!
4. Runs on your machine

---

## Troubleshooting

### "Database connection error"
```bash
# Check MySQL is running
# Windows (XAMPP): Start MySQL in XAMPP Control Panel
# Linux: sudo systemctl start mysql

# Test connection
mysql -u root -p -e "SHOW DATABASES;"
```

### "ModuleNotFoundError"
```bash
pip install -r requirements.txt
```

### "API key invalid"
```bash
# Re-add with correct key
python llm_manager.py --add-key anthropic sk-ant-CORRECT-KEY
```

### Ollama won't connect
```bash
# Start Ollama server
ollama serve

# In another terminal, test
ollama list
```

---

## Next Steps

✅ You're all set! Now you can:

1. **Chat with AI**: Just run `python llm_manager.py`
2. **Add team members**: Share server access via SSH
3. **Customize responses**: Import your business data
4. **Try different models**: Switch providers anytime

📖 **Read the full documentation**: `README.md`

🐛 **Found a bug?**: Open an issue on GitHub

💡 **Need help?**: Check `PROJECT_STRUCTURE.md`

---

## Example Session

```bash
$ python llm_manager.py --session demo --user john

========================================
  AI LLM Manager - Chat Session
  Session: demo | User: john
  Provider: anthropic | Model: claude-3-5-sonnet-20241022
========================================

Commands: /history, /clear, /exit
Type your message and press Enter

john> What does our company do?

AI> Based on the training data, our company develops AI-powered 
solutions for enterprise clients, specializing in customer support 
automation and data analysis.

john> What are our support hours?

AI> We offer 24/7 chat support and phone support from 9 AM to 6 PM 
EST Monday through Friday.

john> /exit

Goodbye!
```

**Happy chatting! 🎉**
