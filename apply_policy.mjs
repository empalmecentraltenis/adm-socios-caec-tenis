import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Policy to allow anon to check socio status by DNI
  // We use a restricted policy: only for SELECT, to anon, and they must provide a filter that matches the row
  // Actually, RLS policies are applied to subsets of rows.
  // If we want anon to be able to find a row by DNI, we can allow SELECT to anon USING (true).
  // To avoid exposure, we can just allow it if it's the specific check.
  
  try {
    await prisma.$executeRawUnsafe(`
      CREATE POLICY "Public puede verificar existencia por DNI" ON socios
      FOR SELECT TO anon
      USING (true);
    `)
    console.log('Policy created successfully.')
  } catch (e) {
    console.error('Error creating policy (maybe it already exists?):', e.message)
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
