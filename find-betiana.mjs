import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const socios = await prisma.socio.findMany();
  const betiana = socios.find(s => s.nombre.toLowerCase().includes('betiana'));
  console.log(betiana);
}
main().finally(() => prisma.$disconnect());
