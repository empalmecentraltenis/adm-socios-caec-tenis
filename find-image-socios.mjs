import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const targetNames = [
  "ALBERTO BELLESI",
  "DAMIAN BELLESI",
  "JOAQUIN NICOLAS BENITEZ",
  "MARTIN ARIEL BERNACHI",
  "NICOLAS IVAN CACERES",
  "ROMAN CIRIBE",
  "AGUSTIN COLANGELO",
  "IVAN COLANGELO",
  "JOSE LUIS COLANGELO",
  "MARTIN COLANGELO",
  "FLAVIO FINOCCHIO",
  "IGNACIO FONTANA",
  "JORGE GONZALEZ",
  "GERARDO MATIAS GONZALEZ",
  "ALEJANDRO MANIERI",
  "JUAN PABLO MANSILLA",
  "FABRICIO ROMAN MARRI",
  "PAOLO ALEJANDRO MARRI",
  "RAUL RUBEN MARRI",
  "JESICA MOYANO",
  "DEBORA NATALI PASERINI",
  "JUAN IGNACIO PRIETO",
  "ADOLFO RAMIREZ",
  "DARIO PENESI",
  "DAVID EZEQUIEL REPUPILLI",
  "IGNACIO RODRIGUEZ",
  "HERNAN F. RODRIGUEZ",
  "ROMINA SOLEDAD ROMAN",
  "MARIANO ROSALES",
  "NICOLAS RUFFINI",
  "RICARDO SALUZZIO",
  "ALBERTO SERPICELLI",
  "ANDRES SMIRSICH",
  "ROCIO SOLIS",
  "DARIO SVEGLIATI",
  "ANA LAURA TIRACORDA",
  "JOSE MARIA TOLEDO",
  "FRANCO ARIEL GONZALEZ",
  "ELENA CAMACHO",
  "LUIS ALBERTO BERRIOS",
  "ALVARO UBOLDI",
  "NICOLAS EMANUEL CHURICHI",
  "ALDANA COLANGELO",
  "VERUSCA GROSSO",
  "PAOLA SAURETTI",
  "IVANA ANAHI SCIACALUGA",
  "ESTEBAN GUTIERREZ",
  "FLORENCIA GUTIERREZ",
  "EDGARDO SEMANA",
  "JAEL CELESTE RODRIGUEZ JEREZ",
  "MARINA MARAZZI",
  "LISANDRO GAÑAN",
  "TOMAS MARAZZI",
  "BETIANA MARIA FERNANDA AND"
];

function normalizeString(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function main() {
  const socios = await prisma.socio.findMany();
  
  const found = [];
  const notFound = [];

  for (const target of targetNames) {
    const normTarget = normalizeString(target);
    
    // Find matching socio
    const match = socios.find(s => {
      const fullName = normalizeString(`${s.nombre} ${s.apellido}`);
      const fullNameReverse = normalizeString(`${s.apellido} ${s.nombre}`);
      
      return fullName.includes(normTarget) || fullNameReverse.includes(normTarget) || normTarget.includes(fullName) || normTarget.includes(fullNameReverse);
    });

    if (match) {
      found.push({ target, dbMatch: `${match.nombre} ${match.apellido}`, dni: match.dni, estado: match.estado });
    } else {
      // try a looser match (e.g., matching some words)
      const targetWords = normTarget.split(' ').filter(w => w.length > 2);
      const looseMatch = socios.find(s => {
          const sName = normalizeString(`${s.nombre} ${s.apellido}`);
          return targetWords.every(w => sName.includes(w));
      });
      if (looseMatch) {
          found.push({ target, dbMatch: `${looseMatch.nombre} ${looseMatch.apellido}`, dni: looseMatch.dni, estado: looseMatch.estado, loose: true });
      } else {
          notFound.push(target);
      }
    }
  }

  console.log("--- ENCONTRADOS ---");
  found.forEach(f => console.log(`${f.target} -> Encontrado como: ${f.dbMatch} (DNI: ${f.dni}, Estado: ${f.estado})${f.loose ? ' [Coincidencia parcial]' : ''}`));
  
  console.log("\n--- NO ENCONTRADOS ---");
  notFound.forEach(n => console.log(n));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
