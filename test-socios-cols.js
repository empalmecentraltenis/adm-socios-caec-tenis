const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const data = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'socios';
  `;
  console.log("Columns of socios:", data);
}
run();
