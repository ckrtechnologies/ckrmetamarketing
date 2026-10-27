import { apiCall } from './auth.js';

export const listConversations   = (params = {}) => apiCall('GET',  '/v2/chat/conversations?' + new URLSearchParams(params).toString());
export const startConversation   = (data)        => apiCall('POST', '/v2/chat/start', data);
export const getConversation     = (id)          => apiCall('GET',  `/v2/chat/conversations/${id}`);
export const getMessages         = (id, p = {})  => apiCall('GET',  `/v2/chat/conversations/${id}/messages?` + new URLSearchParams(p).toString());
export const pollMessages        = (id, since)   => apiCall('GET',  `/v2/chat/conversations/${id}/poll?since=${encodeURIComponent(since)}`);
export const sendReply           = (id, text)    => apiCall('POST', `/v2/chat/conversations/${id}/send`, { text });
export const sendMediaReply      = (id, formData)=> apiCall('POST', `/v2/chat/conversations/${id}/send-media`, formData);
export const sendTemplateInChat  = (id, data)    => apiCall('POST', `/v2/chat/conversations/${id}/send-template`, data);
export const closeConversation   = (id)          => apiCall('POST', `/v2/chat/conversations/${id}/close`);
export const assignConversation  = (id, user_id) => apiCall('POST', `/v2/chat/conversations/${id}/assign`, { user_id });
export const deleteConversation  = (id)          => apiCall('DELETE', `/v2/chat/conversations/${id}`);
export const deleteMessage       = (messageId)   => apiCall('DELETE', `/v2/chat/messages/${messageId}`);
export const getUnreadCount      = ()            => apiCall('GET',  '/v2/chat/unread');

