require('dotenv').config();
const supabase = require('./src/utils/supabase');
async function run() {
  const { data } = await supabase.from('messages').select('*').limit(1);
  console.log(data[0]);
}
run();
