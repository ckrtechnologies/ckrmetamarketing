require('dotenv').config();
const supabase = require('./src/utils/supabase');
async function run() {
  const c = await supabase.from('campaigns').select('id, name');
  console.log('CAMPAIGNS:', c.data);
  const recs = await supabase.from('campaign_recipients').select('*');
  console.log('RECS:', recs.data);
}
run();
