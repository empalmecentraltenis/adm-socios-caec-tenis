import { PrismaClient } from '@prisma/client';
import xlsx from 'xlsx';

const prisma = new PrismaClient();

function parseExcelDate(value) {
  const str = String(value);
  if (str.length === 8) {
    const year = parseInt(str.substring(0, 4));
    const month = parseInt(str.substring(4, 6)) - 1;
    const day = parseInt(str.substring(6, 8));
    return new Date(year, month, day);
  }
  if (typeof value === 'number' && value < 100000) {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return new Date(d.getTime() + d.getTimezoneOffset() * 60000);
  }
  return new Date();
}

async function main() {
  console.log("Leyendo archivo Excel...");
  const filePath = 'C:\\Users\\nfederici\\Desktop\\caec-tenis-dashboard\\public\\LISTADO TENIS.xlsx';
  const workbook = xlsx.readFile(filePath);
  
  const sheetName = 'Hoja1';
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  const headers = data[0];
  const rows = data.slice(1);
  
  const sociosMap = new Map();
  
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    
    const nombre = (row[1] || '').toString().trim();
    const apellido = (row[2] || '').toString().trim();
    const dni = (row[3] || '').toString().trim();
    const mes = parseInt(row[4]);
    const anio = parseInt(row[5]);
    const fecCobro = row[6];
    const importe = parseFloat(row[7]) || 0;
    
    if (!dni || dni === 'undefined' || isNaN(mes) || isNaN(anio)) continue;
    
    if (!sociosMap.has(dni)) {
      sociosMap.set(dni, { dni, nombre, apellido, pagos: [], maxMesTotal: 0 });
    }
    
    const socio = sociosMap.get(dni);
    const mesTotal = anio * 12 + mes;
    
    if (mesTotal > socio.maxMesTotal) {
      socio.maxMesTotal = mesTotal;
    }
    
    const mesPagadoStr = `${anio}-${mes.toString().padStart(2, '0')}`;
    const fechaReg = parseExcelDate(fecCobro);
    
    socio.pagos.push({
      mesPagado: mesPagadoStr,
      monto: importe,
      fechaRegistro: fechaReg
    });
  }
  
  console.log(`Se encontraron ${sociosMap.size} socios únicos. Procesando...`);
  
  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const mesActual = ahora.getMonth() + 1;
  const mesActualTotal = anioActual * 12 + mesActual;
  
  let activosCount = 0;
  let inactivosCount = 0;
  
  console.log("Optimizando inserciones de socios...");
  const sociosEnDb = await prisma.socio.findMany();
  const sociosDbMap = new Map(sociosEnDb.map(s => [s.dni, s]));
  
  const pagosAInsertar = [];
  
  for (const [dni, socioData] of sociosMap.entries()) {
    const mesesDeuda = mesActualTotal - socioData.maxMesTotal;
    let estado = 'activo';
    
    if (mesesDeuda > 8) {
      estado = 'inactivo';
      inactivosCount++;
    } else {
      estado = 'activo';
      activosCount++;
    }
    
    let socioDb = sociosDbMap.get(dni);
    
    if (socioDb) {
      // update
      socioDb = await prisma.socio.update({
        where: { id: socioDb.id },
        data: { nombre: socioData.nombre, apellido: socioData.apellido, estado }
      });
    } else {
      // create
      socioDb = await prisma.socio.create({
        data: { dni: socioData.dni, nombre: socioData.nombre, apellido: socioData.apellido, estado, categoria: 'socio' }
      });
    }
    
    // Asignar ID
    for (const p of socioData.pagos) {
      p.socioId = socioDb.id;
    }
  }
  
  console.log("Recuperando pagos existentes para no duplicar...");
  const todosLosPagos = await prisma.pagoCuota.findMany({ select: { socioId: true, mesPagado: true } });
  const pagosSet = new Set(todosLosPagos.map(p => `${p.socioId}_${p.mesPagado}`));
  
  for (const [dni, socioData] of sociosMap.entries()) {
    for (const p of socioData.pagos) {
      if (!pagosSet.has(`${p.socioId}_${p.mesPagado}`)) {
        pagosAInsertar.push({
          socioId: p.socioId,
          mesPagado: p.mesPagado,
          monto: p.monto,
          fechaRegistro: p.fechaRegistro,
          metodoPago: 'excel'
        });
        // Lo agrego al set para que no se duplique en la misma lista del excel si hay error
        pagosSet.add(`${p.socioId}_${p.mesPagado}`);
      }
    }
  }
  
  console.log(`Se insertarán ${pagosAInsertar.length} pagos nuevos de forma masiva.`);
  
  if (pagosAInsertar.length > 0) {
    const CHUNK_SIZE = 500;
    for (let i = 0; i < pagosAInsertar.length; i += CHUNK_SIZE) {
      const chunk = pagosAInsertar.slice(i, i + CHUNK_SIZE);
      await prisma.pagoCuota.createMany({ data: chunk });
    }
  }
  
  console.log("=== Importación Finalizada ===");
  console.log(`Total Activos: ${activosCount}`);
  console.log(`Total Inactivos (>8 meses deuda): ${inactivosCount}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
