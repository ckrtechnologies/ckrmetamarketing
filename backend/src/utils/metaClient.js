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
  return metaCall('GET', `/${wabaId}/message_templates?limit=100&fields=id,name,status,language,components`, accessToken);
}

module.exports = { metaCall, sendTemplate, sendText, getTemplates };
