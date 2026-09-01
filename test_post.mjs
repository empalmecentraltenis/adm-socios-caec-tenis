import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const fecha = "2026-08-01";
  const [year, month, day] = fecha.split('-').map(Number);
  const fechaLocal = new Date(year, month - 1, day, 12, 0, 0);
  
  console.log('fechaLocal evaluated as:', fechaLocal, fechaLocal.toISOString());

  const mov = await prisma.movimiento.create({
    data: {
      fecha: fechaLocal,
      descripcion: "Test date saving",
      responsable: "Test",
      tipo: "ingreso",
      monto: 1000
    }
  });

  console.log('Saved as:', mov.fecha, mov.fecha.toISOString());
  
  await prisma.movimiento.delete({ where: { id: mov.id }});
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
