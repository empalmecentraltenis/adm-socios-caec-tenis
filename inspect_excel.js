const XLSX = require('xlsx');

function inspect() {
  const filePath = 'C:\\Users\\nfederici\\Desktop\\caec-tenis-dashboard\\public\\LISTADO TENIS.xlsx';
  const workbook = XLSX.readFile(filePath);
  
  console.log("Sheet names:");
  console.log(workbook.SheetNames);
  
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (data.length > 0) {
      console.log("Headers:");
      console.log(data[0]);
      if (data.length > 1) {
        console.log("First row:");
        console.log(data[1]);
      }
    } else {
      console.log("Empty sheet");
    }
  }
}

inspect();
