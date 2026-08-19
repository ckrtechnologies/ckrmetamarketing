import { apiCall } from './auth.js';

export const listCampaigns   = (params = {}) => apiCall('GET',    '/v2/campaigns?' + new URLSearchParams(params).toString());
export const getCampaign     = (id)           => apiCall('GET',    `/v2/campaigns/${id}`);
export const createCampaign  = (data)         => apiCall('POST',   '/v2/campaigns', data);
export const updateCampaign  = (id, data)     => apiCall('PATCH',  `/v2/campaigns/${id}`, data);
export const deleteCampaign  = (id)           => apiCall('DELETE', `/v2/campaigns/${id}`);
export const launchCampaign  = (id)           => apiCall('POST',   `/v2/campaigns/${id}/launch`);
export const pauseCampaign   = (id)           => apiCall('POST',   `/v2/campaigns/${id}/pause`);
export const getCampaignReport = (id, params = {}) => apiCall('GET', `/v2/campaigns/${id}/report?` + new URLSearchParams(params).toString());
export const exportCampaignCSV = (id)         => `${import.meta.env.VITE_API_URL || '/api'}/v2/campaigns/${id}/export`;
