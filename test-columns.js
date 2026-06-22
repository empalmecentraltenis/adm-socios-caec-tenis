const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const data = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'pago_cuotas';
  `;
  console.log("Columns of pago_cuotas:", data);
}
run();
