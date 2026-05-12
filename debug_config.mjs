import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const configs = await prisma.configuracion.findMany()
  console.log('Configs:', configs)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
