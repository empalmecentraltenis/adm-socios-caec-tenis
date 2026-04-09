import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const allActivos = await prisma.socio.findMany({
    where: { estado: 'activo' },
    select: { dni: true, nombre: true, apellido: true, categoria: true, fechaAlta: true }
  })
  console.log('All Activos (first 10):', JSON.stringify(allActivos.slice(0, 10), null, 2))
  
  const sample = await prisma.socio.findFirst({
    where: { apellido: { contains: 'SMIRSICH' } },
    include: { pagos: true }
  })
  console.log('Sample SMIRSICH:', JSON.stringify(sample, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
