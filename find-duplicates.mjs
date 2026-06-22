import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const socios = await prisma.socio.findMany({
    include: {
      pagos: true
    }
  });

  const map = new Map();

  // Agrupamos por nombre y apellido (limpiando espacios y pasándolo a minúsculas para comparar mejor)
  for (const s of socios) {
    const key = `${s.nombre.trim().toLowerCase()} ${s.apellido.trim().toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(s);
  }

  console.log("=== POSIBLES SOCIOS DUPLICADOS ===");
  let count = 0;

  for (const [key, list] of map.entries()) {
    if (list.length > 1) {
      count++;
      console.log(`\nNombre: ${list[0].nombre} ${list[0].apellido}`);
      for (const s of list) {
        console.log(`  - DNI: ${s.dni} | Estado: ${s.estado} | Pagos: ${s.pagos.length} | Fecha Alta: ${s.fechaAlta.toISOString().split('T')[0]}`);
      }
    }
  }

  if (count === 0) {
    console.log("No se encontraron nombres duplicados exactos.");
  }
}

main().finally(() => prisma.$disconnect());
