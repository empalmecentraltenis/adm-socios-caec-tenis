const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTrigger() {
  // Drop and recreate the trigger function without the 'activo = true' check
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION validar_socio_activo()
    RETURNS trigger AS $$
    BEGIN
        -- Buscamos al socio por su DNI y verificamos que esté activo
        IF NOT EXISTS (
            SELECT 1 FROM socios 
            WHERE dni = NEW.socio_dni 
            AND estado = 'activo'
        ) THEN
            -- Si no está activo o no existe, lanzamos un error que bloquea la reserva
            RAISE EXCEPTION 'El socio con DNI % no está habilitado para reservar. Por favor, regularice su situación en administración.', NEW.socio_dni;
        END IF;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log("Trigger function updated to only check estado='activo'");
}

fixTrigger().then(() => prisma.$disconnect()).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
