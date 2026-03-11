import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import { renderSQL, renderResultsTable, renderRaw } from './display.js';

class LLMManager {
  constructor(db) { this.db = db; this.client = null; this.model = null; }

  async detectAnthropicModel(key) {
    const models = ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'];
    for (const m of models) {
      try {
        await (new Anthropic({ apiKey: key })).messages.create({
          model: m, max_tokens: 10, messages: [{ role: 'user', content: 't' }]
        });
        return m;
      } catch (e) { if (e.status === 404) continue; return m; }
    }
    return 'claude-3-haiku-20240307';
  }

  async setProvider(prov) {
    const k = await this.db.getApiKey(prov);
    if (!k) return false;
    this.client = new Anthropic({ apiKey: k.api_key });
    this.model = k.model_name || await this.detectAnthropicModel(k.api_key);
    if (!k.model_name) await this.db.saveApiKey(prov, k.api_key, this.model);
    console.log(chalk.green('  ✓ Connected: ' + this.model));
    return true;
  }

  /**
   * Send a chat message and return the response.
   * @param {string} msg   User message
   * @param {string} sid   Session ID
   * @param {string} user  Display name
   * @param {Array}  ctx   Chat history
   * @param {string} mode  'present' (default) | 'raw'
   */
  async chat(msg, sid, user, ctx, mode = 'present') {
    const profs = await this.db.getAllDataProfiles();

    // ── No data yet — respond conversationally instead of erroring ───────────
    if (profs.length === 0) {
      return await this._noDataResponse(msg, sid, user, ctx, mode);
    }

    const samples = await this._getSamples(profs[0].raw_table_name);

    // ── Friendly status (presentation mode only) ──────────────────────────────
    if (mode === 'present') {
      const datasetLabel = this._datasetLabel(profs[0]);
      console.log(chalk.gray(`\n  🔍 Scanning ${datasetLabel}...`));

      try {
        const [cnt] = await this.db.executeQuery(
          `SELECT COUNT(*) as n FROM \`${profs[0].raw_table_name}\``
        );
        console.log(chalk.gray(`  📊 ${Number(cnt.n).toLocaleString()} records loaded`));
      } catch (_) { /* skip if table gone */ }

      console.log(chalk.gray('  🧠 Analyzing your question...\n'));
    }

    const sysprompt = this._buildPrompt(profs, samples);
    const msgs = ctx ? ctx.slice(-6).map(m => ({ role: m.role, content: m.content })) : [];
    await this.db.saveMessage(sid, user, 'user', msg, this.model);

    try {
      msgs.push({ role: 'user', content: msg });
      const res = await this.client.messages.create({
        model: this.model, max_tokens: 4000, system: sysprompt, messages: msgs
      });

      let txt = res.content[0].text;
      const sqlMatch = txt.match(/<SQL>([\s\S]*?)<\/SQL>/);

      if (sqlMatch) {
        const sql = sqlMatch[1].trim();

        if (mode === 'present') {
          console.log(chalk.gray('  📡 Querying database...\n'));
          renderSQL(sql);
        }

        try {
          const results = await this.db.executeQuery(sql);

          if (mode === 'present') {
            renderResultsTable(results);
            txt = txt.split('<SQL>')[0].trim();
            txt += results.length > 0
              ? `\n\n✅ ${results.length} result${results.length !== 1 ? 's' : ''} returned above`
              : '\n\n⚠️  Query ran but returned 0 results — try rephrasing your question.';
          } else {
            txt = renderRaw(sql, results);
          }
        } catch (e) {
          // Friendly SQL error — hide raw MySQL internals
          const friendly = this._friendlySQLError(e);
          if (mode === 'present') console.log(chalk.red('  ✗ ' + friendly));
          txt = mode === 'raw'
            ? JSON.stringify({ error: friendly }, null, 2)
            : friendly;
        }
      }

      await this.db.saveMessage(sid, user, 'assistant', txt, this.model);
      return txt;
    } catch (e) {
      const msg2 = 'Something went wrong while contacting the AI. Check your API key and connection.';
      return mode === 'raw' ? JSON.stringify({ error: msg2 }, null, 2) : msg2;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Respond conversationally when no data has been imported yet.
   * Uses the LLM to stay warm and helpful rather than throwing a blunt error.
   */
  async _noDataResponse(msg, sid, user, ctx, mode) {
    const sysprompt = `You are Bridge2AI, an AI-powered business data analysis tool.

No data has been imported yet. You are a complete blank slate — you do not know what the user's business is, what their data contains, or what industry they are in. Do NOT assume, guess, or mention any specific data types, columns, topics, or industries.

Your only job right now:
- Introduce yourself briefly as a tool that reads imported business data and answers questions about it
- Make clear you cannot help until data is imported, because you have nothing to analyze yet
- Tell them to use the Database menu to import their data files (.xlsx or .csv)
- If they ask what kinds of questions you can answer: say "that depends entirely on what data you import — once it's in, I can answer questions about whatever is in it"
- Keep it short, honest, and professional. Do NOT fabricate examples or pretend to know their domain.

You are blank until data is provided.`;

    const msgs = ctx ? ctx.slice(-4).map(m => ({ role: m.role, content: m.content })) : [];
    msgs.push({ role: 'user', content: msg });
    await this.db.saveMessage(sid, user, 'user', msg, this.model);

    try {
      const res = await this.client.messages.create({
        model: this.model, max_tokens: 400, system: sysprompt, messages: msgs
      });
      const txt = res.content[0].text;
      await this.db.saveMessage(sid, user, 'assistant', txt, this.model);
      return txt;
    } catch (_) {
      return "Hi! I'm Bridge2AI — a supply-chain data analyst. I can answer questions about orders, customers, delays, and more once you've imported your data. Head to the Database menu to get started!";
    }
  }

  /** Friendly dataset label — extracts just the filename from the summary, handles full Windows paths */
  _datasetLabel(prof) {
    if (!prof) return 'your dataset';
    const summary = prof.dataset_summary || '';
    // Extract the first occurrence of a filename with a known extension, e.g. "KPI Data - COTD.xlsx"
    const match = summary.match(/([^/\\:]+\.(xlsx|xls|csv))/i);
    return match ? match[1] : 'your dataset';
  }

  /** Turn MySQL error messages into user-friendly text */
  _friendlySQLError(e) {
    const msg = e.message || '';
    if (msg.includes("doesn't exist")) {
      return 'The data table could not be found. Try re-importing your data file.';
    }
    if (msg.includes('Unknown column')) {
      return 'The query referenced a column that does not exist in your dataset.';
    }
    if (msg.includes('syntax error') || msg.includes('You have an error in your SQL')) {
      return 'The AI generated an invalid query. Try rephrasing your question.';
    }
    return 'Database error — try rephrasing your question.';
  }

  async _getSamples(tableName) {
    if (!tableName) return [];
    try {
      return await this.db.executeQuery(`SELECT * FROM \`${tableName}\` LIMIT 3`);
    } catch (e) { return []; }
  }

  _buildPrompt(profs, samples) {
    let p = 'You are Bridge2AI, a business data analyst AI.\n\n';
    p += 'You have DIRECT ACCESS to the following imported data tables in MySQL.\n';
    p += 'You CAN and SHOULD query them. When asked what data is available, describe it from the summaries below.\n';
    p += 'For analytical questions, generate SQL wrapped in <SQL>...</SQL> tags.\n';
    p += 'For conversational questions, respond helpfully — you DO have the data listed below.\n\n';

    p += '📊 YOUR AVAILABLE DATA TABLES:\n';
    for (const prof of profs) {
      p += '`' + prof.raw_table_name + '`: ' + prof.dataset_summary + '\n';
      if (prof.column_profiles) {
        try {
          const cs = typeof prof.column_profiles === 'string'
            ? JSON.parse(prof.column_profiles)
            : prof.column_profiles;
          p += 'Columns: ' + cs.map(c => '`' + c.name + '`').join(', ') + '\n\n';
        } catch (e) { /* ignore */ }
      }
    }

    if (samples && samples.length > 0) {
      p += '🔍 SAMPLE:\n' + JSON.stringify(samples.slice(0, 2), null, 2) + '\n\n';
    }

    p += '🚨 DATA FORMAT:\n\n';
    p += '📅 DATES (stored as "M/DD/YY"):\n';
    p += '• Dec 2025: `OrderDtl_NeedByDate` LIKE "12/%/25"\n';
    p += '• Year 2025: `OrderHed_OrderDate` LIKE "%/25"\n';
    p += '• 2024 OR 2025: (`OrderHed_OrderDate` LIKE "%/24" OR `OrderHed_OrderDate` LIKE "%/25")\n';
    p += '• 2025 OR 2026: (`OrderHed_OrderDate` LIKE "%/25" OR `OrderHed_OrderDate` LIKE "%/26")\n\n';

    p += '🔢 NUMBERS (stored as "$N"):\n';
    p += '• Late orders: `zLateCount2` NOT IN ("$0", "$-", "")\n\n';

    p += '📝 TEMPLATES:\n\n';
    p += '❓ "Late orders in December 2025":\n';
    p += '<SQL>SELECT * FROM `raw_import_1` WHERE `OrderDtl_NeedByDate` LIKE "12/%/25" AND `zLateCount2` NOT IN ("$0", "$-") LIMIT 100</SQL>\n\n';
    p += '❓ "Most frequent customers 2024-2025":\n';
    p += '<SQL>SELECT `Customer_Name`, COUNT(*) as cnt FROM `raw_import_1` WHERE `OrderHed_OrderDate` LIKE "%/24" OR `OrderHed_OrderDate` LIKE "%/25" GROUP BY `Customer_Name` ORDER BY cnt DESC LIMIT 100</SQL>\n\n';
    p += '❓ "Customers with ≤5 orders 2025-2026":\n';
    p += '<SQL>SELECT `Customer_Name`, COUNT(*) as cnt FROM `raw_import_1` WHERE `OrderHed_OrderDate` LIKE "%/25" OR `OrderHed_OrderDate` LIKE "%/26" GROUP BY `Customer_Name` HAVING cnt <= 5 ORDER BY cnt ASC LIMIT 100</SQL>\n\n';
    p += '❓ "Part numbers most delays 2025":\n';
    p += '<SQL>SELECT `ShipDtl_PartNum`, COUNT(*) as cnt FROM `raw_import_1` WHERE `OrderHed_OrderDate` LIKE "%/25" AND `zLateCount2` NOT IN ("$0", "$-") GROUP BY `ShipDtl_PartNum` ORDER BY cnt DESC LIMIT 100</SQL>\n\n';
    p += '❓ "Top 5 customers delayed 2024-2025":\n';
    p += '<SQL>SELECT `Customer_Name`, COUNT(*) as cnt FROM `raw_import_1` WHERE (`OrderHed_OrderDate` LIKE "%/24" OR `OrderHed_OrderDate` LIKE "%/25") AND `zLateCount2` NOT IN ("$0", "$-") GROUP BY `Customer_Name` ORDER BY cnt DESC LIMIT 5</SQL>\n\n';

    p += '⚠️ SQL RULES — follow every one:\n';
    p += '1. ALWAYS wrap EVERY column name and table name in backticks — especially names with spaces, parens, or special characters\n';
    p += '   WRONG:  SELECT zOTP2 (bins) FROM raw_import_4\n';
    p += '   CORRECT: SELECT `zOTP2 (bins)` FROM `raw_import_4`\n';
    p += '2. ALWAYS use LIKE for date comparisons — never >, <, =\n';
    p += '3. NEVER use > or < on text columns\n';
    p += '4. Late orders filter: `zLateCount2` NOT IN ("$0", "$-", "")\n';
    p += '5. Always add LIMIT 100\n';
    p += '6. When SELECT *, prefer listing only relevant columns to avoid broken column names\n';

    return p;
  }
}

export default LLMManager;
