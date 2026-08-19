require('dotenv').config();
const supabase = require('./src/utils/supabase');
async function run() {
  const c = await supabase.from('campaigns').select('id, name').limit(1);
  const cid = c.data[0].id;
  
  const stats = await supabase.from('campaign_recipients').select('status').eq('campaign_id', cid);
  console.log('STATS:', stats.data.length);
  
  const recs = await supabase.from('campaign_recipients').select('*', { count: 'exact' }).eq('campaign_id', cid).range(0, 499);
  console.log('RECS:', recs.data.length, 'COUNT:', recs.count);
}
run();
