import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const mes = '2026-08'
  const startDate = new Date(`${mes}-01T00:00:00Z`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  
  console.log('Querying from', startDate, 'to', endDate);
  
  const movs = await prisma.movimiento.findMany({
    where: {
      fecha: {
        gte: startDate,
        lt: endDate,
      }
    }
  });
  console.log('Movimientos in August found:', movs.length);
  movs.forEach(m => console.log(m.fecha));
}

main().finally(() => prisma.$disconnect());
