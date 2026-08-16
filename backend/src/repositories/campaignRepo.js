const supabase = require('../utils/supabase');

// ── Campaigns ─────────────────────────────────────────────────

async function getCampaigns(org_id, { status, limit = 50, offset = 0 } = {}) {
  let query = supabase
    .from('campaigns')
    .select('*, waba_accounts(display_name, display_number)', { count: 'exact' })
    .eq('org_id', org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) throw error;
  return { campaigns: data, total: count };
}

async function getCampaignById(org_id, id) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*, waba_accounts(*)')
    .eq('id', id)
    .eq('org_id', org_id)
    .single();
  if (error) throw error;
  return data;
}

async function createCampaign({ org_id, waba_id, name, template_name, template_lang, scheduled_at, created_by }) {
  const { data, error } = await supabase
    .from('campaigns')
    .insert({ org_id, waba_id, name, template_name, template_lang: template_lang || 'en', scheduled_at, created_by })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateCampaign(org_id, id, updates) {
  const { data, error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .eq('org_id', org_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteCampaign(org_id, id) {
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('org_id', org_id);
  if (error) throw error;
}

// ── Campaign Recipients ───────────────────────────────────────

async function addRecipients(campaign_id, recipients) {
  // recipients: [{ contact_id, phone, variables }]
  const rows = recipients.map(r => ({ campaign_id, ...r }));
  const { data, error } = await supabase
    .from('campaign_recipients')
    .insert(rows)
    .select();
  if (error) throw error;
  return data;
}

async function getRecipients(campaign_id, { status, limit = 500, offset = 0 } = {}) {
  let query = supabase
    .from('campaign_recipients')
    .select('*', { count: 'exact' })
    .eq('campaign_id', campaign_id)
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) throw error;
  return { recipients: data, total: count };
}

async function getPendingRecipients(campaign_id) {
  const { data, error } = await supabase
    .from('campaign_recipients')
    .select('*')
    .eq('campaign_id', campaign_id)
    .eq('status', 'pending');
  if (error) throw error;
  return data;
}

async function updateRecipientByWamid(wamid, updates) {
  const { error } = await supabase
    .from('campaign_recipients')
    .update(updates)
    .eq('wamid', wamid);
  if (error) throw error;
}

async function updateRecipientStatus(id, status, extra = {}) {
  const ts = {};
  if (status === 'sent')      ts.sent_at      = new Date().toISOString();
  if (status === 'delivered') ts.delivered_at = new Date().toISOString();
  if (status === 'read')      ts.read_at      = new Date().toISOString();
  if (status === 'failed')    ts.failed_at    = new Date().toISOString();

  const { error } = await supabase
    .from('campaign_recipients')
    .update({ status, ...ts, ...extra })
    .eq('id', id);
  if (error) throw error;
}

async function getCampaignStats(campaign_id) {
  const { data, error } = await supabase
    .from('campaign_recipients')
    .select('status')
    .eq('campaign_id', campaign_id);
  if (error) throw error;

  const counts = { pending: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
  for (const r of data) counts[r.status] = (counts[r.status] || 0) + 1;
  counts.total = data.length;
  return counts;
}

// ── Delivery Logs ────────────────────────────────────────────

async function logDelivery({ wamid, status, error_code, error_msg }) {
  const { error } = await supabase
    .from('delivery_logs')
    .insert({ wamid, status, error_code, error_msg });
  if (error) console.error('[deliveryLog]', error.message);
}

module.exports = {
  getCampaigns, getCampaignById, createCampaign, updateCampaign, deleteCampaign,
  addRecipients, getRecipients, getPendingRecipients,
  updateRecipientByWamid, updateRecipientStatus, getCampaignStats,
  logDelivery,
};
