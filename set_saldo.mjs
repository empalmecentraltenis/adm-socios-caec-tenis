import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const clave = 'saldo_inicial_enero_2026'
  const valor = '601327.29'
  
  console.log(`Setting ${clave} to ${valor}...`)
  const result = await prisma.configuracion.upsert({
    where: { clave },
    update: { valor },
    create: { clave, valor },
  })
  console.log('Result:', result)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
