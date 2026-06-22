const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE pago_cuotas ENABLE ROW LEVEL SECURITY;`);
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "Cuotas visibles para todos los autenticados" ON pago_cuotas;`);
    await prisma.$executeRawUnsafe(`CREATE POLICY "Cuotas visibles para todos los autenticados" ON pago_cuotas FOR SELECT USING (auth.role() = 'authenticated');`);
    console.log("Policy added successfully");
  } catch(e) {
    console.error(e);
  }
}
run();
