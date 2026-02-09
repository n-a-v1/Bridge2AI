// tests/logic.test.js
// Tests for data analysis and bias logic (no DB or API needed)

describe('Data Analysis Logic', () => {

  // ── Statistics calculation ────────────────────────────
  describe('Statistics Calculation', () => {
    function calculateStats(data, columns) {
      const stats = {};
      for (const col of columns) {
        const values = data.map(row => row[col]).filter(v => v != null && v !== '');
        if (values.length === 0) continue;
        const numericValues = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));
        if (numericValues.length > values.length * 0.8) {
          stats[col] = {
            type: 'numeric',
            count: numericValues.length,
            mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
            min: Math.min(...numericValues),
            max: Math.max(...numericValues),
          };
        } else {
          const unique = [...new Set(values)];
          stats[col] = { type: 'categorical', count: values.length, unique: unique.length, sample: unique.slice(0, 5) };
        }
      }
      return stats;
    }

    test('should identify numeric columns', () => {
      const data = [{ score: 80 }, { score: 90 }, { score: 70 }];
      const stats = calculateStats(data, ['score']);
      expect(stats.score.type).toBe('numeric');
      expect(stats.score.mean).toBe(80);
      expect(stats.score.min).toBe(70);
      expect(stats.score.max).toBe(90);
    });

    test('should identify categorical columns', () => {
      const data = [{ status: 'on-time' }, { status: 'late' }, { status: 'on-time' }];
      const stats = calculateStats(data, ['status']);
      expect(stats.status.type).toBe('categorical');
      expect(stats.status.unique).toBe(2);
    });

    test('should handle empty data', () => {
      const stats = calculateStats([], ['col1']);
      expect(Object.keys(stats).length).toBe(0);
    });

    test('should handle null values', () => {
      const data = [{ val: 10 }, { val: null }, { val: 30 }];
      const stats = calculateStats(data, ['val']);
      expect(stats.val.count).toBe(2);
      expect(stats.val.mean).toBe(20);
    });
  });

  // ── Confidence calculation ────────────────────────────
  describe('Confidence Calculation', () => {
    function calculateConfidence(rows, columns) {
      let c = 50;
      if      (rows > 10000) c += 30;
      else if (rows > 1000)  c += 20;
      else if (rows > 100)   c += 10;
      if      (columns > 30) c += 15;
      else if (columns > 20) c += 10;
      else if (columns > 10) c += 5;
      return Math.min(c, 95);
    }

    test('small dataset = low confidence', () => {
      expect(calculateConfidence(50, 5)).toBe(50);
    });

    test('medium dataset = moderate confidence', () => {
      expect(calculateConfidence(500, 15)).toBe(65);
    });

    test('large dataset with many columns = high confidence', () => {
      expect(calculateConfidence(15000, 35)).toBe(95);
    });

    test('confidence capped at 95', () => {
      expect(calculateConfidence(100000, 100)).toBe(95);
    });
  });

  // ── Data type detection ───────────────────────────────
  describe('Data Type Detection', () => {
    function detectDataType(filename, columns) {
      const fn = filename.toLowerCase();
      const cols = columns.map(c => c.toLowerCase());
      if (fn.includes('cotd') || cols.some(c => c.includes('customer')))  return 'customer_otd';
      if (fn.includes('motd'))                                             return 'manufacturing_otd';
      if (fn.includes('purchase') || cols.some(c => c.includes('vendor'))) return 'purchase_otd';
      if (fn.includes('budget') || fn.includes('rev'))                     return 'revenue_budget';
      if (fn.includes('target'))                                           return 'targets';
      return 'general';
    }

    test('detects customer OTD from filename', () => {
      expect(detectDataType('KPI Data - COTD.xlsx', ['col1'])).toBe('customer_otd');
    });

    test('detects manufacturing OTD', () => {
      expect(detectDataType('KPI Data - MOTD.xlsx', ['col1'])).toBe('manufacturing_otd');
    });

    test('detects purchase data', () => {
      expect(detectDataType('Purchase Data.xlsx', ['col1'])).toBe('purchase_otd');
    });

    test('detects from column names', () => {
      expect(detectDataType('data.xlsx', ['VendorName', 'Amount'])).toBe('purchase_otd');
    });

    test('falls back to general', () => {
      expect(detectDataType('random.csv', ['x', 'y'])).toBe('general');
    });

    test('detects revenue/budget', () => {
      expect(detectDataType('Rev-Budget.xlsx', ['col1'])).toBe('revenue_budget');
    });

    test('detects targets', () => {
      expect(detectDataType('Targets.xlsx', ['col1'])).toBe('targets');
    });
  });
});
