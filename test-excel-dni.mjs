import xlsx from 'xlsx';

const filePath = 'C:\\Users\\nfederici\\Desktop\\caec-tenis-dashboard\\public\\LISTADO TENIS.xlsx';
const workbook = xlsx.readFile(filePath);
const worksheet = workbook.Sheets['Hoja1'];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

const rows = data.slice(1);
for (const row of rows) {
  const dni = (row[3] || '').toString().trim();
  if (dni === '22170734' || dni === '33396380' || dni === '39146467') {
    console.log("Found in Excel:", row);
  }
}
