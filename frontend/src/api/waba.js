import { apiCall } from './auth.js';

export const listWabaAccounts  = ()         => apiCall('GET',    '/v2/waba');
export const getActiveWaba     = ()         => apiCall('GET',    '/v2/waba/active');
export const connectWaba       = (data)     => apiCall('POST',   '/v2/waba/connect', data);
export const activateWaba      = (id)       => apiCall('POST',   `/v2/waba/${id}/activate`);
export const deleteWaba        = (id)       => apiCall('DELETE', `/v2/waba/${id}`);
export const getWabaTemplates  = (id)       => apiCall('GET',    `/v2/waba/${id}/templates`);
