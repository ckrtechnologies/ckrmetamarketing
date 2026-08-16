/**
 * adsRepo.js
 * Supabase queries for Ads Manager module
 */

const { createClient } = require('@supabase/supabase-js');

function supabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

// ── Ad Accounts ────────────────────────────────────────────────

async function getAdAccounts(org_id) {
  const { data, error } = await supabase()
    .from('ad_accounts')
    .select('*')
    .eq('org_id', org_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getAdAccount(org_id, id) {
  const { data, error } = await supabase()
    .from('ad_accounts')
    .select('*')
    .eq('org_id', org_id)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getActiveAdAccount(org_id) {
  const { data, error } = await supabase()
    .from('ad_accounts')
    .select('*')
    .eq('org_id', org_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createAdAccount(org_id, { act_id, name, currency, timezone, access_token }) {
  const { data, error } = await supabase()
    .from('ad_accounts')
    .insert({ org_id, act_id, name, currency, timezone, access_token, is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateAdAccount(org_id, id, updates) {
  const allowed = ['name', 'access_token', 'is_active'];
  const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
  const { data, error } = await supabase()
    .from('ad_accounts')
    .update(filtered)
    .eq('org_id', org_id)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteAdAccount(org_id, id) {
  const { error } = await supabase()
    .from('ad_accounts')
    .delete()
    .eq('org_id', org_id)
    .eq('id', id);
  if (error) throw error;
}

// ── Ad Campaigns ───────────────────────────────────────────────

async function getAdCampaigns(org_id, ad_account_id) {
  let q = supabase()
    .from('ad_campaigns')
    .select('*')
    .eq('org_id', org_id)
    .order('created_at', { ascending: false });
  if (ad_account_id) q = q.eq('ad_account_id', ad_account_id);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function upsertAdCampaign(org_id, {
  ad_account_id, meta_campaign_id, name, objective,
  status, daily_budget, lifetime_budget, start_time, end_time,
}) {
  // Check if exists
  const { data: existing } = await supabase()
    .from('ad_campaigns')
    .select('id')
    .eq('meta_campaign_id', meta_campaign_id)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase()
      .from('ad_campaigns')
      .update({ name, status, daily_budget, lifetime_budget, start_time, end_time })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase()
      .from('ad_campaigns')
      .insert({ org_id, ad_account_id, meta_campaign_id, name, objective, status, daily_budget, lifetime_budget, start_time, end_time })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

async function updateAdCampaignStatus(meta_campaign_id, status) {
  const { data, error } = await supabase()
    .from('ad_campaigns')
    .update({ status })
    .eq('meta_campaign_id', meta_campaign_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteAdCampaign(org_id, meta_campaign_id) {
  const { error } = await supabase()
    .from('ad_campaigns')
    .delete()
    .eq('org_id', org_id)
    .eq('meta_campaign_id', meta_campaign_id);
  if (error) throw error;
}

// ── Ad Insights ────────────────────────────────────────────────

async function saveInsights(org_id, meta_id, meta_id_type, insightRows) {
  if (!insightRows || insightRows.length === 0) return;

  const rows = insightRows.map(i => ({
    org_id,
    meta_id,
    meta_id_type,
    date_start: i.date_start,
    date_stop: i.date_stop,
    impressions: parseInt(i.impressions || 0),
    clicks: parseInt(i.clicks || 0),
    spend: parseFloat(i.spend || 0),
    reach: parseInt(i.reach || 0),
    ctr: parseFloat(i.ctr || 0),
    cpc: parseFloat(i.cpc || 0),
    cpm: parseFloat(i.cpm || 0),
    actions: i.actions || null,
    fetched_at: new Date().toISOString(),
  }));

  const { error } = await supabase()
    .from('ad_insights')
    .upsert(rows, { onConflict: 'org_id,meta_id,date_start,date_stop' });
  if (error) throw error;
}

async function getInsights(org_id, { meta_id, days = 30 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let q = supabase()
    .from('ad_insights')
    .select('*')
    .eq('org_id', org_id)
    .gte('date_start', since)
    .order('date_start', { ascending: true });
  if (meta_id) q = q.eq('meta_id', meta_id);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

module.exports = {
  getAdAccounts, getAdAccount, getActiveAdAccount, createAdAccount, updateAdAccount, deleteAdAccount,
  getAdCampaigns, upsertAdCampaign, updateAdCampaignStatus, deleteAdCampaign,
  saveInsights, getInsights,
};
