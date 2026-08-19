require('dotenv').config();
const supabase = require('./src/utils/supabase');
async function run() {
  const cid = '3e26de6e-b3f5-483d-8648-943ae66b35f2';
  const repo = require('./src/repositories/campaignRepo');
  
  const stats = await repo.getCampaignStats(cid);
  console.log('STATS:', stats);

  const { recipients, total } = await repo.getRecipients(cid, { limit: 500, offset: 0, status: undefined });
  console.log('RECIPIENTS COUNT:', recipients.length, 'TOTAL:', total);
}
run();
