import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$queryRaw`SELECT data_type FROM information_schema.columns WHERE table_name = 'socios' AND column_name = 'datos_confirmados'`;
  console.log(res);
}

main().finally(() => prisma.$disconnect());
