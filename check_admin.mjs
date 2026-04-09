import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const adminSocio = await prisma.socio.findUnique({ where: { dni: 'admin' } })
  console.log('Admin Socio:', adminSocio)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
