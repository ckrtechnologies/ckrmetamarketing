require('dotenv').config();
const supabase = require('./src/utils/supabase');
async function run() {
  const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(data);
}
run();
