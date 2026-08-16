import { apiCall } from './auth.js';

export const listConversations  = (params = {}) => apiCall('GET',  '/v2/chat/conversations?' + new URLSearchParams(params).toString());
export const getConversation    = (id)           => apiCall('GET',  `/v2/chat/conversations/${id}`);
export const getMessages        = (id, params={})=> apiCall('GET',  `/v2/chat/conversations/${id}/messages?` + new URLSearchParams(params).toString());
export const pollMessages       = (id, since)    => apiCall('GET',  `/v2/chat/conversations/${id}/poll?since=${since}`);
export const sendReply          = (id, text)     => apiCall('POST', `/v2/chat/conversations/${id}/send`, { text });
export const closeConversation  = (id)           => apiCall('POST', `/v2/chat/conversations/${id}/close`);
export const assignConversation = (id, user_id)  => apiCall('POST', `/v2/chat/conversations/${id}/assign`, { user_id });
export const getUnreadCount     = ()             => apiCall('GET',  '/v2/chat/unread');
