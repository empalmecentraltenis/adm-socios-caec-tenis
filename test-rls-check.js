const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  // Check RLS policies on pago_cuotas
  const policies = await prisma.$queryRaw`
    SELECT policyname, cmd, qual 
    FROM pg_policies 
    WHERE tablename = 'pago_cuotas';
  `;
  console.log("RLS policies on pago_cuotas:", JSON.stringify(policies, null, 2));

  // Check RLS policies on socios
  const policiesSocios = await prisma.$queryRaw`
    SELECT policyname, cmd, qual 
    FROM pg_policies 
    WHERE tablename = 'socios';
  `;
  console.log("RLS policies on socios:", JSON.stringify(policiesSocios, null, 2));

  // Check if RLS is enabled
  const rlsStatus = await prisma.$queryRaw`
    SELECT relname, relrowsecurity 
    FROM pg_class 
    WHERE relname IN ('pago_cuotas', 'socios');
  `;
  console.log("RLS enabled:", JSON.stringify(rlsStatus, null, 2));

  // Check a sample row from pago_cuotas to see actual column names returned
  const samplePago = await prisma.$queryRaw`SELECT * FROM pago_cuotas LIMIT 1;`;
  console.log("Sample pago_cuotas row:", JSON.stringify(samplePago, null, 2));
}
run();
