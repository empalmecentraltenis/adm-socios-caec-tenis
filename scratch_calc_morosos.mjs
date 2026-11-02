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
    include: {
      cuotas: true,
      pagos: true,
    }
  });

  const ahora = new Date();
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;

  let morososReales = 0;
  let alDiaCount = 0;

  const detalleMorosos = [];

  for (const socio of socios) {
    const cuotasPendientes = socio.cuotas.filter(c => c.estado === 'pendiente');
    let mesesAdeudadosReales = cuotasPendientes.length;

    let debeMesActualVirtual = false;
    if (socio.estado === 'activo' && socio.categoria !== 'vitalicio' && socio.rol !== 'admin') {
      const todosLosMesesRegistrados = [
        ...socio.pagos.map(p => p.mesPagado),
        ...socio.cuotas.map(c => c.mes)
      ].sort();

      const mesActualNum = ahora.getFullYear() * 12 + (ahora.getMonth() + 1);
      let mesInicioNum;

      if (todosLosMesesRegistrados.length > 0) {
        const lastMes = todosLosMesesRegistrados[todosLosMesesRegistrados.length - 1];
        const [y, m] = lastMes.split("-").map(Number);
        mesInicioNum = (y * 12 + m) + 1;
        
        if (lastMes < mesActual) {
          debeMesActualVirtual = true;
        }
      } else {
        const fechaAlta = socio.fechaAlta ? new Date(socio.fechaAlta) : ahora;
        mesInicioNum = fechaAlta.getFullYear() * 12 + (fechaAlta.getMonth() + 1);
        debeMesActualVirtual = true;
      }

      if (mesInicioNum <= mesActualNum) {
        mesesAdeudadosReales += (mesActualNum - mesInicioNum + 1);
      }
    }

    const debeMesActualFisico = cuotasPendientes.some(c => c.mes === mesActual);
    if (debeMesActualFisico || debeMesActualVirtual) {
      mesesAdeudadosReales = Math.max(0, mesesAdeudadosReales - 1);
    }

    const esVitalicio = socio.categoria === "vitalicio";
    const esAdmin = socio.rol === "admin";
    const alDia = esAdmin || esVitalicio || mesesAdeudadosReales < 2;

    if (!alDia) {
      morososReales++;
      detalleMorosos.push({
        socio: `${socio.apellido}, ${socio.nombre}`,
        dni: socio.dni,
        categoria: socio.categoria,
        mesesAdeudados: mesesAdeudadosReales,
        cuotasPendientesFisicas: cuotasPendientes.map(c => c.mes),
        ultimoPago: socio.pagos.sort((a,b) => b.mesPagado.localeCompare(a.mesPagado))[0]?.mesPagado || 'Nunca'
      });
    } else {
      alDiaCount++;
    }
  }

  console.log('Mes evaluado:', mesActual);
  console.log('Total socios:', socios.length);
  console.log('Socios al día según cálculo:', alDiaCount);
  console.log('Socios morosos según cálculo:', morososReales);
  console.log('Primeros 10 morosos calculados:', detalleMorosos.slice(0, 10));

  process.exit(0);
}

main().catch(console.error);
