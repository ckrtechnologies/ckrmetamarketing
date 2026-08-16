const supabase = require('../utils/supabase');

// ── Overview Stats ─────────────────────────────────────────────

async function getOverviewStats(org_id) {
  const [campaigns, contacts, conversations, messages] = await Promise.all([
    supabase.from('campaigns').select('id, status, total_recipients', { count: 'exact' }).eq('org_id', org_id),
    supabase.from('contacts').select('id', { count: 'exact' }).eq('org_id', org_id),
    supabase.from('conversations').select('id, status', { count: 'exact' }).eq('org_id', org_id),
    supabase.from('messages').select('id, direction', { count: 'exact' })
      .in('conversation_id',
        (await supabase.from('conversations').select('id').eq('org_id', org_id)).data?.map(c => c.id) || []
      ),
  ]);

  const campaignData = campaigns.data || [];
  const totalRecipients = campaignData.reduce((s, c) => s + (c.total_recipients || 0), 0);

  return {
    total_campaigns:    campaigns.count || 0,
    active_campaigns:   campaignData.filter(c => c.status === 'running').length,
    completed_campaigns:campaignData.filter(c => c.status === 'completed').length,
    total_contacts:     contacts.count || 0,
    total_conversations:conversations.count || 0,
    open_conversations: (conversations.data || []).filter(c => c.status === 'open').length,
    total_messages:     messages.count || 0,
    total_recipients:   totalRecipients,
  };
}

// ── Campaign Funnel (aggregate all campaigns) ──────────────────

async function getCampaignFunnelStats(org_id, { campaign_id } = {}) {
  let query = supabase
    .from('campaign_recipients')
    .select('status');

  if (campaign_id) {
    query = query.eq('campaign_id', campaign_id);
  } else {
    // Get all campaign IDs for this org
    const { data: campaignIds } = await supabase
      .from('campaigns')
      .select('id')
      .eq('org_id', org_id);
    const ids = (campaignIds || []).map(c => c.id);
    if (ids.length === 0) return { pending: 0, sent: 0, delivered: 0, read: 0, failed: 0, total: 0 };
    query = query.in('campaign_id', ids);
  }

  const { data, error } = await query;
  if (error) throw error;

  const counts = { pending: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
  for (const r of (data || [])) counts[r.status] = (counts[r.status] || 0) + 1;
  counts.total = (data || []).length;

  // Delivery and read rates
  counts.delivery_rate = counts.total > 0 ? +((counts.delivered + counts.read) / counts.total * 100).toFixed(1) : 0;
  counts.read_rate     = counts.total > 0 ? +(counts.read / counts.total * 100).toFixed(1) : 0;

  return counts;
}

// ── Daily Message Volume (last N days) ────────────────────────

async function getDailyMessageVolume(org_id, days = 14) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Get all conv IDs for org
  const { data: convIds } = await supabase
    .from('conversations')
    .select('id')
    .eq('org_id', org_id);
  const ids = (convIds || []).map(c => c.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('direction, sent_at')
    .in('conversation_id', ids)
    .gte('sent_at', since)
    .order('sent_at', { ascending: true });

  if (error) throw error;

  // Group by date
  const byDate = {};
  for (const msg of (data || [])) {
    const day = msg.sent_at.split('T')[0];
    if (!byDate[day]) byDate[day] = { date: day, inbound: 0, outbound: 0 };
    byDate[day][msg.direction]++;
  }

  // Fill missing days
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().split('T')[0];
    result.push(byDate[key] || { date: key, inbound: 0, outbound: 0 });
  }
  return result;
}

// ── Campaign Volume per day (outgoing from campaigns) ─────────

