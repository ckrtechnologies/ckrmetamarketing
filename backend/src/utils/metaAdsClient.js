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
      fields: 'id,name,currency,timezone_name,account_status,spend_cap,amount_spent,balance,funding_source_details,min_daily_budget,account_id',
    },
  });
  const data = r.data || {};
  const spendCap = parseInt(data.spend_cap) || 0;
  const amountSpent = parseInt(data.amount_spent) || 0;
  const spendCapRemaining = spendCap > 0 ? Math.max(0, spendCap - amountSpent) : null;
  const fundingDisplay = data.funding_source_details?.display_string || '';

  // Extract numerical available balance if present in display_string (e.g. "Available balance (₹2,285.86 INR)")
  const balMatch = fundingDisplay.match(/[\d,]+\.?\d*/);
  const availableBalStr = balMatch ? balMatch[0] : null;

  return {
    ...data,
    spend_cap_num: spendCap ? spendCap / 100 : null,
    amount_spent_num: amountSpent ? amountSpent / 100 : 0,
    spend_cap_remaining: spendCapRemaining,
    spend_cap_remaining_num: spendCapRemaining !== null ? spendCapRemaining / 100 : null,
    funding_source_display: fundingDisplay,
    available_balance_str: availableBalStr,
    balance_num: (parseInt(data.balance) || 0) / 100,
  };
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

function formatMetaTargeting(targeting = {}) {
  const geo = targeting.geo_locations || {};
  const formattedGeo = {};

  if (geo.location_types && geo.location_types.length > 0) {
    formattedGeo.location_types = geo.location_types;
  }

  // Meta Graph API Rule:
  // If cities or regions are targeted, do NOT include countries (otherwise it throws 1487479 "City targeting isn't supported in the country you selected")
  const validCities = Array.isArray(geo.cities)
    ? geo.cities.filter(c => c && (c.key || c.id)).map(c => ({
        key: String(c.key || c.id),
        radius: Number(c.radius) || 25,
        distance_unit: c.distance_unit || 'kilometer',
      }))
    : [];

  const validRegions = Array.isArray(geo.regions)
    ? geo.regions.filter(r => r && (r.key || r.id)).map(r => ({
        key: String(r.key || r.id),
      }))
    : [];

  if (validCities.length > 0) {
    formattedGeo.cities = validCities;
    if (validRegions.length > 0) formattedGeo.regions = validRegions;
  } else if (validRegions.length > 0) {
    formattedGeo.regions = validRegions;
  } else {
    formattedGeo.countries = (geo.countries && geo.countries.length > 0)
      ? geo.countries
      : (targeting.countries && targeting.countries.length > 0)
        ? targeting.countries
        : ['IN'];
  }

  const result = {
    geo_locations: formattedGeo,
    age_min: parseInt(targeting.age_min) || 18,
    age_max: parseInt(targeting.age_max) || 65,
    genders: targeting.genders || [0],
  };

  if (targeting.publisher_platforms?.length) {
    result.publisher_platforms = targeting.publisher_platforms;
  } else {
    result.publisher_platforms = ['facebook', 'instagram'];
  }

  if (targeting.device_platforms?.length) {
    result.device_platforms = targeting.device_platforms;
  }

  if (targeting.locales?.length) {
    result.locales = targeting.locales;
  }

  // Clean flexible_spec to prevent invalid empty arrays/structures
  if (Array.isArray(targeting.flexible_spec) && targeting.flexible_spec.length > 0) {
    const cleanedFlexible = [];
    for (const group of targeting.flexible_spec) {
      if (!group || typeof group !== 'object') continue;
      const cleanGroup = {};
      for (const [key, items] of Object.entries(group)) {
        if (Array.isArray(items) && items.length > 0) {
          const validItems = items
            .filter(item => item && (item.id || typeof item === 'string'))
            .map(item => typeof item === 'string' ? { id: item } : { id: String(item.id), name: item.name });
          if (validItems.length > 0) {
            cleanGroup[key] = validItems;
          }
        }
      }
      if (Object.keys(cleanGroup).length > 0) {
        cleanedFlexible.push(cleanGroup);
      }
    }
    if (cleanedFlexible.length > 0) {
      result.flexible_spec = cleanedFlexible;
    }
  } else if (targeting.interests && targeting.interests.length > 0) {
    const validInterests = targeting.interests
      .filter(i => i && (i.id || typeof i === 'string'))
      .map(i => typeof i === 'string' ? { id: i } : { id: String(i.id), name: i.name });
    if (validInterests.length > 0) {
      result.flexible_spec = [{ interests: validInterests }];
    }
  }

  // Clean exclusions
  if (targeting.exclusions && typeof targeting.exclusions === 'object') {
    const cleanExclusions = {};
    for (const [key, items] of Object.entries(targeting.exclusions)) {
      if (Array.isArray(items) && items.length > 0) {
        const validItems = items
          .filter(item => item && (item.id || typeof item === 'string'))
          .map(item => typeof item === 'string' ? { id: item } : { id: String(item.id), name: item.name });
        if (validItems.length > 0) {
          cleanExclusions[key] = validItems;
        }
      }
    }
    if (Object.keys(cleanExclusions).length > 0) {
      result.exclusions = cleanExclusions;
    }
  }

  if (targeting.custom_audiences && targeting.custom_audiences.length > 0) {
    result.custom_audiences = targeting.custom_audiences;
  }

  if (targeting.excluded_custom_audiences && targeting.excluded_custom_audiences.length > 0) {
    result.excluded_custom_audiences = targeting.excluded_custom_audiences;
  }

  // Meta Graph API v19+ requires targeting_automation.advantage_audience to be 0 or 1
  result.targeting_automation = {
    advantage_audience: (targeting.targeting_automation?.advantage_audience === 1 || targeting.targeting_automation?.detailed_targeting_expansion === 1) ? 1 : 0,
  };

  return result;
}

