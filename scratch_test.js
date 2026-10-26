const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$queryRawUnsafe(`
    SELECT 
      CURRENT_DATE::text as server_date,
      CURRENT_TIME::text as server_time,
      ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)::text as hoy_arg,
      ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::time)::text as hora_arg;
  `);
  console.log(res);
}

main().catch(console.error).finally(() => prisma.$disconnect());
