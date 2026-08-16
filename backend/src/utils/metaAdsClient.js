/**
 * metaAdsClient.js
 * Facebook Marketing API v20.0 wrapper
 * Focused on Click-to-WhatsApp campaigns
 */

const axios = require('axios');

const BASE = 'https://graph.facebook.com/v20.0';

function client(accessToken) {
  return axios.create({
    baseURL: BASE,
    params: { access_token: accessToken },
    timeout: 15000,
  });
}

// ── Ad Accounts ────────────────────────────────────────────────

async function getAdAccounts(accessToken) {
  const r = await client(accessToken).get('/me/adaccounts', {
    params: {
      access_token: accessToken,
      fields: 'id,name,currency,timezone_name,account_status,spend_cap,balance',
    },
  });
  return r.data?.data || [];
}

async function getAdAccount(accessToken, actId) {
  const r = await client(accessToken).get(`/${actId}`, {
    params: {
      access_token: accessToken,
      fields: 'id,name,currency,timezone_name,account_status,spend_cap,amount_spent',
    },
  });
  return r.data;
}

// ── Campaigns ─────────────────────────────────────────────────

async function listCampaigns(accessToken, actId) {
  const r = await client(accessToken).get(`/${actId}/campaigns`, {
    params: {
      access_token: accessToken,
      fields: 'id,name,objective,status,daily_budget,lifetime_budget,budget_remaining,start_time,stop_time,created_time,updated_time,adsets{id,name,daily_budget,lifetime_budget,status}',
      limit: 100,
    },
  });
  const list = r.data?.data || [];

  // If campaign-level budget is empty, derive from active adsets
  return list.map(c => {
    let daily_budget = c.daily_budget ? parseInt(c.daily_budget) : null;
    let lifetime_budget = c.lifetime_budget ? parseInt(c.lifetime_budget) : null;

    if (!daily_budget && !lifetime_budget && c.adsets?.data?.length) {
      // 1. Only sum ACTIVE adsets that are currently live / scheduled to run
      const activeAdsets = c.adsets.data.filter(a => a.status === 'ACTIVE');
      
      // 2. If all adsets are paused (e.g. paused campaign), take non-deleted adsets or the latest adset
      const targetAdsets = activeAdsets.length > 0
        ? activeAdsets
        : c.adsets.data.filter(a => a.status !== 'DELETED' && a.status !== 'ARCHIVED');

      const adsetDaily = targetAdsets.reduce((sum, a) => sum + (parseInt(a.daily_budget) || 0), 0);
      const adsetLifetime = targetAdsets.reduce((sum, a) => sum + (parseInt(a.lifetime_budget) || 0), 0);
      if (adsetDaily > 0) daily_budget = adsetDaily;
      if (adsetLifetime > 0) lifetime_budget = adsetLifetime;
    }

    return {
      ...c,
      daily_budget,
      lifetime_budget,
      effective_budget: daily_budget || lifetime_budget || 0,
      budget_type: daily_budget ? 'daily' : lifetime_budget ? 'lifetime' : 'none',
    };
  });
}

async function createCampaign(accessToken, actId, { name, objective, status = 'PAUSED', daily_budget, lifetime_budget, special_ad_categories = [] }) {
  const payload = {
    name,
    objective,           // OUTCOME_ENGAGEMENT for Click-to-WhatsApp
    status,
    special_ad_categories,
  };

  if (daily_budget) {
    payload.daily_budget = daily_budget;
  } else if (lifetime_budget) {
    payload.lifetime_budget = lifetime_budget;
  } else {
    payload.is_adset_budget_sharing_enabled = false;
  }

  const r = await client(accessToken).post(`/${actId}/campaigns`, payload);
  return r.data; // { id: '...' }
}

async function updateCampaign(accessToken, campaignId, updates) {
  const r = await client(accessToken).post(`/${campaignId}`, updates);
  return r.data;
}

async function deleteCampaign(accessToken, campaignId) {
  const r = await client(accessToken).delete(`/${campaignId}`);
  return r.data;
}

// ── Ad Sets ───────────────────────────────────────────────────

async function listAdSets(accessToken, actId, campaignId) {
  const params = {
    access_token: accessToken,
    fields: 'id,name,status,targeting,daily_budget,start_time,end_time,campaign_id,destination_type',
    limit: 50,
  };
  if (campaignId) params.campaign_id = campaignId;

  const r = await client(accessToken).get(`/${actId}/adsets`, { params });
  return r.data?.data || [];
}

/**
 * Create an Ad Set for Click-to-WhatsApp
 * destination_type: WHATSAPP
 */
