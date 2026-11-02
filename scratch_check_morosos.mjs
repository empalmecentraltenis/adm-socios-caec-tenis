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
    select: {
      id: true,
      dni: true,
      nombre: true,
      apellido: true,
      categoria: true,
      estado: true,
      fechaAlta: true,
      cuotas: { select: { id: true, mes: true, estado: true } },
      pagos: { select: { id: true, mesPagado: true, monto: true } }
    }
  });

  console.log('Total socios:', socios.length);
  
  const cuotasPendientesCount = await p.cuota.count({ where: { estado: 'pendiente' } });
  const cuotasPagadasCount = await p.cuota.count({ where: { estado: 'pagada' } });
  const pagosCuotasCount = await p.pagoCuota.count();

  console.log('Cuotas en tabla cuotas: pendientes =', cuotasPendientesCount, ', pagadas =', cuotasPagadasCount);
  console.log('Pagos en tabla pago_cuotas =', pagosCuotasCount);

  // Muestra de algunos socios y sus pagos / cuotas
  const sociosConPagos = socios.filter(s => s.pagos.length > 0);
  console.log('Socios con al menos un pago registrado:', sociosConPagos.length);

  const sociosConCuotas = socios.filter(s => s.cuotas.length > 0);
  console.log('Socios con registros en cuotas:', sociosConCuotas.length);

  // Ver los últimos pagos registrados en general
  const ultimosPagos = await p.pagoCuota.findMany({
    take: 5,
    orderBy: { fechaRegistro: 'desc' }
  });
  console.log('Últimos 5 pagos:', ultimosPagos);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
