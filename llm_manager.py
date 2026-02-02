#!/usr/bin/env python3
"""
AI LLM Manager - Terminal-based chat interface with multi-provider support
Supports: Anthropic Claude, OpenAI, Google Gemini, and Ollama (local)
"""

import os
import sys
import json
import mysql.connector
from datetime import datetime
from typing import Optional, List, Dict
import anthropic
from dotenv import load_dotenv

load_dotenv()


class Database:
    def __init__(self):
        self.connection = None
        self.connect()
        self.initialize_tables()

    def connect(self):
        try:
            self.connection = mysql.connector.connect(
                host=os.getenv("DB_HOST", "localhost"),
                user=os.getenv("DB_USER", "root"),
                password=os.getenv("DB_PASSWORD", ""),
                database=os.getenv("DB_NAME", "llm_manager"),
            )
            print("✓ Connected to MySQL database")
        except mysql.connector.Error as err:
            if err.errno == 1049:
                self.create_database()
            else:
                print(f"✗ Database connection error: {err}")
                sys.exit(1)

    def create_database(self):
        try:
            temp_conn = mysql.connector.connect(
                host=os.getenv("DB_HOST", "localhost"),
                user=os.getenv("DB_USER", "root"),
                password=os.getenv("DB_PASSWORD", ""),
            )
            cursor = temp_conn.cursor()
            cursor.execute(f"CREATE DATABASE {os.getenv('DB_NAME', 'llm_manager')}")
            cursor.close()
            temp_conn.close()
            self.connect()
        except mysql.connector.Error as err:
            print(f"✗ Error creating database: {err}")
            sys.exit(1)

    def initialize_tables(self):
        cursor = self.connection.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(255),
                user_name VARCHAR(100),
                role ENUM('user', 'assistant', 'system'),
                content TEXT,
                model VARCHAR(100),
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX(session_id),
                INDEX(timestamp)
            )
        """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS api_keys (
                id INT AUTO_INCREMENT PRIMARY KEY,
                provider VARCHAR(50) UNIQUE,
                api_key TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS training_data (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category VARCHAR(100),
                question TEXT,
                expected_response TEXT,
                metadata JSON,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX(category)
            )
        """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS system_configs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                config_key VARCHAR(100) UNIQUE,
                config_value TEXT,
                description TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """
        )

        self.connection.commit()
        cursor.close()
        print("✓ Database tables initialized")

    def save_message(
        self, session_id: str, user_name: str, role: str, content: str, model: str
    ):
        cursor = self.connection.cursor()
        cursor.execute(
            """
            INSERT INTO chat_history (session_id, user_name, role, content, model)
            VALUES (%s, %s, %s, %s, %s)
        """,
            (session_id, user_name, role, content, model),
        )
        self.connection.commit()
        cursor.close()

    def get_chat_history(self, session_id: str, limit: int = 50) -> List[Dict]:
        cursor = self.connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT role, content, timestamp, model
            FROM chat_history
            WHERE session_id = %s
            ORDER BY timestamp DESC
            LIMIT %s
        """,
            (session_id, limit),
        )
        results = cursor.fetchall()
        cursor.close()
        return list(reversed(results))

    def save_api_key(self, provider: str, api_key: str):
        cursor = self.connection.cursor()
        cursor.execute(
            """
            INSERT INTO api_keys (provider, api_key)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE api_key = %s, updated_at = CURRENT_TIMESTAMP
        """,
            (provider, api_key, api_key),
        )
        self.connection.commit()
        cursor.close()

    def get_api_key(self, provider: str) -> Optional[str]:
        cursor = self.connection.cursor()
        cursor.execute(
            """
            SELECT api_key FROM api_keys
            WHERE provider = %s AND is_active = TRUE
        """,
            (provider,),
        )
        result = cursor.fetchone()
        cursor.close()
        return result[0] if result else None

    def add_training_data(
        self,
        category: str,
        question: str,
        expected_response: str,
        metadata: dict = None,
    ):
        cursor = self.connection.cursor()
        cursor.execute(
            """
            INSERT INTO training_data (category, question, expected_response, metadata)
            VALUES (%s, %s, %s, %s)
        """,
            (category, question, expected_response, json.dumps(metadata or {})),
        )
        self.connection.commit()
        cursor.close()

    def get_training_data(self, category: str = None) -> List[Dict]:
        cursor = self.connection.cursor(dictionary=True)
        if category:
            cursor.execute(
                "SELECT * FROM training_data WHERE category = %s", (category,)
            )
        else:
            cursor.execute("SELECT * FROM training_data")
        results = cursor.fetchall()
        cursor.close()
        return results

    def set_system_config(self, key: str, value: str, description: str = ""):
        cursor = self.connection.cursor()
        cursor.execute(
            """
            INSERT INTO system_configs (config_key, config_value, description)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE config_value = %s, description = %s
        """,
            (key, value, description, value, description),
        )
        self.connection.commit()
        cursor.close()

    def get_system_config(self, key: str) -> Optional[str]:
        cursor = self.connection.cursor()
        cursor.execute(
            "SELECT config_value FROM system_configs WHERE config_key = %s", (key,)
        )
        result = cursor.fetchone()
        cursor.close()
        return result[0] if result else None

    def clear_chat_history(self, session_id: str):
        cursor = self.connection.cursor()
        cursor.execute("DELETE FROM chat_history WHERE session_id = %s", (session_id,))
        self.connection.commit()
        cursor.close()

    def close(self):
        if self.connection:
            self.connection.close()