async function createAdSet(accessToken, actId, {
  name,
  campaign_id,
  daily_budget,
  lifetime_budget,
  billing_event = 'IMPRESSIONS',
  optimization_goal = 'CONVERSATIONS',
  destination_type = 'WHATSAPP',
  targeting = {},
  start_time,
  end_time,
  status = 'PAUSED',
  page_id,
}) {
  const payload = {
    name,
    campaign_id,
    billing_event,
    optimization_goal,
    destination_type,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: {
      geo_locations: targeting.geo_locations || { countries: ['IN'] },
      age_min: targeting.age_min || 18,
      age_max: targeting.age_max || 65,
      genders: targeting.genders || [0],   // 0=all, 1=male, 2=female
      publisher_platforms: ['facebook', 'instagram'],
      ...(targeting.interests?.length ? {
        flexible_spec: [{ interests: targeting.interests.map(i => ({ id: i.id, name: i.name })) }],
      } : {}),
    },
    promoted_object: {
      page_id: String(page_id),
    },
    status,
  };

  if (daily_budget) payload.daily_budget = daily_budget;
  if (lifetime_budget) payload.lifetime_budget = lifetime_budget;
  if (start_time) payload.start_time = start_time;
  if (end_time) payload.end_time = end_time;

  const r = await client(accessToken).post(`/${actId}/adsets`, payload);
  return r.data;
}

// ── Ad Creatives ──────────────────────────────────────────────

async function listCreatives(accessToken, actId) {
  const r = await client(accessToken).get(`/${actId}/adcreatives`, {
    params: {
      access_token: accessToken,
      fields: 'id,name,title,body,image_url,thumbnail_url,status',
      limit: 50,
    },
  });
  return r.data?.data || [];
}

/**
 * Create a Click-to-WhatsApp Ad Creative
 */
async function createCreative(accessToken, actId, {
  name,
  page_id,
  headline,
  body,
  description,
  image_hash,
  video_id,
  call_to_action_type = 'WHATSAPP_MESSAGE',
  whatsapp_number,
  link_url,
}) {
  const cleanPhone = whatsapp_number ? String(whatsapp_number).replace(/\D/g, '') : '';
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  const objectStorySpec = {
    page_id,
    link_data: {
      ...(image_hash ? { image_hash } : {}),
      message: body,
      name: headline,
      description: description || '',
      call_to_action: {
        type: call_to_action_type,
        value: {
          ...(formattedPhone ? { whatsapp_number: formattedPhone } : {}),
          app_destination: 'WHATSAPP',
        },
      },
      link: link_url || (formattedPhone ? `https://wa.me/${formattedPhone}` : `https://facebook.com/${page_id}`),
    },
  };

  if (video_id) {
    delete objectStorySpec.link_data.image_hash;
    objectStorySpec.video_data = {
      video_id,
      message: body,
      call_to_action: {
        type: call_to_action_type,
        value: {
          ...(formattedPhone ? { whatsapp_number: formattedPhone } : {}),
          app_destination: 'WHATSAPP',
        },
      },
    };
  }

  const r = await client(accessToken).post(`/${actId}/adcreatives`, {
    name,
    object_story_spec: objectStorySpec,
  });
  return r.data;
}

// ── Ads ───────────────────────────────────────────────────────

async function listAds(accessToken, actId, campaignId) {
  const params = {
    access_token: accessToken,
    fields: 'id,name,status,creative{id,name,thumbnail_url},adset_id,campaign_id,created_time',
    limit: 100,
  };
  if (campaignId) params.campaign_id = campaignId;

  const r = await client(accessToken).get(`/${actId}/ads`, { params });
  return r.data?.data || [];
}

async function createAd(accessToken, actId, { name, adset_id, creative_id, status = 'PAUSED' }) {
  const r = await client(accessToken).post(`/${actId}/ads`, {
    name,
    adset_id,
    creative: { creative_id },
    status,
  });
  return r.data;
}

async function updateAd(accessToken, adId, updates) {
  const r = await client(accessToken).post(`/${adId}`, updates);
  return r.data;
}

async function deleteAd(accessToken, adId) {
  const r = await client(accessToken).delete(`/${adId}`);
  return r.data;
}

// ── Insights ──────────────────────────────────────────────────

async function getCampaignInsights(accessToken, campaignId, { date_preset = 'last_30d', time_increment } = {}) {
  const params = {
    access_token: accessToken,
    fields: 'impressions,clicks,spend,reach,ctr,cpc,cpm,actions,action_values,frequency,date_start,date_stop',
    date_preset,
  };
  if (time_increment) params.time_increment = time_increment; // 1 for daily

  const r = await client(accessToken).get(`/${campaignId}/insights`, { params });
  return r.data?.data || [];
}

