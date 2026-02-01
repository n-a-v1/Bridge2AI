#!/usr/bin/env python3
"""
Quick Demo Script - Test the LLM Manager with Ollama (no API key needed)
This script demonstrates the system using a free local model via Ollama
"""

import os
import sys
import subprocess
import time

def check_ollama():
    """Check if Ollama is installed and running"""
    try:
        subprocess.run(['ollama', 'list'], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def setup_ollama():
    """Guide user through Ollama setup"""
    print("\n" + "="*60)
    print("  OLLAMA SETUP (Free Local AI)")
    print("="*60 + "\n")
    
    if not check_ollama():
        print("Ollama is not installed.\n")
        print("To install Ollama:")
        print("  Linux/Mac: curl https://ollama.ai/install.sh | sh")
        print("  Windows: Download from https://ollama.ai/download\n")
        
        response = input("Have you installed Ollama? (y/n): ")
        if response.lower() != 'y':
            print("\nPlease install Ollama and run this script again.")
            sys.exit(0)
    
    print("✓ Ollama is installed\n")
    
    # Check if llama2 is available
    print("Checking for llama2 model...")
    result = subprocess.run(['ollama', 'list'], capture_output=True, text=True)
    
    if 'llama2' not in result.stdout:
        print("Downloading llama2 model (this may take a few minutes)...")
        print("Model size: ~3.8 GB\n")
        subprocess.run(['ollama', 'pull', 'llama2'])
    else:
        print("✓ llama2 model is ready\n")

def run_demo():
    """Run the demo"""
    print("\n" + "="*60)
    print("  AI LLM MANAGER - DEMO")
    print("="*60 + "\n")
    
    print("This demo will:")
    print("  1. Set up the database")
    print("  2. Add example training data")
    print("  3. Start a chat session with Ollama (local AI)\n")
    
    input("Press Enter to continue...")
    
    # Import and setup
    print("\nInitializing database...")
    from llm_manager import Database, LLMManager
    
    db = Database()
    print("✓ Database ready\n")
    
    # Add training data
    print("Adding example business knowledge...")
    examples = [
        ("company", "What does ACME Corp do?", 
         "ACME Corp develops cutting-edge AI solutions for businesses."),
        ("support", "What are your support hours?", 
         "We offer 24/7 chat support and phone support 9 AM - 6 PM EST."),
        ("product", "What's your main product?", 
         "Our flagship product is an AI chatbot platform for customer support."),
    ]
    
    for category, question, answer in examples:
        db.add_training_data(category, question, answer)
    
    print(f"✓ Added {len(examples)} knowledge examples\n")
    
    # Set system prompt
    print("Configuring AI personality...")
    db.set_system_config(
        'system_prompt',
        "You are a helpful AI assistant for ACME Corp. Be professional, "
        "friendly, and use the knowledge base when answering questions about the company."
    )
    print("✓ System prompt configured\n")
    
    # Initialize LLM
    print("Starting Ollama AI (this might take a moment)...")
    llm = LLMManager(db)
    
    if not llm.set_provider('ollama', 'llama2'):
        print("\n✗ Could not connect to Ollama")
        print("Make sure Ollama is running: ollama serve")
        db.close()
        sys.exit(1)
    
    print("\n" + "="*60)
    print("  DEMO CHAT SESSION")
    print("="*60)
    print("\nYou can now chat with the AI!")
    print("Try asking: 'What does ACME Corp do?'")
    print("Type '/exit' to quit\n")
    
    session_id = f"demo-{int(time.time())}"
    history = []
    
    try:
        while True:
            user_input = input("You> ").strip()
            
            if not user_input:
                continue
            
            if user_input.lower() == '/exit':
                break
            
            print("\nAI> ", end='', flush=True)
            response = llm.chat(user_input, session_id, 'demo-user', history)
            print(response + "\n")
            
            history = db.get_chat_history(session_id)
    
    except KeyboardInterrupt:
        print("\n\nDemo ended!")
    
    finally:
        db.close()
        print("\n" + "="*60)
        print("  DEMO COMPLETE")
        print("="*60)
        print("\nTo run with a real API key:")
        print("  1. Get API key from Anthropic/OpenAI/Google")
        print("  2. python llm_manager.py --add-key anthropic YOUR_KEY")
        print("  3. python llm_manager.py --provider anthropic\n")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  AI LLM MANAGER - QUICK DEMO")
    print("="*60)
    print("\nThis demo uses Ollama (free local AI)")
    print("No API keys required!\n")
    
    try:
        setup_ollama()
        run_demo()
    except Exception as e:
        print(f"\n✗ Error: {e}")
        print("\nIf you prefer to use cloud APIs instead:")
        print("  python llm_manager.py --add-key anthropic YOUR_KEY")
        print("  python llm_manager.py --provider anthropic")
        sys.exit(1)
