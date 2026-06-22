const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const socios = await prisma.socio.findMany({
    where: { dni: '27862689' }
  });
  const nicolas = socios[0];
  console.log("Raw date string from DB if possible:", nicolas.fechaAlta.toISOString());
  console.log("Prisma JS Date getMonth():", nicolas.fechaAlta.getMonth());
  console.log("Prisma JS Date getFullYear():", nicolas.fechaAlta.getFullYear());
  
  const ahora = new Date();
  const yA = ahora.getFullYear();
  const mA = ahora.getMonth() + 1;
  const mesesAdeudados = (yA - nicolas.fechaAlta.getFullYear()) * 12 + (mA - (nicolas.fechaAlta.getMonth() + 1));
  console.log("Calculated debt for Nicolas (no payments):", mesesAdeudados);
}
run();
