import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const policies = await prisma.$queryRaw`
    SELECT * FROM pg_policies WHERE tablename = 'socios';
  `
  console.log('RLS Policies for socios:', JSON.stringify(policies, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
