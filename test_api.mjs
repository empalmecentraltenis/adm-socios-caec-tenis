import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const plazos = await prisma.plazoFijo.findMany();
  console.log('Plazos:', plazos);
  if (plazos.length > 0) {
    const p = plazos[0];
    console.log('Updating:', p.id);
    const res = await fetch(`http://localhost:3000/api/plazos-fijos/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        banco: p.banco,
        montoInvertido: p.montoInvertido,
        interesGenerado: 0,
        fechaConstitucion: '2026-09-01',
        fechaVencimiento: '2026-09-18',
        estado: 'activo'
      })
    });
    console.log('Res:', await res.text());
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
