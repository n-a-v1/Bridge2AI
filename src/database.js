import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();
class Database {
  constructor() { this.connection = null; }
  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'demo-api',
        password: process.env.DB_PASSWORD || 'Bridge2AI',
        database: 'llm_manager'
      });
      console.log('✓ MySQL connected');
      await this.initializeTables();
    } catch (e) {
      if (e.code === 'ER_BAD_DB_ERROR') await this.createDatabase();
      else { console.error('✗', e.message); process.exit(1); }
    }
  }
  async createDatabase() {
    const c = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'demo-api',
      password: process.env.DB_PASSWORD || 'Bridge2AI'
    });
    await c.query('CREATE DATABASE llm_manager');
    await c.end();
    await this.connect();
  }
  async initializeTables() {
    await this.connection.query('CREATE TABLE IF NOT EXISTS chat_history (id INT AUTO_INCREMENT PRIMARY KEY, session_id VARCHAR(255), user_name VARCHAR(100), role VARCHAR(20), content TEXT, model VARCHAR(100), timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)');
    await this.connection.query('CREATE TABLE IF NOT EXISTS api_keys (id INT AUTO_INCREMENT PRIMARY KEY, provider VARCHAR(50) UNIQUE, api_key TEXT, model_name VARCHAR(100), is_active BOOLEAN DEFAULT TRUE)');
    await this.connection.query('CREATE TABLE IF NOT EXISTS data_profiles (id INT AUTO_INCREMENT PRIMARY KEY, import_id INT, dataset_summary TEXT, column_profiles JSON, raw_table_name VARCHAR(100))');
    await this.connection.query('CREATE TABLE IF NOT EXISTS data_imports (id INT AUTO_INCREMENT PRIMARY KEY, filename VARCHAR(255), rows_imported INT, columns_imported INT)');
    console.log('✓ Tables ready');
  }
  async saveMessage(sid, user, role, content, model) {
    await this.connection.query('INSERT INTO chat_history (session_id,user_name,role,content,model) VALUES (?,?,?,?,?)', [sid,user,role,content,model]);
  }
  async getChatHistory(sid) {
    const [r] = await this.connection.query('SELECT role,content FROM chat_history WHERE session_id=? ORDER BY timestamp DESC LIMIT 20', [sid]);
    return r.reverse();
  }
  async saveApiKey(p, k, m) {
    await this.connection.query('INSERT INTO api_keys (provider,api_key,model_name) VALUES (?,?,?) ON DUPLICATE KEY UPDATE api_key=VALUES(api_key), model_name=VALUES(model_name)', [p,k,m]);
  }
  async getApiKey(p) {
    const [r] = await this.connection.query('SELECT api_key,model_name FROM api_keys WHERE provider=?', [p]);
    return r[0]||null;
  }
  async getAllDataProfiles() {
    const [r] = await this.connection.query('SELECT * FROM data_profiles');
    return r;
  }
  async getDataProfiles(lim) {
    const [r] = await this.connection.query('SELECT * FROM data_profiles LIMIT ?', [lim]);
    return r;
  }
  async createRawTable(tbl, cols) {
    const c = cols.map(col => '`'+col.replace(/[`'"]/g,'')+'` TEXT').join(',');
    await this.connection.query('CREATE TABLE `'+tbl+'` (id INT AUTO_INCREMENT PRIMARY KEY,'+c+')');
  }
  async insertRawRows(tbl, cols, rows) {
    const batch = 100;
    for (let i=0; i<rows.length; i+=batch) {
      const b = rows.slice(i, i+batch);
      const ph = b.map(() => '('+cols.map(() => '?').join(',')+')').join(',');
      const v = b.flatMap(row => cols.map(c => row[c]));
      await this.connection.query('INSERT INTO `'+tbl+'` ('+cols.map(c => '`'+c+'`').join(',')+') VALUES '+ph, v);
    }
  }
  async executeQuery(sql) {
    const [r] = await this.connection.query(sql);
    return r;
  }
  async saveDataProfile(iid, sum, cols, tbl) {
    await this.connection.query('INSERT INTO data_profiles (import_id,dataset_summary,column_profiles,raw_table_name) VALUES (?,?,?,?)', [iid,sum,JSON.stringify(cols),tbl]);
  }
  async saveDataImport(fn, rows, cols) {
    const [r] = await this.connection.query('INSERT INTO data_imports (filename,rows_imported,columns_imported) VALUES (?,?,?)', [fn,rows,cols]);
    return r.insertId;
  }
  async wipeDatabase() {
    await this.connection.query('DELETE FROM chat_history');
    await this.connection.query('DELETE FROM api_keys');
    await this.connection.query('DELETE FROM data_profiles');
    await this.connection.query('DELETE FROM data_imports');
    const [t] = await this.connection.query("SHOW TABLES LIKE 'raw_import_%'");
    for (const tb of t) await this.connection.query('DROP TABLE `'+Object.values(tb)[0]+'`');
    console.log('✓ Wiped');
  }
  async close() { if (this.connection) await this.connection.end(); }
}
export default Database;
