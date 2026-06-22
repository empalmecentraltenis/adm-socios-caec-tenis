import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const socios = await prisma.socio.findMany({
    where: { estado: 'inactivo' },
    include: { pagos: true }
  });

  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const mesActual = ahora.getMonth() + 1; // 1 to 12

  for (const s of socios) {
    if (s.pagos.length === 0) {
      const fechaAlta = new Date(s.fechaAlta);
      const diff = ahora.getFullYear() - fechaAlta.getFullYear();
      const calcDiff = diff * 12 + (ahora.getMonth() - fechaAlta.getMonth());
      const mesesDeudaUI = calcDiff > 0 ? calcDiff : 0;
      
      console.log(`DNI: ${s.dni}, Nombre: ${s.nombre} ${s.apellido}, FechaAlta: ${s.fechaAlta.toISOString().split('T')[0]}, Deuda en UI: ${mesesDeudaUI}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