async function listAdSets(accessToken, actId, campaignId) {
  const params = {
    access_token: accessToken,
    fields: 'id,name,status,effective_status,targeting,daily_budget,lifetime_budget,start_time,end_time,campaign_id,destination_type,optimization_goal',
    limit: 100,
  };
  const endpoint = campaignId ? `/${campaignId}/adsets` : `/${actId}/adsets`;
  const r = await client(accessToken).get(endpoint, { params });
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
  let currentTargeting = formatMetaTargeting(targeting);

  for (let attempt = 0; attempt < 5; attempt++) {
    const payload = {
      name,
      campaign_id,
      billing_event,
      optimization_goal,
      destination_type,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: currentTargeting,
      promoted_object: {
        page_id: String(page_id),
      },
      status,
    };

    if (daily_budget) payload.daily_budget = daily_budget;
    if (lifetime_budget) payload.lifetime_budget = lifetime_budget;
    if (start_time) payload.start_time = start_time;
    if (end_time) payload.end_time = end_time;

    try {
      const r = await client(accessToken).post(`/${actId}/adsets`, payload);
      return r.data;
    } catch (err) {
      const errData = err.response?.data?.error;
      const errMsg = errData?.error_user_msg || errData?.message || '';

      // Check if Meta rejected an invalid interest or behavior ID
      const match = errMsg.match(/Interests with ID (\d+) is invalid/i) ||
                    errMsg.match(/ID (\d+) is invalid/i) ||
                    errMsg.match(/with ID (\d+) is invalid/i);

      if (match && match[1] && currentTargeting.flexible_spec) {
        const badId = match[1];
        console.warn(`[createAdSet] Meta rejected invalid targeting ID ${badId}. Stripping and retrying...`);

        const newFlexible = [];
        for (const group of currentTargeting.flexible_spec) {
          const newGroup = {};
          for (const [k, items] of Object.entries(group)) {
            const filtered = items.filter(item => String(item.id) !== String(badId));
            if (filtered.length > 0) newGroup[k] = filtered;
          }
          if (Object.keys(newGroup).length > 0) newFlexible.push(newGroup);
        }

        if (newFlexible.length > 0) {
          currentTargeting.flexible_spec = newFlexible;
        } else {
          delete currentTargeting.flexible_spec;
        }
        continue;
      }

      // Check for Advantage audience flag requirement error 1870227
      if (errData?.error_subcode === 1870227) {
        currentTargeting.targeting_automation = { advantage_audience: 0 };
        continue;
      }

      throw err;
    }
  }
}

async function updateAdSet(accessToken, adsetId, updates) {
  try {
    const r = await client(accessToken).post(`/${adsetId}`, updates);
    return r.data;
  } catch (err) {
    const errData = err.response?.data?.error;
    // Error subcode 1487057: "start_time cannot be edited if the ad set has already started"
    if ((errData?.error_subcode === 1487057 || errData?.message?.includes('start_time')) && updates.start_time) {
      const retryUpdates = { ...updates };
      delete retryUpdates.start_time;
      const r = await client(accessToken).post(`/${adsetId}`, retryUpdates);
      return r.data;
    }
    throw err;
  }
}

async function deleteAdSet(accessToken, adsetId) {
  const r = await client(accessToken).delete(`/${adsetId}`);
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
    fields: 'id,name,status,effective_status,creative{id,name,title,body,image_url,thumbnail_url,call_to_action_type},adset_id,campaign_id,created_time',
    limit: 100,
  };
  const endpoint = campaignId ? `/${campaignId}/ads` : `/${actId}/ads`;
  const r = await client(accessToken).get(endpoint, { params });
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

