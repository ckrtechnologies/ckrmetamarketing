/**
 * adsController.js
 * Meta Ads Manager — all CRUD, insights, and Click-to-WhatsApp
 */

const adsRepo     = require('../repositories/adsRepo');
const orgRepo     = require('../repositories/orgRepo');
const metaAds     = require('../utils/metaAdsClient');

// ── Helper ─────────────────────────────────────────────────────

function budgetToPaise(amount) {
  // Meta stores budgets in smallest currency unit (paise for INR)
  return Math.round(parseFloat(amount) * 100);
}

// ── Ad Accounts ────────────────────────────────────────────────

async function listAdAccounts(req, res) {
  try {
    const accounts = await adsRepo.getAdAccounts(req.orgId);
    res.json({ accounts });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function connectAdAccount(req, res) {
  try {
    const { access_token, act_id: providedActId } = req.body;
    if (!access_token) return res.status(400).json({ error: 'access_token is required' });

    // If no act_id provided, fetch the first available from Meta
    let act_id = providedActId;
    let name = req.body.name;
    let currency = req.body.currency || 'INR';
    let timezone = req.body.timezone || 'Asia/Kolkata';

    if (!act_id) {
      const accounts = await metaAds.getAdAccounts(access_token);
      if (!accounts.length) return res.status(404).json({ error: 'No Ad Accounts found for this token. Ensure ads_management permission is granted.' });
      const first = accounts[0];
      act_id   = first.id;
      name     = first.name;
      currency = first.currency || 'INR';
      timezone = first.timezone_name || 'Asia/Kolkata';
    } else {
      // Verify token + account is accessible
      try {
        const info = await metaAds.getAdAccount(access_token, act_id);
        name     = info.name || name;
        currency = info.currency || currency;
        timezone = info.timezone_name || timezone;
      } catch (e) {
        return res.status(400).json({ error: 'Could not verify ad account: ' + e.message });
      }
    }

    const account = await adsRepo.createAdAccount(req.orgId, { act_id, name, currency, timezone, access_token });
    res.status(201).json({ account });
  } catch (err) {
    console.error('[adsController:connect]', err.message);
    res.status(500).json({ error: err.message });
  }
}

async function setActiveAdAccount(req, res) {
  try {
    const account = await adsRepo.setActiveAdAccount(req.orgId, req.params.id);
    res.json({ success: true, account });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateAdAccount(req, res) {
  try {
    const account = await adsRepo.updateAdAccount(req.orgId, req.params.id, req.body);
    res.json({ account });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function disconnectAdAccount(req, res) {
  try {
    await adsRepo.deleteAdAccount(req.orgId, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function listMetaAdAccounts(req, res) {
  try {
    const { access_token } = req.query;
    if (!access_token) return res.status(400).json({ error: 'access_token required' });
    const accounts = await metaAds.getAdAccounts(access_token);
    res.json({ accounts });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

// ── Facebook Pages ─────────────────────────────────────────────

async function listPages(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });
    const pages = await metaAds.listPages(account.access_token);
    res.json({ pages });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

// ── Campaigns ─────────────────────────────────────────────────

async function listCampaigns(req, res) {
  try {
    const account = req.query.account_id
      ? await adsRepo.getAdAccount(req.orgId, req.query.account_id)
      : await adsRepo.getActiveAdAccount(req.orgId);

    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    // Fetch live from Meta
    const metaCampaigns = await metaAds.listCampaigns(account.access_token, account.act_id);

    // Sync to Supabase in background
    for (const c of metaCampaigns) {
      await adsRepo.upsertAdCampaign(req.orgId, {
        ad_account_id:    account.id,
        meta_campaign_id: c.id,
        name:             c.name,
        objective:        c.objective,
        status:           c.status,
        daily_budget:     c.daily_budget ? parseInt(c.daily_budget) : null,
        lifetime_budget:  c.lifetime_budget ? parseInt(c.lifetime_budget) : null,
        start_time:       c.start_time || null,
        end_time:         c.stop_time || null,
      }).catch(() => {});
    }

    res.json({ campaigns: metaCampaigns, account });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    console.error('[listCampaigns]', detail);
    res.status(400).json({ error: detail });
  }
}

async function createCampaign(req, res) {
  try {
    const {
      account_id,
      name,
      objective = 'OUTCOME_ENGAGEMENT',   // Click-to-WhatsApp default
      status = 'PAUSED',
      daily_budget,
      lifetime_budget,
      special_ad_categories = [],
    } = req.body;

    const account = account_id
      ? await adsRepo.getAdAccount(req.orgId, account_id)
      : await adsRepo.getActiveAdAccount(req.orgId);

    if (!account) return res.status(404).json({ error: 'No connected Ad Account. Please connect one first.' });

    const result = await metaAds.createCampaign(account.access_token, account.act_id, {
      name,
      objective,
      status,
      daily_budget:    daily_budget    ? budgetToPaise(daily_budget)    : undefined,
      lifetime_budget: lifetime_budget ? budgetToPaise(lifetime_budget) : undefined,
      special_ad_categories,
    });

    // Sync to Supabase
    const campaign = await adsRepo.upsertAdCampaign(req.orgId, {
      ad_account_id:    account.id,
      meta_campaign_id: result.id,
      name,
      objective,
      status,
      daily_budget:    daily_budget    ? budgetToPaise(daily_budget)    : null,
      lifetime_budget: lifetime_budget ? budgetToPaise(lifetime_budget) : null,
    });

    res.status(201).json({ campaign, meta_id: result.id });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    console.error('[createCampaign]', detail, err.response?.data);
    res.status(400).json({ error: detail });
  }
}

async function updateCampaign(req, res) {
  try {
    const { meta_campaign_id, status, name, daily_budget, lifetime_budget } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (name)   updates.name = name;
    if (daily_budget) updates.daily_budget = budgetToPaise(daily_budget);
    if (lifetime_budget) updates.lifetime_budget = budgetToPaise(lifetime_budget);

    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    const campaignId = meta_campaign_id || req.params.id;
    await metaAds.updateCampaign(account.access_token, campaignId, updates);
    if (status) await adsRepo.updateAdCampaignStatus(campaignId, status);

    res.json({ success: true, campaign_id: campaignId, updates });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

async function deleteCampaign(req, res) {
  try {
    const campaignId = req.params.id;
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    await metaAds.deleteCampaign(account.access_token, campaignId);
    await adsRepo.deleteAdCampaign(req.orgId, campaignId);
    res.json({ success: true });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

// ── Ad Sets ────────────────────────────────────────────────────

async function listAdSets(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });
    const adsets = await metaAds.listAdSets(account.access_token, account.act_id, req.query.campaign_id);
    res.json({ adsets });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

async function createAdSet(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    // Get connected WhatsApp number for Click-to-WhatsApp
    const wabaAccounts = await orgRepo.getWabaAccounts(req.orgId);
    const defaultWaPhone = wabaAccounts[0]?.display_number || req.body.whatsapp_phone_number;

    const result = await metaAds.createAdSet(account.access_token, account.act_id, {
      ...req.body,
      whatsapp_phone_number: req.body.whatsapp_phone_number || defaultWaPhone,
    });
    res.status(201).json({ adset: result });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    console.error('[createAdSet]', detail, err.response?.data);
    res.status(400).json({ error: detail });
  }
}

async function updateAdSet(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    const updates = {};
    if (req.body.name) updates.name = req.body.name.trim();
    if (req.body.status) updates.status = req.body.status;
    if (req.body.daily_budget !== undefined && req.body.daily_budget !== '') {
      updates.daily_budget = Math.round(parseFloat(req.body.daily_budget) * 100);
    }
    if (req.body.optimization_goal) updates.optimization_goal = req.body.optimization_goal;
    if (req.body.start_time) updates.start_time = req.body.start_time;
    if (req.body.end_time) updates.end_time = req.body.end_time;

    // Full Targeting updates
    if (req.body.targeting) {
      const t = req.body.targeting;
      updates.targeting = {
        geo_locations: t.geo_locations || (t.countries ? { countries: t.countries } : { countries: ['IN'] }),
        age_min: parseInt(t.age_min) || 18,
        age_max: parseInt(t.age_max) || 65,
        genders: t.genders || [0],
        ...(t.device_platforms?.length ? { device_platforms: t.device_platforms } : {}),
        ...(t.publisher_platforms?.length ? { publisher_platforms: t.publisher_platforms } : {}),
        ...(t.flexible_spec?.length ? { flexible_spec: t.flexible_spec } : t.interests?.length ? {
          flexible_spec: [{ interests: t.interests.map(i => ({ id: i.id, name: i.name })) }],
        } : {}),
      };
    }

    const result = await metaAds.updateAdSet(account.access_token, req.params.id, updates);
    res.json({ success: true, adset_id: req.params.id, updates, result });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    console.error('[updateAdSet]', detail, err.response?.data);
    res.status(400).json({ error: detail });
  }
}

async function deleteAdSet(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    await metaAds.deleteAdSet(account.access_token, req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

// ── Ads ───────────────────────────────────────────────────────

async function listAds(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });
    const ads = await metaAds.listAds(account.access_token, account.act_id, req.query.campaign_id);
    res.json({ ads });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

async function updateAd(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    const updates = {};
    if (req.body.name) updates.name = req.body.name.trim();
    if (req.body.status) updates.status = req.body.status;

    // If creative content (headline, body, description, CTA, image) is updated, create new creative
    if (req.body.headline !== undefined || req.body.body !== undefined || req.body.image_base64 || req.body.whatsapp_number) {
      let imageHash = req.body.image_hash;
      if (req.body.image_base64) {
        const uploadRes = await metaAds.uploadImage(account.access_token, account.act_id, req.body.image_base64);
        if (uploadRes?.hash) imageHash = uploadRes.hash;
      }

      const page_id = req.body.page_id || req.body.current_page_id;
      const cleanPhone = req.body.whatsapp_number ? String(req.body.whatsapp_number).replace(/\D/g, '') : '';
      const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

      const newCreative = await metaAds.createCreative(account.access_token, account.act_id, {
        name: `${req.body.name || 'Ad'} — Creative (${Date.now()})`,
        page_id: page_id || '461194823752748',
        headline: req.body.headline || '',
        body: req.body.body || '',
        description: req.body.description || '',
        image_hash: imageHash,
        call_to_action_type: req.body.call_to_action_type || 'WHATSAPP_MESSAGE',
        whatsapp_number: formattedPhone,
      });

      updates.creative = { creative_id: newCreative.id };
    }

    const result = await metaAds.updateAd(account.access_token, req.params.id, updates);
    res.json({ success: true, ad_id: req.params.id, updates, result });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    console.error('[updateAd]', detail, err.response?.data);
    res.status(400).json({ error: detail });
  }
}

async function deleteAd(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    await metaAds.deleteAd(account.access_token, req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}


// ── Insights ──────────────────────────────────────────────────

async function getCampaignInsights(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    const campaignId = req.params.id;
    const { date_preset = 'last_30d' } = req.query;

    const [dailyData, totalData] = await Promise.all([
      metaAds.getCampaignInsights(account.access_token, campaignId, { date_preset, time_increment: 1 }),
      metaAds.getCampaignInsights(account.access_token, campaignId, { date_preset }),
    ]);

    // Cache daily data in Supabase
    adsRepo.saveInsights(req.orgId, campaignId, 'campaign', dailyData).catch(() => {});

    res.json({ insights: dailyData, totals: totalData[0] || {}, campaign_id: campaignId });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

async function getAccountBalance(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    const balanceInfo = await metaAds.getAdAccount(account.access_token, account.act_id);
    res.json({ success: true, balance_info: balanceInfo });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

async function getAccountInsights(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account. Please connect one from WA Numbers → Ads Accounts.' });

    const { date_preset = 'last_30d' } = req.query;
    const [insights, balanceInfo] = await Promise.all([
      metaAds.getAccountInsights(account.access_token, account.act_id, { date_preset, time_increment: 1 }),
      metaAds.getAdAccount(account.access_token, account.act_id).catch(() => null),
    ]);

    // Aggregate totals
    const totals = insights.reduce((acc, row) => ({
      impressions: acc.impressions + parseInt(row.impressions || 0),
      clicks:      acc.clicks      + parseInt(row.clicks || 0),
      spend:       acc.spend       + parseFloat(row.spend || 0),
      reach:       acc.reach       + parseInt(row.reach || 0),
    }), { impressions: 0, clicks: 0, spend: 0, reach: 0 });

    totals.ctr = totals.impressions ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : '0.00';
    totals.cpc = totals.clicks      ? (totals.spend / totals.clicks).toFixed(2)               : '0.00';
    totals.cpm = totals.impressions ? ((totals.spend / totals.impressions) * 1000).toFixed(2) : '0.00';

    res.json({
      insights,
      totals,
      balance_info: balanceInfo,
      account: { id: account.id, name: account.name, currency: account.currency, act_id: account.act_id }
    });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    console.error('[getAccountInsights]', detail);
    res.status(400).json({ error: detail });
  }
}

// ── Audiences ─────────────────────────────────────────────────

async function listAudiences(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });
    
    const [custom, saved] = await Promise.all([
      metaAds.listCustomAudiences(account.access_token, account.act_id),
      metaAds.listSavedAudiences(account.access_token, account.act_id),
    ]);

    res.json({
      audiences: custom,
      custom_audiences: custom.filter(a => a.subtype !== 'LOOKALIKE'),
      lookalike_audiences: custom.filter(a => a.subtype === 'LOOKALIKE'),
      saved_audiences: saved,
    });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

async function createCustomAudience(req, res) {
  try {
    const { name, description, sync_from_crm } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    const result = await metaAds.createCustomAudience(account.access_token, account.act_id, {
      name,
      description,
    });

    // If user wants to sync CRM contacts into this audience immediately
    if (sync_from_crm && result.id) {
      const contactRepo = require('../repositories/contactRepo');
      const { contacts } = await contactRepo.getContacts(req.orgId, { limit: 10000 });
      const phones = (contacts || []).map(c => c.phone).filter(Boolean);
      if (phones.length > 0) {
        await metaAds.uploadUsersToAudience(account.access_token, result.id, phones).catch(() => {});
      }
    }

    res.status(201).json({ audience: result });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

async function createLookalikeAudience(req, res) {
  try {
    const { name, origin_audience_id, country = 'IN', ratio = 0.01 } = req.body;
    if (!name || !origin_audience_id) {
      return res.status(400).json({ error: 'name and origin_audience_id are required' });
    }

    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    const result = await metaAds.createLookalikeAudience(account.access_token, account.act_id, {
      name,
      origin_audience_id,
      country,
      ratio: parseFloat(ratio),
    });

    res.status(201).json({ audience: result });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

async function createSavedAudience(req, res) {
  try {
    const { name, description, countries = ['IN'], age_min = 18, age_max = 65, genders = [0], interests = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    const targeting = {
      geo_locations: { countries },
      age_min: parseInt(age_min),
      age_max: parseInt(age_max),
      genders,
      publisher_platforms: ['facebook', 'instagram'],
    };

    if (interests && interests.length > 0) {
      targeting.flexible_spec = [{
        interests: interests.map(i => ({ id: i.id, name: i.name })),
      }];
    }

    const result = await metaAds.createSavedAudience(account.access_token, account.act_id, {
      name,
      description,
      targeting,
    });

    res.status(201).json({ audience: result });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

async function deleteAudience(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    await metaAds.deleteAudience(account.access_token, req.params.id);
    res.json({ success: true });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}

async function searchInterests(req, res) {
  try {
    const account = await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });
    const interests = await metaAds.searchInterests(account.access_token, req.query.q || '');
    res.json({ interests });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    res.status(400).json({ error: detail });
  }
}


// ── Full Campaign Publish (Campaign + Ad Set + Creative + Ad) ──

async function publishCampaign(req, res) {
  try {
    const {
      account_id,
      // Campaign
      campaign_name,
      objective = 'OUTCOME_ENGAGEMENT',
      daily_budget,
      lifetime_budget,
      // Ad Set
      adset_name,
      targeting = {},
      start_time,
      end_time,
      // Creative
      page_id,
      headline,
      body,
      description,
      image_base64,
      call_to_action_type = 'WHATSAPP_MESSAGE',
      link_url,
      // General
      status = 'PAUSED',
    } = req.body;

    if (!campaign_name || !page_id) {
      return res.status(400).json({ error: 'campaign_name and page_id are required' });
    }

    const account = account_id
      ? await adsRepo.getAdAccount(req.orgId, account_id)
      : await adsRepo.getActiveAdAccount(req.orgId);
    if (!account) return res.status(404).json({ error: 'No connected Ad Account' });

    const wabaAccounts = await orgRepo.getWabaAccounts(req.orgId);
    let whatsappNumber = req.body.whatsapp_number || wabaAccounts[0]?.display_number || '';
    whatsappNumber = String(whatsappNumber).replace(/\D/g, '');
    if (whatsappNumber.length === 10) {
      whatsappNumber = '91' + whatsappNumber;
    }


    // Step 1: Create Campaign shell
    const campaignResult = await metaAds.createCampaign(account.access_token, account.act_id, {
      name: campaign_name,
      objective,
      status,
      special_ad_categories: [],
    });


    // Step 2: Upload image (user provided or default banner)
    let image_hash = null;
    let finalImageBase64 = image_base64;
    if (!finalImageBase64) {
      const fs = require('fs');
      const path = require('path');
      const bannerPath = path.join(__dirname, '../utils/defaultBanner.png');
      if (fs.existsSync(bannerPath)) {
        finalImageBase64 = fs.readFileSync(bannerPath).toString('base64');
      }
    }

    if (finalImageBase64) {
      const imgResult = await metaAds.uploadImage(account.access_token, account.act_id, finalImageBase64);
      image_hash = imgResult?.hash;
    }


    // Step 3: Create Creative
    const creativeResult = await metaAds.createCreative(account.access_token, account.act_id, {
      name:                 `${campaign_name} — Creative`,
      page_id,
      headline,
      body,
      description,
      image_hash,
      call_to_action_type,
      whatsapp_number:      whatsappNumber,
      link_url,
    });

    // Step 4: Create Ad Set
    const adsetResult = await metaAds.createAdSet(account.access_token, account.act_id, {
      name:                  adset_name || `${campaign_name} — Ad Set`,
      campaign_id:           campaignResult.id,
      daily_budget:          daily_budget    ? budgetToPaise(daily_budget)    : undefined,
      lifetime_budget:       lifetime_budget ? budgetToPaise(lifetime_budget) : undefined,
      optimization_goal:     'CONVERSATIONS',
      destination_type:      'WHATSAPP',
      targeting,
      start_time,
      end_time,
      status,
      page_id,
      whatsapp_phone_number: whatsappNumber,
    });

    // Step 5: Create Ad
    const adResult = await metaAds.createAd(account.access_token, account.act_id, {
      name:        `${campaign_name} — Ad`,
      adset_id:    adsetResult.id,
      creative_id: creativeResult.id,
      status,
    });

    // Save campaign to Supabase
    await adsRepo.upsertAdCampaign(req.orgId, {
      ad_account_id:    account.id,
      meta_campaign_id: campaignResult.id,
      name:             campaign_name,
      objective,
      status,
      daily_budget:    daily_budget    ? budgetToPaise(daily_budget)    : null,
      lifetime_budget: lifetime_budget ? budgetToPaise(lifetime_budget) : null,
      start_time:      start_time || null,
      end_time:        end_time   || null,
    });

    res.status(201).json({
      success: true,
      campaign_id:  campaignResult.id,
      adset_id:     adsetResult.id,
      creative_id:  creativeResult.id,
      ad_id:        adResult.id,
      status,
    });
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    console.error('[publishCampaign]', detail, err.response?.data);
    res.status(400).json({ error: detail });
  }
}

module.exports = {
  listAdAccounts, connectAdAccount, setActiveAdAccount, updateAdAccount, disconnectAdAccount, listMetaAdAccounts,
  listPages,
  listCampaigns, createCampaign, updateCampaign, deleteCampaign, publishCampaign,
  listAdSets, createAdSet, updateAdSet, deleteAdSet,
  listAds, updateAd, deleteAd,
  getCampaignInsights, getAccountInsights, getAccountBalance,
  listAudiences, createCustomAudience, createLookalikeAudience, createSavedAudience, deleteAudience, searchInterests,
};

