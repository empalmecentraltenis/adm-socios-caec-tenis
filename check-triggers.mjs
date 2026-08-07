import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.gaqobqwojhnntdtjndrw:CAECtenis.2026@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
});

async function check() {
  await client.connect();

  // Let's check the triggers on turnos
  const res = await client.query(`
    SELECT p.proname, p.prosrc
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE t.tgrelid = 'turnos'::regclass;
  `);
  console.log("Triggers on turnos:");
  res.rows.forEach(r => console.log(r.proname, ":", r.prosrc));

  // Let's also check the actual value of activo for Callegari
  const res2 = await client.query(`
    SELECT activo, estado FROM socios WHERE dni = '20847021';
  `);
  console.log("Callegari status:", res2.rows);

  await client.end();
}

check().catch(console.error);
