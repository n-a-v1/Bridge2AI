@echo off
REM AI LLM Manager - Windows Setup Script

echo ==================================
echo   AI LLM Manager - Setup (Windows)
echo ==================================
echo.

REM Check Python installation
echo Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)
python --version
echo.

REM Check pip
echo Checking pip...
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: pip is not available
    pause
    exit /b 1
)
echo pip is available
echo.

REM Install dependencies
echo Installing Python dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo.

REM Check MySQL
echo Checking for MySQL...
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo WARNING: MySQL not detected
    echo.
    echo You need to install MySQL:
    echo   1. Download from: https://dev.mysql.com/downloads/installer/
    echo   2. Or install via winget: winget install Oracle.MySQL
    echo   3. Or use XAMPP: https://www.apachefriends.org/
    echo.
    pause
) else (
    mysql --version
)
echo.

REM Create .env file
if not exist .env (
    echo Creating .env configuration file...
    copy .env.example .env
    echo.
    echo IMPORTANT: Edit .env file with your database credentials
    echo You can use Notepad: notepad .env
    echo.
) else (
    echo .env file already exists
    echo.
)

echo ==================================
echo   Setup Complete!
echo ==================================
echo.
echo Next steps:
echo.
echo 1. Edit .env file with your database credentials:
echo    notepad .env
echo.
echo 2. Make sure MySQL is running:
echo    - If using XAMPP: Start MySQL from XAMPP Control Panel
echo    - If using MySQL Service: Check Services (services.msc)
echo.
echo 3. Add an API key (choose one):
echo    python llm_manager.py --add-key anthropic YOUR_KEY
echo    python llm_manager.py --add-key openai YOUR_KEY
echo    python llm_manager.py --add-key gemini YOUR_KEY
echo.
echo 4. Start chatting:
echo    python llm_manager.py
echo.
echo For free local model (Ollama):
echo    1. Install: https://ollama.ai/download/windows
echo    2. Run: ollama pull llama2
echo    3. Run: python llm_manager.py --provider ollama --model llama2
echo.
pause
