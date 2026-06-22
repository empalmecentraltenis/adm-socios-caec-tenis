const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const count = await prisma.pagoCuota.count();
  console.log("Total pago_cuotas:", count);
}
run();
