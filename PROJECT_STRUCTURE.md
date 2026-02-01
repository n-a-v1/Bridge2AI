# AI LLM Manager - Project Structure

```
ai-llm-manager/
│
├── llm_manager.py              # Main application (CLI chat interface)
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── README.md                    # Complete documentation
│
├── setup.sh                     # Linux/Mac setup script
├── setup.bat                    # Windows setup script
├── demo.py                      # Quick demo with Ollama (no API key)
├── import_csv.py                # Utility to import CSV training data
├── example_training_data.csv    # Sample training dataset
│
├── Dockerfile                   # Docker container configuration
└── docker-compose.yml           # Docker Compose for MySQL + App

```

## File Descriptions

### Core Application
- **llm_manager.py** (530 lines)
  - Database class: MySQL connection and operations
  - LLMManager class: Multi-provider AI integration
  - CLI interface with argument parsing
  - Chat loop with history management
  - Supports: Anthropic Claude, OpenAI, Google Gemini, Ollama

### Configuration
- **.env.example**
  - Database connection template
  - API key placeholders
  - Copy to `.env` and customize

### Documentation
- **README.md** (comprehensive)
  - Quick start guide
  - All features explained
  - API provider setup
  - Team sharing instructions
  - Security considerations
  - Troubleshooting

### Setup Scripts
- **setup.sh** - Automated Linux/Mac setup
  - Checks Python/pip/MySQL
  - Installs dependencies
  - Creates .env file
  - Shows next steps

- **setup.bat** - Windows 11 setup
  - Same as setup.sh but for Windows
  - Checks for XAMPP or MySQL

### Demo & Testing
- **demo.py**
  - Zero-config demo using Ollama
  - Sets up sample training data
  - Runs interactive chat
  - No API key required

- **import_csv.py**
  - Bulk import training data from CSV
  - Validates format
  - Error handling

- **example_training_data.csv**
  - 12 sample Q&A pairs
  - Categories: product, support, billing, technical
  - Ready to import

### Deployment
- **Dockerfile**
  - Python 3.11 slim base
  - MySQL client included
  - All dependencies installed

- **docker-compose.yml**
  - MySQL 8.0 service
  - App service with health checks
  - Persistent volume for data
  - Network isolation

## Database Schema

### Tables Created (Auto-initialized)

1. **chat_history**
   - Stores all conversation messages
   - Indexed by session_id and timestamp
   - Supports multi-user sessions

2. **api_keys**
   - Stores provider credentials
   - Provider field is unique
   - Active/inactive flag

3. **training_data**
   - Custom knowledge base
   - Categorized Q&A pairs
   - JSON metadata field

4. **system_configs**
   - System-wide settings
   - Key-value store
   - Includes system prompts

## Usage Patterns

### Basic Chat
```bash
python llm_manager.py
```

### Team Session
```bash
python llm_manager.py --session project-alpha --user alice
```

### Custom Business Bot
```bash
# 1. Import knowledge
python import_csv.py company_faq.csv

# 2. Set personality
python llm_manager.py --set-system-prompt "You are AcmeCorp's support bot"

# 3. Start session
python llm_manager.py --session support
```

### Multi-Provider Workflow
```bash
# Quick tasks: Use fast/cheap model
python llm_manager.py --provider openai --model gpt-4o-mini

# Complex reasoning: Use powerful model
python llm_manager.py --provider anthropic --model claude-sonnet-4-20250514

# Privacy-critical: Use local model
python llm_manager.py --provider ollama --model llama2
```

## Architecture Highlights

- **Modular Design**: Database, LLM Manager, and CLI are separate
- **Provider Agnostic**: Easy to add new LLM providers
- **Session-based**: Multiple concurrent chat sessions
- **Training Data**: Augments context automatically
- **Cross-platform**: Works on Windows, Linux, macOS
- **Docker-ready**: Full containerization support

## Security Notes

⚠️ **This is a demo project**. For production:
1. Encrypt API keys in database
2. Use environment variable secrets
3. Implement user authentication
4. Add rate limiting
5. Use SSL for database connections
6. Sanitize all inputs
7. Implement audit logging

## Extension Ideas

- [ ] Add more LLM providers (Cohere, AI21, etc.)
- [ ] Web interface (Flask/FastAPI)
- [ ] Voice input/output
- [ ] Multi-language support
- [ ] Conversation export (PDF, JSON)
- [ ] Usage analytics dashboard
- [ ] Role-based access control
- [ ] Vector database for semantic search
- [ ] RAG (Retrieval Augmented Generation)
- [ ] Fine-tuning pipeline

## Dependencies

### Required
- Python 3.8+
- MySQL 5.7+ or MariaDB 10.3+

### Python Packages
- mysql-connector-python (database)
- anthropic (Claude API)
- openai (GPT API)
- google-generativeai (Gemini API)
- python-dotenv (config)
- requests (Ollama)

### Optional
- Docker & Docker Compose (deployment)
- Ollama (local AI)

## Development

### Running Tests
```bash
# Test database connection
python -c "from llm_manager import Database; db = Database(); print('✓ DB OK')"

# Test with demo data
python demo.py

# Import test data
python import_csv.py example_training_data.csv
```

### Contributing
1. Fork the repository
2. Create feature branch
3. Test with multiple providers
4. Submit pull request

## License

MIT License - Free for personal and commercial use

## Support

- GitHub Issues: Report bugs
- Documentation: See README.md
- Demo: Run `python demo.py`
