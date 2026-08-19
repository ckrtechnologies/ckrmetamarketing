require('dotenv').config();
const supabase = require('./src/utils/supabase');
async function run() {
  const { data, error } = await supabase.from('conversations').select('id, customer_phone, waba_id, last_message').limit(5);
  console.log(error || data);
}
run();
