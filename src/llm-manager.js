import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';

class LLMManager {
  constructor(db) { this.db = db; this.client = null; this.model = null; }
  
  async detectAnthropicModel(key) {
    const models = ['claude-3-5-sonnet-20241022','claude-3-haiku-20240307'];
    for (const m of models) {
      try {
        await (new Anthropic({apiKey:key})).messages.create({model:m, max_tokens:10, messages:[{role:'user',content:'t'}]});
        return m;
      } catch (e) { if (e.status===404) continue; return m; }
    }
    return 'claude-3-haiku-20240307';
  }
  
  async setProvider(prov) {
    const k = await this.db.getApiKey(prov);
    if (!k) { console.error('✗ No key'); return false; }
    this.client = new Anthropic({apiKey:k.api_key});
    this.model = k.model_name || await this.detectAnthropicModel(k.api_key);
    if (!k.model_name) await this.db.saveApiKey(prov, k.api_key, this.model);
    console.log('✓ Using '+prov+' ('+this.model+')');
    return true;
  }
  
  async chat(msg, sid, user, ctx) {
    const profs = await this.db.getAllDataProfiles();
    const samples = await this._getSamples();
    const sysprompt = this._buildPrompt(profs, samples);
    const msgs = ctx ? ctx.slice(-6).map(m => ({role:m.role, content:m.content})) : [];
    await this.db.saveMessage(sid, user, 'user', msg, this.model);
    
    try {
      console.log(chalk.gray('💭 Thinking...'));
      msgs.push({role:'user', content:msg});
      const res = await this.client.messages.create({model:this.model, max_tokens:4000, system:sysprompt, messages:msgs});
      
      let txt = res.content[0].text;
      const sqlMatch = txt.match(/<SQL>([\s\S]*?)<\/SQL>/);
      
      if (sqlMatch) {
        const sql = sqlMatch[1].trim();
        console.log(chalk.blue('🔍 '+sql.substring(0,80)));
        try {
          const results = await this.db.executeQuery(sql);
          console.log(chalk.green('✓ '+results.length+' results'));
          
          txt = txt.split('<SQL>')[0].trim();
          if (results.length > 0) {
            txt += '\n\n🎯 '+results.length+' RESULTS:\n\n'+JSON.stringify(results.slice(0,20), null, 2);
          } else {
            txt += '\n\n⚠️ 0 results';
          }
        } catch (e) {
          console.log(chalk.red('✗ '+e.message));
          txt = 'Error: '+e.message;
        }
      }
      
      await this.db.saveMessage(sid, user, 'assistant', txt, this.model);
      return txt;
    } catch (e) { return 'Error: '+e.message; }
  }
  
  async _getSamples() {
    try {
      return await this.db.executeQuery('SELECT * FROM `raw_import_1` LIMIT 3');
    } catch(e) { return []; }
  }
  
  _buildPrompt(profs, samples) {
    let p = 'SQL query generator. Write ONLY SQL in <SQL>tags</SQL>.\n\n';
    
    p += '📊 TABLES:\n';
    for (const prof of profs) {
      p += '`'+prof.raw_table_name+'`: '+prof.dataset_summary+'\n';
      if (prof.column_profiles) {
        try {
          const cs = typeof prof.column_profiles === 'string' ? JSON.parse(prof.column_profiles) : prof.column_profiles;
          p += 'Columns: '+cs.map(c => '`'+c.name+'`').join(', ')+'\n\n';
        } catch(e) {}
      }
    }
    
    if (samples && samples.length > 0) {
      p += '🔍 SAMPLE:\n'+JSON.stringify(samples.slice(0,2), null, 2)+'\n\n';
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
    
    p += '⚠️ RULES:\n';
    p += '1. ALWAYS use LIKE for dates\n';
    p += '2. NEVER use > or < on text\n';
    p += '3. Late orders: NOT IN ("$0", "$-")\n';
    p += '4. Add LIMIT 100\n';
    p += '5. Backticks for identifiers\n';
    
    return p;
  }
}

export default LLMManager;
