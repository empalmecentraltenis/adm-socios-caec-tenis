import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const activos = await prisma.socio.findMany({
    where: { estado: 'activo', categoria: { not: 'vitalicio' } },
    include: { pagos: { orderBy: { mesPagado: 'desc' }, take: 1 } }
  })
  
  const ahora = new Date()
  const mesActual = '2026-04'
  const [yA, mA] = mesActual.split("-").map(Number);
  
  const morosos = activos.map(socio => {
    const ultimoPago = socio.pagos[0]?.mesPagado
    let meses = 0
    if (ultimoPago) {
      const [y, m] = ultimoPago.split("-").map(Number)
      meses = (yA - y) * 12 + (mA - m)
    } else {
      meses = (yA - socio.fechaAlta.getFullYear()) * 12 + (mA - (socio.fechaAlta.getMonth() + 1))
    }
    return { dni: socio.dni, nombre: socio.nombre, apellido: socio.apellido, meses }
  }).filter(m => m.meses >= 1)
  
  console.log('Morosos (>= 1 mes):', JSON.stringify(morosos, null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
