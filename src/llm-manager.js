// src/llm-manager.js
// Provider SDKs are loaded lazily so a missing package won't crash the whole app.
import Database from './database.js';

class LLMManager {
  constructor(db) {
    this.db = db;
    this.currentProvider = null;
    this.client = null;
    this.model = null;
  }

  // ── Lazy SDK loaders ──────────────────────────────────
  // Each provider SDK is imported only when needed.

  async _loadAnthropic() {
    try {
      const mod = await import('@anthropic-ai/sdk');
      return mod.default;
    } catch {
      throw new Error(
        'Anthropic SDK not installed. Run:  npm install @anthropic-ai/sdk'
      );
    }
  }

  async _loadOpenAI() {
    try {
      const mod = await import('openai');
      return mod.default;
    } catch {
      throw new Error(
        'OpenAI SDK not installed. Run:  npm install openai'
      );
    }
  }

  async _loadGemini() {
    try {
      const mod = await import('@google/generative-ai');
      return mod.GoogleGenerativeAI;
    } catch {
      throw new Error(
        'Google Generative AI SDK not installed. Run:  npm install @google/generative-ai'
      );
    }
  }

  // ── Model auto-detection ──────────────────────────────

  async detectAnthropicModel(apiKey) {
    const Anthropic = await this._loadAnthropic();

    const modelsToTry = [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-2.1',
      'claude-2.0',
    ];

    for (const modelName of modelsToTry) {
      try {
        const testClient = new Anthropic({ apiKey });
        await testClient.messages.create({
          model: modelName,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        });
        console.log(`✓ Detected working model: ${modelName}`);
        return modelName;
      } catch (error) {
        if (error?.status === 404) {
          continue; // model not available for this key
        } else if (error?.status === 401) {
          throw new Error('Invalid API key');
        } else {
          // Model likely works – non-404/401 errors (rate-limit, etc.)
          console.log(`✓ Detected working model: ${modelName}`);
          return modelName;
        }
      }
    }

    // Default fallback
    return 'claude-3-haiku-20240307';
  }

  // ── Provider setup ────────────────────────────────────

  async setProvider(provider, model = null) {
    const keyData = await this.db.getApiKey(provider);

    if (!keyData && provider !== 'ollama') {
      console.error(`✗ No API key found for ${provider}`);
      console.log(`  Use: node src/index.js add-key ${provider} <your-key>`);
      return false;
    }

    this.currentProvider = provider;

    if (provider === 'anthropic') {
      const Anthropic = await this._loadAnthropic();
      this.client = new Anthropic({ apiKey: keyData.api_key });

      if (!model) {
        if (keyData.model_name) {
          this.model = keyData.model_name;
          console.log(`✓ Using saved model: ${this.model}`);
        } else {
          console.log('🔍 Detecting compatible Claude model...');
          this.model = await this.detectAnthropicModel(keyData.api_key);
          await this.db.saveApiKey(provider, keyData.api_key, this.model);
        }
      } else {
        this.model = model;
      }
    } else if (provider === 'openai') {
      const OpenAI = await this._loadOpenAI();
      this.client = new OpenAI({ apiKey: keyData.api_key });
      this.model = model || keyData.model_name || 'gpt-4o-mini';
    } else if (provider === 'gemini') {
      const GoogleGenerativeAI = await this._loadGemini();
      this.client = new GoogleGenerativeAI(keyData.api_key);
      this.model = model || keyData.model_name || 'gemini-pro';
    } else if (provider === 'ollama') {
      this.model = model || 'llama2';
      console.log('⚠ Ollama provider selected – ensure Ollama is running locally');
    }

    console.log(`✓ Active provider: ${provider} (${this.model})`);
    return true;
  }

  // ── Chat ──────────────────────────────────────────────

  async chat(userMessage, sessionId, userName, context = null) {
    // Build system prompt with training data
    const trainingData = await this.db.getTrainingData();
    const systemPrompt = await this._buildSystemPrompt(trainingData);

    // Build recent conversation context
    const messages = [];
    if (context) {
      for (const msg of context.slice(-10)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Save user message
    await this.db.saveMessage(sessionId, userName, 'user', userMessage, this.model);

    try {
      let response;

      if (this.currentProvider === 'anthropic') {
        response = await this._chatAnthropic(systemPrompt, messages, userMessage);
      } else if (this.currentProvider === 'openai') {
        response = await this._chatOpenAI(systemPrompt, messages, userMessage);
      } else if (this.currentProvider === 'gemini') {
        response = await this._chatGemini(systemPrompt, messages, userMessage);
      } else if (this.currentProvider === 'ollama') {
        response = await this._chatOllama(systemPrompt, messages, userMessage);
      } else {
        response = 'Error: No provider configured';
      }

      // Save assistant response
      await this.db.saveMessage(sessionId, userName, 'assistant', response, this.model);
      return response;
    } catch (error) {
      const errorMsg = `Error: ${error.message}`;
      console.error(`\n✗ ${errorMsg}`);
      return errorMsg;
    }
  }

  async _buildSystemPrompt(trainingData) {
    let basePrompt = 'You are a helpful AI assistant.';

    // Check for custom system prompt
    const customPrompt = await this.db.getSystemConfig('system_prompt');
    if (customPrompt) {
      basePrompt = customPrompt;
    }

    // Check for bias analysis data
    const biasLogs = await this.db.getBiasLogs(5);
    if (biasLogs.length > 0) {
      basePrompt += '\n\n=== DATA-DRIVEN CONTEXT ===\n';
      basePrompt += 'You have been trained on the following imported datasets. ';
      basePrompt += 'Use this information to ground your answers in real data:\n\n';
      for (const log of biasLogs) {
        basePrompt += `--- Import Analysis ---\n`;
        basePrompt += `${log.findings}\n`;
        basePrompt += `${log.bias_adjustments}\n\n`;
      }
    }

    // Add Q&A training data
    if (trainingData && trainingData.length > 0) {
      basePrompt += '\n\n=== KNOWLEDGE BASE ===\n';
      for (const item of trainingData.slice(0, 20)) {
        basePrompt += `\nQ: ${item.question}\nA: ${item.expected_response}\n`;
      }
    }

    return basePrompt;
  }

  // ── Provider-specific chat methods ────────────────────

  async _chatAnthropic(systemPrompt, messages, userMessage) {
    messages.push({ role: 'user', content: userMessage });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    return response.content[0].text;
  }

  async _chatOpenAI(systemPrompt, messages, userMessage) {
    messages.unshift({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userMessage });

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
    });

    return response.choices[0].message.content;
  }

  async _chatGemini(systemPrompt, messages, userMessage) {
    const model = this.client.getGenerativeModel({ model: this.model });
    const fullPrompt = `${systemPrompt}\n\n${userMessage}`;
    const response = await model.generateContent(fullPrompt);
    return response.response.text();
  }

  async _chatOllama(systemPrompt, messages, userMessage) {
    messages.unshift({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userMessage });

    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
      }),
    });

    const data = await response.json();
    return data.message.content;
  }
}

export default LLMManager;
