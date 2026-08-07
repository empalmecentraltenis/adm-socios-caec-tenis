const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // Try to update Callegari's activo to true directly!
  const upd = await prisma.socio.updateMany({
    where: { estado: 'activo' },
    data: { activo: true }
  });
  console.log("Updated socios to activo: true =>", upd.count);

  const callegari = await prisma.socio.findFirst({
    where: { dni: '20847021' }
  });
  console.log("Callegari after update:", callegari);

  // Check triggers
  const triggers = await prisma.$queryRaw`
    SELECT p.proname, p.prosrc
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE t.tgrelid = 'turnos'::regclass;
  `;
  console.log("Triggers:", triggers);
}

check().then(() => prisma.$disconnect()).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
