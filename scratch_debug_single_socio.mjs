import { PrismaClient } from '@prisma/client';

const p = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.gaqobqwojhnntdtjndrw:CAECtenis.2026@aws-1-sa-east-1.pooler.supabase.com:5432/postgres'
    }
  }
});

async function main() {
  const socios = await p.socio.findMany({
    take: 5,
    include: {
      cuotas: true,
      pagos: { orderBy: { mesPagado: 'desc' } }
    }
  });

  const ahora = new Date();
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
  const mesActualNum = ahora.getFullYear() * 12 + (ahora.getMonth() + 1);

  for (const s of socios) {
    console.log('-----------------------------');
    console.log(`Socio: ${s.apellido}, ${s.nombre} (${s.dni}) - Cat: ${s.categoria} - Estado: ${s.estado}`);
    console.log('Últimos 3 pagos:', s.pagos.slice(0, 3).map(p => p.mesPagado));
    console.log('Cuotas en tabla cuotas:', s.cuotas.map(c => `${c.mes} (${c.estado})`));

    const todosLosMesesRegistrados = [
      ...s.pagos.map(p => p.mesPagado),
      ...s.cuotas.map(c => c.mes)
    ].sort();
    console.log('todosLosMesesRegistrados max:', todosLosMesesRegistrados[todosLosMesesRegistrados.length - 1]);
    
    const cuotasPendientes = s.cuotas.filter(c => c.estado === 'pendiente');
    console.log('cuotasPendientes count:', cuotasPendientes.length);
  }

  process.exit(0);
}

main().catch(console.error);
