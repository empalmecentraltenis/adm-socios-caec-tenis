import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const socios = await prisma.socio.findMany({
    include: {
      pagos: true
    }
  });

  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const mesActual = ahora.getMonth() + 1; // 1 to 12
  const mesActualTotal = anioActual * 12 + mesActual;

  console.log(`Fecha actual evaluada: ${anioActual}-${mesActual}`);

  for (const s of socios) {
    let maxMes = 0;
    let maxMesStr = "";
    for (const p of s.pagos) {
      const [y, m] = p.mesPagado.split('-');
      const t = parseInt(y) * 12 + parseInt(m);
      if (t > maxMes) {
        maxMes = t;
        maxMesStr = p.mesPagado;
      }
    }
    
    const mesesDeuda = maxMes > 0 ? mesActualTotal - maxMes : "Sin pagos";
    
    if (s.estado === 'inactivo') {
      console.log(`[INACTIVO] DNI: ${s.dni}, Nombre: ${s.nombre} ${s.apellido}, Último Pago: ${maxMesStr || 'N/A'}, Deuda: ${mesesDeuda} meses`);
    } else if (typeof mesesDeuda === 'number' && mesesDeuda >= 2 && mesesDeuda <= 8) {
      console.log(`[MOROSO] DNI: ${s.dni}, Nombre: ${s.nombre} ${s.apellido}, Último Pago: ${maxMesStr}, Deuda: ${mesesDeuda} meses`);
    }
  }
}

main().finally(() => prisma.$disconnect());
