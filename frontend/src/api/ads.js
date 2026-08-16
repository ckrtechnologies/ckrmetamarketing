import { apiCall } from './auth.js';

// ── Ad Accounts ──────────────────────────────────────────────────
export const listAdAccounts    = ()               => apiCall('GET',    '/v2/ads/accounts');
export const fetchMetaAccounts = (access_token)   => apiCall('GET',    `/v2/ads/meta-accounts?access_token=${encodeURIComponent(access_token)}`);
export const connectAdAccount  = (data)           => apiCall('POST',   '/v2/ads/accounts', data);
export const setActiveAdAccount = (id)            => apiCall('POST',   `/v2/ads/accounts/${id}/activate`);
export const updateAdAccount   = (id, data)       => apiCall('PATCH',  `/v2/ads/accounts/${id}`, data);
export const disconnectAdAccount = (id)           => apiCall('DELETE', `/v2/ads/accounts/${id}`);

// ── Pages ────────────────────────────────────────────────────────
export const listPages         = ()               => apiCall('GET',    '/v2/ads/pages');

// ── Campaigns ────────────────────────────────────────────────────
export const listCampaigns     = (params = {})    => apiCall('GET',    '/v2/ads/campaigns?' + new URLSearchParams(params).toString());
export const createCampaign    = (data)           => apiCall('POST',   '/v2/ads/campaigns', data);
export const updateCampaign    = (id, data)       => apiCall('PATCH',  `/v2/ads/campaigns/${id}`, data);
export const deleteCampaign    = (id)             => apiCall('DELETE', `/v2/ads/campaigns/${id}`);
export const getCampaignInsights = (id, params)   => apiCall('GET',    `/v2/ads/campaigns/${id}/insights?` + new URLSearchParams(params).toString());

// Full campaign publish wizard
export const publishCampaign   = (data)           => apiCall('POST',   '/v2/ads/publish', data);

// ── Ad Sets ──────────────────────────────────────────────────────
export const listAdSets        = (params = {})    => apiCall('GET',    '/v2/ads/adsets?' + new URLSearchParams(params).toString());
export const createAdSet       = (data)           => apiCall('POST',   '/v2/ads/adsets', data);
export const updateAdSet       = (id, data)       => apiCall('PATCH',  `/v2/ads/adsets/${id}`, data);
export const deleteAdSet       = (id)             => apiCall('DELETE', `/v2/ads/adsets/${id}`);

// ── Ads ──────────────────────────────────────────────────────────
export const listAds           = (params = {})    => apiCall('GET',    '/v2/ads/ads?' + new URLSearchParams(params).toString());
export const updateAd          = (id, data)       => apiCall('PATCH',  `/v2/ads/ads/${id}`, data);
export const deleteAd          = (id)             => apiCall('DELETE', `/v2/ads/ads/${id}`);


// ── Insights Dashboard & Balance ─────────────────────────────────
export const getAccountInsights = (params = {})   => apiCall('GET',    '/v2/ads/insights?' + new URLSearchParams(params).toString());
export const getAccountBalance  = ()              => apiCall('GET',    '/v2/ads/balance');


// ── Audiences ────────────────────────────────────────────────────
export const listAudiences            = ()               => apiCall('GET',    '/v2/ads/audiences');
export const createCustomAudience     = (data)           => apiCall('POST',   '/v2/ads/audiences/custom', data);
export const createLookalikeAudience  = (data)           => apiCall('POST',   '/v2/ads/audiences/lookalike', data);
export const createSavedAudience      = (data)           => apiCall('POST',   '/v2/ads/audiences/saved', data);
export const deleteAudience           = (id)             => apiCall('DELETE', `/v2/ads/audiences/${id}`);
export const searchInterests          = (q)             => apiCall('GET',    `/v2/ads/interests?q=${encodeURIComponent(q)}`);

