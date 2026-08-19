require('dotenv').config();
const { getCampaignStats, getRecipients } = require('./src/repositories/campaignRepo');

async function run() {
  const cid = '3e26de6e-b3f5-483d-8648-943ae66b35f2';
  const stats = await getCampaignStats(cid);
  const recs = await getRecipients(cid, { limit: 500, offset: 0, status: undefined });
  console.log(JSON.stringify({ stats, recs }, null, 2));
}
run();
