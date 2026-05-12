import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const clave = 'saldo_inicial_enero_2026'
  const valor = '123456.78'
  
  console.log('Upserting...')
  const result = await prisma.configuracion.upsert({
    where: { clave },
    update: { valor },
    create: { clave, valor },
  })
  console.log('Result:', result)
  
  const all = await prisma.configuracion.findMany()
  console.log('All configs:', all)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
