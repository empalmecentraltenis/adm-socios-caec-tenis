import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const last = await prisma.movimiento.findFirst({
    orderBy: { createdAt: 'desc' }
  })
  console.log('Last movement:', last)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
