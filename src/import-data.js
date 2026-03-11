import XLSX from 'xlsx';
import chalk from 'chalk';
import path from 'path';

export async function importData(fp, db) {
  try {
    const fn = path.basename(fp); // Works correctly on both Windows and Unix
    console.log(chalk.blue('📊 ' + fn));
    const wb = XLSX.readFile(fp);
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: null });
    const cols = Object.keys(data[0] || {});
    console.log(chalk.green('✓ ' + data.length + ' rows, ' + cols.length + ' cols'));
    const iid = await db.saveDataImport(fn, data.length, cols.length);
    const tbl = 'raw_import_' + iid;
    console.log(chalk.blue('📦 Creating ' + tbl + '...'));
    await db.createRawTable(tbl, cols);
    console.log(chalk.blue('💾 Inserting...'));
    await db.insertRawRows(tbl, cols, data);
    console.log(chalk.green('✓ Stored'));
    const colInfo = cols.map(c => ({ name: c, type: 'text' }));
    await db.saveDataProfile(iid, fn + ': ' + data.length + ' rows, ' + cols.length + ' columns', colInfo, tbl);
    console.log(chalk.green('✅ Complete\n'));
  } catch (e) { console.error(chalk.red('✗ ' + e.message)); }
}
