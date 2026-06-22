const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gaqobqwojhnntdtjndrw.supabase.co';
const supabaseAnonKey = 'sb_publishable_m0icTuFvVriIcpX143xPug_9D1AGOgP';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, count, error } = await supabase.from('pago_cuotas').select('*', { count: 'exact', head: true });
  console.log("Count of pago_cuotas:", count);
}
run();
