require('dotenv').config();
const supabase = require('./src/utils/supabase');
async function run() {
  const c = await supabase.from('campaigns').select('id, name').limit(1);
  const recs = await supabase.from('campaign_recipients').select('*').eq('campaign_id', c.data[0].id).limit(1);
  console.log(recs.data[0]);
}
run();
