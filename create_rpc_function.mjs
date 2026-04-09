import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION check_socio_status(p_dni text)
    RETURNS TABLE (activo boolean, estado text, existe boolean) 
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      RETURN QUERY 
      SELECT s.activo, s.estado, true as existe
      FROM socios s
      WHERE s.dni = p_dni
      LIMIT 1;
      
      IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'inexistente'::text, false;
      END IF;
    END;
    $$;
  `)
  
  await prisma.$executeRawUnsafe(`
    GRANT EXECUTE ON FUNCTION check_socio_status(text) TO anon;
    GRANT EXECUTE ON FUNCTION check_socio_status(text) TO authenticated;
  `)
  
  console.log('Function check_socio_status created successfully.')
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
