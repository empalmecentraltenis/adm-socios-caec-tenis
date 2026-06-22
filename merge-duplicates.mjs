import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const socios = await prisma.socio.findMany({
    include: { pagos: true }
  });

  const map = new Map();

  for (const s of socios) {
    const key = `${s.nombre.trim().toLowerCase()} ${s.apellido.trim().toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(s);
  }

  let mergedCount = 0;

  for (const [key, list] of map.entries()) {
    if (list.length > 1) {
      // Ordenamos por longitud de DNI para identificar el real (más largo)
      const ordenados = list.sort((a, b) => b.dni.length - a.dni.length);
      const socioReal = ordenados[0];
      const sociosFalsos = ordenados.slice(1);

      console.log(`\nUnificando: ${socioReal.nombre} ${socioReal.apellido}`);
      console.log(`Socio Principal (Real): DNI ${socioReal.dni}`);

      for (const falso of sociosFalsos) {
        console.log(`  -> Mezclando datos desde DNI falso: ${falso.dni}`);

        // 1. Mover Pagos (sin duplicar meses)
        const mesesPagadosReal = new Set(socioReal.pagos.map(p => p.mesPagado));
        
        for (const pFalso of falso.pagos) {
          if (!mesesPagadosReal.has(pFalso.mesPagado)) {
            await prisma.pagoCuota.update({
              where: { id: pFalso.id },
              data: { socioId: socioReal.id }
            });
            console.log(`     - Movido pago del mes ${pFalso.mesPagado}`);
            mesesPagadosReal.add(pFalso.mesPagado); // Para no insertar otro del mismo mes si tuviera varios
          } else {
            // El usuario real ya tiene pago de ese mes (seguramente del Excel), lo borramos
            await prisma.pagoCuota.delete({ where: { id: pFalso.id } });
            console.log(`     - Eliminado pago duplicado del mes ${pFalso.mesPagado}`);
          }
        }

        // 2. Mover Turnos (Reservas)
        const turnos = await prisma.turno.updateMany({
          where: { socioDni: falso.dni },
          data: { socioDni: socioReal.dni }
        });
        if (turnos.count > 0) console.log(`     - Movidos ${turnos.count} turnos`);

        // 3. Mover Lista de Espera
        const listas = await prisma.listaEspera.findMany({ where: { socioDni: falso.dni } });
        for (const le of listas) {
          // Chequear si el real ya está en la lista para evitar Unique Constraint
          const existe = await prisma.listaEspera.findFirst({
            where: { turnoId: le.turnoId, socioDni: socioReal.dni }
          });
          if (!existe) {
            await prisma.listaEspera.update({
              where: { id: le.id },
              data: { socioDni: socioReal.dni }
            });
          } else {
            await prisma.listaEspera.delete({ where: { id: le.id } });
          }
        }

        // 4. Mover Cuotas pendientes (si las hubiera, aunque la lógica usa pagos)
        // Para simplificar, si tiene cuotas viejas generadas, las borramos o movemos
        await prisma.cuota.deleteMany({ where: { socioId: falso.id } });

        // 5. Eliminar Socio Falso
        await prisma.socio.delete({ where: { id: falso.id } });
        console.log(`     - Socio falso eliminado con éxito.`);
        mergedCount++;
      }
    }
  }

  console.log(`\n¡Listo! Se unificaron ${mergedCount} perfiles duplicados.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
