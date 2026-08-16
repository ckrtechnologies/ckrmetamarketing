import { apiCall } from './auth.js';

export const getAllAnalytics        = (days = 14) => apiCall('GET', `/v2/analytics/all?days=${days}`);
export const getOverview            = ()           => apiCall('GET', '/v2/analytics/overview');
export const getFunnel              = (id)         => apiCall('GET', `/v2/analytics/funnel${id ? '?campaign_id=' + id : ''}`);
export const getDailyMessages       = (days = 14)  => apiCall('GET', `/v2/analytics/daily-messages?days=${days}`);
export const getDailyCampaigns      = (days = 14)  => apiCall('GET', `/v2/analytics/daily-campaigns?days=${days}`);
export const getTopTemplates        = ()           => apiCall('GET', '/v2/analytics/top-templates');
export const getCampaignPerformance = ()           => apiCall('GET', '/v2/analytics/campaign-performance');
