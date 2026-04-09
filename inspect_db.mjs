import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const socio = await prisma.socio.findFirst()
  console.log('Sample Socio:', socio)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