async function getDailyCampaignVolume(org_id, days = 14) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: campaignIds } = await supabase
    .from('campaigns')
    .select('id')
    .eq('org_id', org_id);
  const ids = (campaignIds || []).map(c => c.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('campaign_recipients')
    .select('status, sent_at')
    .in('campaign_id', ids)
    .gte('sent_at', since)
    .not('sent_at', 'is', null);

  if (error) throw error;

  const byDate = {};
  for (const r of (data || [])) {
    const day = r.sent_at.split('T')[0];
    if (!byDate[day]) byDate[day] = { date: day, sent: 0, delivered: 0, read: 0, failed: 0 };
    if (r.status === 'sent')      byDate[day].sent++;
    if (r.status === 'delivered') byDate[day].delivered++;
    if (r.status === 'read')      byDate[day].read++;
    if (r.status === 'failed')    byDate[day].failed++;
  }

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().split('T')[0];
    result.push(byDate[key] || { date: key, sent: 0, delivered: 0, read: 0, failed: 0 });
  }
  return result;
}

// ── Top Templates ─────────────────────────────────────────────

async function getTopTemplates(org_id, limit = 10) {
  const { data: campaignIds } = await supabase
    .from('campaigns')
    .select('id, template_name, total_recipients, status')
    .eq('org_id', org_id)
    .in('status', ['completed', 'running', 'paused']);

  if (!campaignIds?.length) return [];

  // Group by template_name
  const byTemplate = {};
  for (const c of campaignIds) {
    const t = c.template_name;
    if (!byTemplate[t]) byTemplate[t] = { template_name: t, campaigns: 0, total_sent: 0 };
    byTemplate[t].campaigns++;
    byTemplate[t].total_sent += c.total_recipients || 0;
  }

  // Enrich with delivery stats
  const ids = campaignIds.map(c => c.id);
  const { data: recipients } = await supabase
    .from('campaign_recipients')
    .select('campaign_id, status')
    .in('campaign_id', ids);

  const campaignToTemplate = {};
  for (const c of campaignIds) campaignToTemplate[c.id] = c.template_name;

  for (const r of (recipients || [])) {
    const t = campaignToTemplate[r.campaign_id];
    if (!t || !byTemplate[t]) continue;
    if (!byTemplate[t].delivered) byTemplate[t].delivered = 0;
    if (!byTemplate[t].read) byTemplate[t].read = 0;
    if (r.status === 'delivered' || r.status === 'read') byTemplate[t].delivered++;
    if (r.status === 'read') byTemplate[t].read++;
  }

  return Object.values(byTemplate)
    .map(t => ({
      ...t,
      delivery_rate: t.total_sent > 0 ? +((t.delivered || 0) / t.total_sent * 100).toFixed(1) : 0,
      read_rate:     t.total_sent > 0 ? +((t.read || 0) / t.total_sent * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.total_sent - a.total_sent)
    .slice(0, limit);
}

// ── Campaign List with stats ───────────────────────────────────

async function getCampaignPerformance(org_id, limit = 10) {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, template_name, status, total_recipients, created_at, completed_at')
    .eq('org_id', org_id)
    .in('status', ['completed', 'running', 'paused', 'failed'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!campaigns?.length) return [];

  const ids = campaigns.map(c => c.id);
  const { data: recipients } = await supabase
    .from('campaign_recipients')
    .select('campaign_id, status')
    .in('campaign_id', ids);

  const statsById = {};
  for (const r of (recipients || [])) {
    if (!statsById[r.campaign_id]) statsById[r.campaign_id] = { sent: 0, delivered: 0, read: 0, failed: 0 };
    statsById[r.campaign_id][r.status] = (statsById[r.campaign_id][r.status] || 0) + 1;
  }

  return campaigns.map(c => {
    const s = statsById[c.id] || {};
    const total = c.total_recipients || 0;
    return {
      ...c,
      stats: s,
      delivery_rate: total > 0 ? +((((s.delivered || 0) + (s.read || 0)) / total) * 100).toFixed(1) : 0,
      read_rate:     total > 0 ? +((s.read || 0) / total * 100).toFixed(1) : 0,
    };
  });
}

module.exports = { getOverviewStats, getCampaignFunnelStats, getDailyMessageVolume, getDailyCampaignVolume, getTopTemplates, getCampaignPerformance };