async function getAccountInsights(accessToken, actId, { date_preset = 'last_30d', time_increment = 1 } = {}) {
  const r = await client(accessToken).get(`/${actId}/insights`, {
    params: {
      access_token: accessToken,
      fields: 'impressions,clicks,spend,reach,ctr,cpc,cpm,actions,date_start,date_stop',
      date_preset,
      time_increment,
      level: 'campaign',
      limit: 100,
    },
  });
  return r.data?.data || [];
}

// ── Audiences ─────────────────────────────────────────────────

async function listCustomAudiences(accessToken, actId) {
  const r = await client(accessToken).get(`/${actId}/customaudiences`, {
    params: {
      access_token: accessToken,
      fields: 'id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,description,lookalike_spec,delivery_status,operation_status,time_created',
      limit: 100,
    },
  });
  return r.data?.data || [];
}

async function listSavedAudiences(accessToken, actId) {
  try {
    const r = await client(accessToken).get(`/${actId}/saved_audiences`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,targeting,approximate_count_lower_bound,approximate_count_upper_bound,description,time_created',
        limit: 100,
      },
    });
    return r.data?.data || [];
  } catch (err) {
    return [];
  }
}

async function createCustomAudience(accessToken, actId, { name, description, customer_file_source = 'USER_PROVIDED_ONLY_HASHED_DATA' }) {
  const r = await client(accessToken).post(`/${actId}/customaudiences`, {
    name,
    description: description || '',
    subtype: 'CUSTOM',
    customer_file_source,
  });
  return r.data;
}

async function uploadUsersToAudience(accessToken, audienceId, hashedPhones = []) {
  if (!hashedPhones.length) return { num_received: 0 };
  const crypto = require('crypto');
  const hashed = hashedPhones.map(p => crypto.createHash('sha256').update(String(p).trim()).digest('hex'));
  
  const payload = {
    schema: ['PHONE_SHA256'],
    data: hashed.map(h => [h]),
  };

  const r = await client(accessToken).post(`/${audienceId}/users`, {
    payload: JSON.stringify(payload),
  });
  return r.data;
}

async function createLookalikeAudience(accessToken, actId, { name, origin_audience_id, country = 'IN', ratio = 0.01 }) {
  const r = await client(accessToken).post(`/${actId}/customaudiences`, {
    name,
    subtype: 'LOOKALIKE',
    origin_audience_id,
    lookalike_spec: JSON.stringify({
      type: 'similarity',
      country,
      ratio,
    }),
  });
  return r.data;
}

async function createSavedAudience(accessToken, actId, { name, description, targeting }) {
  const r = await client(accessToken).post(`/${actId}/saved_audiences`, {
    name,
    description: description || '',
    targeting,
  });
  return r.data;
}

async function deleteAudience(accessToken, audienceId) {
  const r = await client(accessToken).delete(`/${audienceId}`);
  return r.data;
}

// ── Interests Search ──────────────────────────────────────────

async function searchInterests(accessToken, query) {
  if (!query) return [];
  const r = await client(accessToken).get('/search', {
    params: {
      access_token: accessToken,
      type: 'adinterest',
      q: query,
      limit: 25,
    },
  });
  return r.data?.data || [];
}

// ── Facebook Pages ────────────────────────────────────────────

async function listPages(accessToken) {
  const r = await client(accessToken).get('/me/accounts', {
    params: {
      access_token: accessToken,
      fields: 'id,name,category,picture,phone,whatsapp_number',
    },
  });
  return r.data?.data || [];
}

// ── Image Upload ──────────────────────────────────────────────

async function uploadImage(accessToken, actId, imageBase64) {
  const cleanBase64 = String(imageBase64).replace(/^data:image\/\w+;base64,/, '');
  const FormData = require('form-data');
  const form = new FormData();
  form.append('bytes', cleanBase64);
  form.append('access_token', accessToken);

  const r = await client(accessToken).post(`/${actId}/adimages`, form, {
    headers: form.getHeaders(),
  });
  const images = r.data?.images;
  const firstKey = images ? Object.keys(images)[0] : null;
  return firstKey ? images[firstKey] : null; // { hash, url }
}

module.exports = {
  getAdAccounts, getAdAccount,
  listCampaigns, createCampaign, updateCampaign, deleteCampaign,
  listAdSets, createAdSet,
  listCreatives, createCreative,
  listAds, createAd, updateAd, deleteAd,
  getCampaignInsights, getAccountInsights,
  listCustomAudiences, listSavedAudiences,
  createCustomAudience, uploadUsersToAudience, createLookalikeAudience, createSavedAudience, deleteAudience,
  searchInterests,
  listPages, uploadImage,
};

