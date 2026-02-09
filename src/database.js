// src/database.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

class Database {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'demo-api',
        password: process.env.DB_PASSWORD || 'Bridge2AI',
        database: process.env.DB_NAME || 'llm_manager',
      });
      console.log('✓ Connected to MySQL database');
      await this.initializeTables();
    } catch (error) {
      if (error.code === 'ER_BAD_DB_ERROR') {
        await this.createDatabase();
      } else {
        console.error('✗ Database connection error:', error.message);
        process.exit(1);
      }
    }
  }

  async createDatabase() {
    try {
      const tempConn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'demo-api',
        password: process.env.DB_PASSWORD || 'Bridge2AI',
      });

      await tempConn.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'llm_manager'}`);
      await tempConn.end();

      // Reconnect to new database
      await this.connect();
    } catch (error) {
      console.error('✗ Error creating database:', error.message);
      process.exit(1);
    }
  }

  async initializeTables() {
    // Chat history table
    await this.connection.query(`
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
    `);

    // API keys table
    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider VARCHAR(50) UNIQUE,
        api_key TEXT,
        model_name VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Training data table
    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS training_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(100),
        question TEXT,
        expected_response TEXT,
        metadata JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX(category)
      )
    `);

    // System configs table
    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS system_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE,
        config_value TEXT,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Bias logs table
    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS bias_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        import_id INT,
        analysis_type VARCHAR(50),
        findings TEXT,
        bias_adjustments TEXT,
        reasoning TEXT,
        confidence_score DECIMAL(5,2),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX(import_id),
        INDEX(created_at)
      )
    `);

    // Data imports table
    await this.connection.query(`
      CREATE TABLE IF NOT EXISTS data_imports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255),
        file_type VARCHAR(20),
        rows_imported INT,
        columns_imported INT,
        import_status ENUM('pending', 'completed', 'failed'),
        error_message TEXT,
        metadata JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✓ Database tables initialized');
  }

  // ── Chat History ──────────────────────────────────────

  async saveMessage(sessionId, userName, role, content, model) {
    await this.connection.query(
      `INSERT INTO chat_history (session_id, user_name, role, content, model)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, userName, role, content, model]
    );
  }

  async getChatHistory(sessionId, limit = 50) {
    const [rows] = await this.connection.query(
      `SELECT role, content, timestamp, model
       FROM chat_history
       WHERE session_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [sessionId, limit]
    );
    return rows.reverse();
  }

  // ── API Keys ──────────────────────────────────────────

  async saveApiKey(provider, apiKey, modelName = null) {
    await this.connection.query(
      `INSERT INTO api_keys (provider, api_key, model_name)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         api_key = VALUES(api_key),
         model_name = VALUES(model_name),
         updated_at = CURRENT_TIMESTAMP`,
      [provider, apiKey, modelName]
    );
  }

  async getApiKey(provider) {
    const [rows] = await this.connection.query(
      `SELECT api_key, model_name FROM api_keys
       WHERE provider = ? AND is_active = TRUE`,
      [provider]
    );
    return rows[0] || null;
  }

  async listApiKeys() {
    const [rows] = await this.connection.query(
      `SELECT provider, model_name, is_active, created_at, updated_at FROM api_keys`
    );
    return rows;
  }

  // ── Training Data ─────────────────────────────────────

  async addTrainingData(category, question, expectedResponse, metadata = null) {
    await this.connection.query(
      `INSERT INTO training_data (category, question, expected_response, metadata)
       VALUES (?, ?, ?, ?)`,
      [category, question, expectedResponse, JSON.stringify(metadata || {})]
    );
  }

  async getTrainingData(category = null) {
    let query = 'SELECT * FROM training_data';
    let params = [];

    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }

    const [rows] = await this.connection.query(query, params);
    return rows;
  }

  // ── System Config ─────────────────────────────────────

  async setSystemConfig(key, value, description = '') {
    await this.connection.query(
      `INSERT INTO system_configs (config_key, config_value, description)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         config_value = VALUES(config_value),
         description = VALUES(description)`,
      [key, value, description]
    );
  }

  async getSystemConfig(key) {
    const [rows] = await this.connection.query(
      `SELECT config_value FROM system_configs WHERE config_key = ?`,
      [key]
    );
    return rows[0]?.config_value || null;
  }

  // ── Bias Logs ─────────────────────────────────────────

  async saveBiasLog(importId, analysisType, findings, biasAdjustments, reasoning, confidenceScore) {
    await this.connection.query(
      `INSERT INTO bias_logs (import_id, analysis_type, findings, bias_adjustments, reasoning, confidence_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [importId, analysisType, findings, biasAdjustments, reasoning, confidenceScore]
    );
  }

  async getBiasLogs(limit = 10) {
    const [rows] = await this.connection.query(
      `SELECT * FROM bias_logs ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    return rows;
  }

  // ── Data Imports ──────────────────────────────────────

  async saveDataImport(filename, fileType, rowsImported, columnsImported, status, errorMessage, metadata) {
    const [result] = await this.connection.query(
      `INSERT INTO data_imports (filename, file_type, rows_imported, columns_imported, import_status, error_message, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [filename, fileType, rowsImported, columnsImported, status, errorMessage, JSON.stringify(metadata || {})]
    );
    return result.insertId;
  }

  // ── Wipe / Reset ──────────────────────────────────────

  async wipeApiKeys() {
    await this.connection.query('DELETE FROM api_keys');
    console.log('✓ All API keys deleted');
  }

  async wipeDatabase() {
    await this.connection.query('DELETE FROM chat_history');
    await this.connection.query('DELETE FROM api_keys');
    await this.connection.query('DELETE FROM training_data');
    await this.connection.query('DELETE FROM system_configs');
    await this.connection.query('DELETE FROM bias_logs');
    await this.connection.query('DELETE FROM data_imports');
    console.log('✓ All database tables wiped');
  }

  async close() {
    if (this.connection) {
      await this.connection.end();
    }
  }
}

export default Database;