class LLMManager:
    def __init__(self, db: Database):
        self.db = db
        self.current_provider = None
        self.client = None
        self.model = None

    def set_provider(self, provider: str, model: str = None):
        api_key = self.db.get_api_key(provider)

        if not api_key and provider != "ollama":
            print(f"✗ No API key found for {provider}")
            print(f"  Use: python llm_manager.py --add-key {provider} <your-key>")
            return False

        self.current_provider = provider

        if provider == "anthropic":
            self.client = anthropic.Anthropic(api_key=api_key)
            self.model = model or "claude-3-5-sonnet-20241022"
        elif provider == "openai":
            import openai

            self.client = openai.OpenAI(api_key=api_key)
            self.model = model or "gpt-4o-mini"
        elif provider == "gemini":
            from google import genai

            self.client = genai.Client(api_key=api_key)
            self.model = model or "gemini-2.0-flash"
        elif provider == "ollama":
            self.model = model or "llama2"
            print("⚠ Ollama provider selected - ensure Ollama is running locally")

        print(f"✓ Active provider: {provider} ({self.model})")
        return True

    def chat(
        self,
        user_message: str,
        session_id: str,
        user_name: str,
        context: List[Dict] = None,
    ) -> str:
        training_data = self.db.get_training_data()
        system_prompt = self._build_system_prompt(training_data)

        messages = []
        if context:
            for msg in context[-10:]:
                messages.append({"role": msg["role"], "content": msg["content"]})

        self.db.save_message(session_id, user_name, "user", user_message, self.model)

        try:
            if self.current_provider == "anthropic":
                response = self._chat_anthropic(system_prompt, messages, user_message)
            elif self.current_provider == "openai":
                response = self._chat_openai(system_prompt, messages, user_message)
            elif self.current_provider == "gemini":
                response = self._chat_gemini(system_prompt, messages, user_message)
            elif self.current_provider == "ollama":
                response = self._chat_ollama(system_prompt, messages, user_message)
            else:
                response = "Error: No provider configured"

            self.db.save_message(
                session_id, user_name, "assistant", response, self.model
            )
            return response

        except Exception as e:
            error_msg = f"Error: {str(e)}"
            print(f"\n✗ {error_msg}")
            return error_msg

    def _build_system_prompt(self, training_data: List[Dict]) -> str:
        # FIX 1: Add time context to stop the "date loop"
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        base_prompt = f"Current Time: {current_time}\n"
        base_prompt += (
            self.db.get_system_config("system_prompt")
            or "You are a helpful AI assistant."
        )

        # FIX 2: Explicit instruction for grounding
        base_prompt += "\nIMPORTANT: If the user asks for weather, news, or time-sensitive data, ALWAYS use the Google Search tool."

        if training_data:
            examples = "\n\nCustom Knowledge Base:\n"
            for item in training_data[:20]:
                examples += f"\nQ: {item['question']}\nA: {item['expected_response']}\n"
            base_prompt += examples

        return base_prompt

    def _chat_anthropic(
        self, system_prompt: str, messages: List[Dict], user_message: str
    ) -> str:
        messages.append({"role": "user", "content": user_message})
        response = self.client.messages.create(
            model=self.model, max_tokens=1024, system=system_prompt, messages=messages
        )
        return response.content[0].text

    def _chat_openai(
        self, system_prompt: str, messages: List[Dict], user_message: str
    ) -> str:
        messages.insert(0, {"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_message})
        response = self.client.chat.completions.create(
            model=self.model, messages=messages
        )
        return response.choices[0].message.content

    def _chat_gemini(
        self, system_prompt: str, messages: List[Dict], user_message: str
    ) -> str:
        # Build conversation context manually for better grounding control
        conversation_text = f"{system_prompt}\n\n"

        for msg in messages:
            role = "User" if msg["role"] == "user" else "Assistant"
            conversation_text += f"{role}: {msg['content']}\n\n"

        conversation_text += f"User: {user_message}"

        # FIX 3: Ensure tools are properly configured for the new SDK
        response = self.client.models.generate_content(
            model=self.model,
            contents=conversation_text,
            config={"tools": [{"google_search": {}}]},
        )
        return response.text

    def _chat_ollama(
        self, system_prompt: str, messages: List[Dict], user_message: str
    ) -> str:
        import requests

        messages.insert(0, {"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_message})
        response = requests.post(
            "http://localhost:11434/api/chat",
            json={"model": self.model, "messages": messages, "stream": False},
        )
        return response.json()["message"]["content"]


def main():
    import argparse

    parser = argparse.ArgumentParser(description="AI LLM Manager")
    parser.add_argument("--add-key", nargs=2, metavar=("PROVIDER", "KEY"))
    parser.add_argument("--provider", default="anthropic")
    parser.add_argument("--model")
    parser.add_argument("--session", default="default")
    parser.add_argument("--user", default=os.getenv("USER", "user"))
    parser.add_argument("--add-training", action="store_true")
    parser.add_argument("--set-system-prompt")

    args = parser.parse_args()
    db = Database()

    if args.add_key:
        provider, key = args.add_key
        db.save_api_key(provider, key)
        print(f"✓ API key saved for {provider}")
        db.close()
        return

    if args.set_system_prompt:
        db.set_system_config(
            "system_prompt", args.set_system_prompt, "Main system prompt"
        )
        print("✓ System prompt updated")
        db.close()
        return

    if args.add_training:
        print("\n=== Add Training Data ===")
        db.add_training_data(
            input("Category: "), input("Question: "), input("Expected Response: ")
        )
        print("✓ Training data added")
        db.close()
        return

    llm = LLMManager(db)
    if not llm.set_provider(args.provider, args.model):
        db.close()
        return

    print(f"\n{'='*60}")
    print(f"  AI LLM Manager - Chat Session")
    print(f"  Session: {args.session} | User: {args.user}")
    print(f"  Provider: {args.provider} | Model: {llm.model}")
    print(f"{'='*60}\n")
    print("Commands: /history, /clear, /exit")
    print("Type your message and press Enter\n")

    history = db.get_chat_history(args.session)
    if history:
        print(f"--- Previous Messages ({len(history)}) ---")
        for msg in history[-5:]:
            print(
                f"[{msg['timestamp'].strftime('%H:%M')}] {msg['role'].upper()}: {msg['content'][:100]}..."
            )
        print()

    try:
        while True:
            user_input = input(f"{args.user}> ").strip()
            if not user_input:
                continue

            if user_input == "/exit":
                break
            if user_input == "/history":
                for msg in db.get_chat_history(args.session):
                    print(f"[{msg['timestamp']}] {msg['role']}: {msg['content']}")
                continue
            if user_input == "/clear":
                db.clear_chat_history(args.session)
                print("✓ Chat history cleared from database")
                continue

            response = llm.chat(user_input, args.session, args.user, history)
            print(f"\nAI> {response}\n")
            history = db.get_chat_history(args.session)

    except KeyboardInterrupt:
        print("\n\nGoodbye!")
    finally:
        db.close()


if __name__ == "__main__":
    main()
