import xlsx from 'xlsx';

const filePath = 'C:\\Users\\nfederici\\Desktop\\caec-tenis-dashboard\\public\\LISTADO TENIS.xlsx';
const workbook = xlsx.readFile(filePath);
const worksheet = workbook.Sheets['Hoja1'];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

const rows = data.slice(1);
for (const row of rows) {
  const nombreStr = String(row[1] || '') + " " + String(row[2] || '');
  if (nombreStr.includes('JORGE') || nombreStr.includes('FEBRE')) {
    console.log("Found in Excel:", row);
  }
}
