import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const lastFive = await prisma.movimiento.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  })
  console.log('Last 5 movements:')
  lastFive.forEach(m => {
    console.log(`ID: ${m.id} | Fecha (DB): ${m.fecha.toISOString()} | Desc: ${m.descripcion} | CreatedAt: ${m.createdAt.toISOString()}`)
  })
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