async function getCampaignInsights(accessToken, campaignId, { date_preset, since, until, time_increment } = {}) {
  const params = {
    access_token: accessToken,
    fields: 'impressions,clicks,spend,reach,ctr,cpc,cpm,actions,action_values,frequency,date_start,date_stop',
  };
  if (since && until) {
    params.time_range = JSON.stringify({ since, until });
  } else if (date_preset) {
    params.date_preset = date_preset;
  } else {
    params.date_preset = 'last_30d';
  }
  if (time_increment) params.time_increment = time_increment;

  const r = await client(accessToken).get(`/${campaignId}/insights`, { params });
  return r.data?.data || [];
}

async function getAccountInsights(accessToken, actId, { date_preset, since, until, time_increment = 1 } = {}) {
  const params = {
    access_token: accessToken,
    fields: 'impressions,clicks,spend,reach,ctr,cpc,cpm,actions,date_start,date_stop',
    time_increment,
    level: 'campaign',
    limit: 500,
  };
  if (since && until) {
    params.time_range = JSON.stringify({ since, until });
  } else if (date_preset) {
    params.date_preset = date_preset;
  } else {
    params.date_preset = 'last_30d';
  }

  const r = await client(accessToken).get(`/${actId}/insights`, { params });
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

async function searchGeoLocations(accessToken, query, locationTypes = ['city', 'region', 'country', 'zip']) {
  if (!query) return [];
  const r = await client(accessToken).get('/search', {
    params: {
      access_token: accessToken,
      type: 'adgeolocation',
      q: query,
      location_types: JSON.stringify(locationTypes),
      limit: 25,
    },
  });
  return r.data?.data || [];
}

async function searchTargetingCategories(accessToken, query, categoryClass = 'interests') {
  const params = {
    access_token: accessToken,
    limit: 30,
  };
  if (categoryClass === 'interests' || !categoryClass) {
    if (!query) return [];
    params.type = 'adinterest';
    params.q = query;
  } else {
    params.type = 'adTargetingCategory';
    params.class = categoryClass;
    if (query) params.q = query;
  }
  const r = await client(accessToken).get('/search', { params });
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

async function createPage(accessToken, { name, category = 'BUSINESS_CONSULTANT', about = '' }) {
  const r = await client(accessToken).post('/me/accounts', {
    name,
    category_enum: category,
    about,
    access_token: accessToken,
  });
  return r.data; // { id, access_token }
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

// ── OAuth ─────────────────────────────────────────────────────

function getOAuthUrl(redirectUri, state = '') {
  const appId = process.env.META_APP_ID || process.env.FB_APP_ID;
  if (!appId) throw new Error('META_APP_ID is not configured');

  const scope = 'ads_management,ads_read,pages_read_engagement,pages_manage_ads,pages_show_list,business_management,leads_retrieval';
  const url = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code${state ? `&state=${encodeURIComponent(state)}` : ''}`;
  return { app_id: appId, url, scope };
}

async function exchangeOAuthCode(code, redirectUri) {
  const appId = process.env.META_APP_ID || process.env.FB_APP_ID;
  const appSecret = process.env.META_APP_SECRET || process.env.FB_APP_SECRET;
  if (!appId || !appSecret) throw new Error('META_APP_ID and META_APP_SECRET must be configured');

  const r = await axios.get('https://graph.facebook.com/v22.0/oauth/access_token', {
    params: {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    },
  });
  return r.data; // { access_token, token_type, expires_in }
}

async function getLongLivedToken(shortLivedToken) {
  const appId = process.env.META_APP_ID || process.env.FB_APP_ID;
  const appSecret = process.env.META_APP_SECRET || process.env.FB_APP_SECRET;
  if (!appId || !appSecret) return shortLivedToken;

  try {
    const r = await axios.get('https://graph.facebook.com/v22.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedToken,
      },
    });
    return r.data?.access_token || shortLivedToken;
  } catch (err) {
    console.warn('[getLongLivedToken] Falling back to short-lived token:', err.response?.data || err.message);
    return shortLivedToken;
  }
}

module.exports = {
  getOAuthUrl, exchangeOAuthCode, getLongLivedToken,
  getAdAccounts, getAdAccount,
  listCampaigns, createCampaign, updateCampaign, deleteCampaign,
  listAdSets, createAdSet, updateAdSet, deleteAdSet,
  listCreatives, createCreative,
  listAds, createAd, updateAd, deleteAd,
  getCampaignInsights, getAccountInsights,
  listCustomAudiences, listSavedAudiences,
  createCustomAudience, uploadUsersToAudience, createLookalikeAudience, createSavedAudience, deleteAudience,
  searchInterests, searchGeoLocations, searchTargetingCategories,
  listPages, createPage, uploadImage,
};


