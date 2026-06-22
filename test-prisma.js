const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const nicolas = await prisma.socio.findFirst({ where: { dni: '27862689' }, include: { pagos: { orderBy: { mesPagado: 'desc' } } } });
  console.log("Nicolas:", nicolas.nombre, nicolas.fechaAlta);
  console.log("Pagos:", nicolas.pagos);
}
run();
