const repo = require('../repositories/analyticsRepo');

// GET /api/v2/analytics/overview
async function getOverview(req, res) {
  try {
    const stats = await repo.getOverviewStats(req.orgId);
    res.json({ stats });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /api/v2/analytics/funnel?campaign_id=...
async function getFunnel(req, res) {
  try {
    const { campaign_id } = req.query;
    const funnel = await repo.getCampaignFunnelStats(req.orgId, { campaign_id });
    res.json({ funnel });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /api/v2/analytics/daily-messages?days=14
async function getDailyMessages(req, res) {
  try {
    const days = Math.min(parseInt(req.query.days || 14), 90);
    const data = await repo.getDailyMessageVolume(req.orgId, days);
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /api/v2/analytics/daily-campaigns?days=14
async function getDailyCampaigns(req, res) {
  try {
    const days = Math.min(parseInt(req.query.days || 14), 90);
    const data = await repo.getDailyCampaignVolume(req.orgId, days);
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /api/v2/analytics/top-templates
async function getTopTemplates(req, res) {
  try {
    const { limit = 10 } = req.query;
    const templates = await repo.getTopTemplates(req.orgId, +limit);
    res.json({ templates });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /api/v2/analytics/campaign-performance
async function getCampaignPerformance(req, res) {
  try {
    const { limit = 10 } = req.query;
    const campaigns = await repo.getCampaignPerformance(req.orgId, +limit);
    res.json({ campaigns });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /api/v2/analytics/all — single call to fetch everything
async function getAll(req, res) {
  try {
    const days = Math.min(parseInt(req.query.days || 14), 90);
    const stats = await repo.getOverviewStats(req.orgId);
    const funnel = await repo.getCampaignFunnelStats(req.orgId);
    const dailyMessages = await repo.getDailyMessageVolume(req.orgId, days);
    const dailyCampaigns = await repo.getDailyCampaignVolume(req.orgId, days);
    const templates = await repo.getTopTemplates(req.orgId, 8);
    const campaigns = await repo.getCampaignPerformance(req.orgId, 8);
    
    res.json({ stats, funnel, dailyMessages, dailyCampaigns, templates, campaigns });
  } catch (err) {
    console.error('[analytics:all]', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getOverview, getFunnel, getDailyMessages, getDailyCampaigns, getTopTemplates, getCampaignPerformance, getAll };
