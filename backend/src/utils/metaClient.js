const axios = require('axios');

const META_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const BASE_URL = `https://graph.facebook.com/${META_VERSION}`;

/**
 * Make an authenticated call to Meta Graph API
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g. '/1234567890/messages')
 * @param {string} accessToken - WABA access token
 * @param {object} data - Request body
 */
async function metaCall(method, path, accessToken, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${path}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };
    if (data) config.data = data;
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (err) {
    const errData = err.response?.data?.error || {};
    return {
      success: false,
      error: errData.message || err.message,
      code: errData.code,
      raw: err.response?.data,
    };
  }
}

/**
 * Send a WhatsApp template message via Meta Cloud API
 */
async function sendTemplate(phoneNumberId, accessToken, to, templateName, lang, components = []) {
  return metaCall('POST', `/${phoneNumberId}/messages`, accessToken, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: lang || 'en' },
      components,
    },
  });
}

/**
 * Send a freeform text message (only valid within 24h customer-initiated window)
 */
async function sendText(phoneNumberId, accessToken, to, text) {
  return metaCall('POST', `/${phoneNumberId}/messages`, accessToken, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  });
}

/**
 * Fetch templates for a WABA
 */
async function getTemplates(wabaId, accessToken) {
  return metaCall('GET', `/${wabaId}/message_templates?limit=100&fields=id,name,status,category,language,components,quality_score,rejected_reason`, accessToken);
}

/**
 * Create a new message template in Meta WABA
 */
async function createTemplate(wabaId, accessToken, templateData) {
  return metaCall('POST', `/${wabaId}/message_templates`, accessToken, templateData);
}

/**
 * Delete a message template by name in Meta WABA
 */
async function deleteTemplate(wabaId, accessToken, templateName) {
  return metaCall('DELETE', `/${wabaId}/message_templates?name=${encodeURIComponent(templateName)}`, accessToken);
}

/**
 * Send a media message (image, document, video) via Meta Cloud API using a public URL
 */
async function sendMedia(phoneNumberId, accessToken, to, type, mediaUrl, caption, filename) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type,
    [type]: { link: mediaUrl }
  };
  if (caption && (type === 'image' || type === 'video' || type === 'document')) {
    payload[type].caption = caption;
  }
  if (filename && type === 'document') {
    payload[type].filename = filename;
  }
  return metaCall('POST', `/${phoneNumberId}/messages`, accessToken, payload);
}

/**
 * Get media URL by media ID
 */
async function getMediaUrl(mediaId, accessToken) {
  return metaCall('GET', `/${mediaId}`, accessToken);
}

/**
 * Download media binary data from Meta URL
 */
async function downloadMediaData(url, accessToken) {
  try {
    const response = await axios({
      method: 'GET',
      url,
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer'
    });
    return { success: true, data: response.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { metaCall, sendTemplate, sendText, getTemplates, createTemplate, deleteTemplate, sendMedia, getMediaUrl, downloadMediaData };
