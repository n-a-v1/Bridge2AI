#!/bin/bash
# AI LLM Manager - Quick Setup Script
# Works on Linux and WSL (Windows Subsystem for Linux)

echo "=================================="
echo "  AI LLM Manager - Setup"
echo "=================================="
echo ""

# Check Python version
echo "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | grep -oP '\d+\.\d+')
echo "✓ Python $PYTHON_VERSION detected"

# Check pip
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Installing..."
    sudo apt-get update
    sudo apt-get install -y python3-pip
fi
echo "✓ pip3 detected"

# Install Python dependencies
echo ""
echo "Installing Python dependencies..."
pip3 install -r requirements.txt

# Check MySQL
echo ""
echo "Checking MySQL installation..."
if ! command -v mysql &> /dev/null; then
    echo "⚠️  MySQL is not installed."
    read -p "Would you like to install MySQL? (y/n): " install_mysql
    
    if [ "$install_mysql" = "y" ]; then
        echo "Installing MySQL..."
        sudo apt-get update
        sudo apt-get install -y mysql-server
        sudo systemctl start mysql
        sudo mysql_secure_installation
    else
        echo "⚠️  Skipping MySQL installation. You'll need to install it manually."
    fi
else
    echo "✓ MySQL detected"
fi

# Create .env file
echo ""
if [ ! -f .env ]; then
    echo "Creating .env configuration file..."
    cp .env.example .env
    echo "✓ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file with your database credentials:"
    echo "   nano .env"
else
    echo "✓ .env file already exists"
fi

# Create example training data script
cat > add_example_data.py << 'EOF'
"""Add example training data for testing"""
from llm_manager import Database

print("Adding example training data...")
db = Database()

# Example business data
examples = [
    {
        "category": "company_info",
        "question": "What does our company do?",
        "response": "We develop AI-powered solutions for enterprise clients, specializing in customer support automation and data analysis."
    },
    {
        "category": "company_info", 
        "question": "Where are we located?",
        "response": "Our headquarters is in San Francisco, with remote team members worldwide."
    },
    {
        "category": "product",
        "question": "What is our main product?",
        "response": "Our flagship product is an AI chatbot platform that integrates with existing customer support systems."
    },
    {
        "category": "support",
        "question": "What are our support hours?",
        "response": "We offer 24/7 chat support and phone support from 9 AM to 6 PM EST Monday through Friday."
    }
]

for ex in examples:
    db.add_training_data(
        category=ex["category"],
        question=ex["question"],
        expected_response=ex["response"]
    )

print(f"✓ Added {len(examples)} training examples")
db.close()
EOF

echo ""
echo "=================================="
echo "  Setup Complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Edit .env file with your database credentials:"
echo "   nano .env"
echo ""
echo "2. Add an API key (choose one):"
echo "   python3 llm_manager.py --add-key anthropic YOUR_KEY"
echo "   python3 llm_manager.py --add-key openai YOUR_KEY"
echo "   python3 llm_manager.py --add-key gemini YOUR_KEY"
echo ""
echo "3. (Optional) Add example training data:"
echo "   python3 add_example_data.py"
echo ""
echo "4. Start chatting:"
echo "   python3 llm_manager.py"
echo ""
echo "For Ollama (free local model):"
echo "   1. Install Ollama: curl https://ollama.ai/install.sh | sh"
echo "   2. Pull a model: ollama pull llama2"
echo "   3. Run: python3 llm_manager.py --provider ollama --model llama2"
echo ""
