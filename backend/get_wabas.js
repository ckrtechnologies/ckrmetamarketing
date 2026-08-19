require('dotenv').config();
const supabase = require('./src/utils/supabase');
async function run() {
  const { data, error } = await supabase.from('waba_accounts').select('*');
  console.log(error || data);
}
run();
