const chatRepo = require('../repositories/chatRepo');
const orgRepo  = require('../repositories/orgRepo');
const { sendText, sendTemplate, sendMedia } = require('../utils/metaClient');
const fs = require('fs');
const path = require('path');

// ── Conversations ─────────────────────────────────────────────

async function listConversations(req, res) {
  try {
    const {
      status,
      search,
      waba_id,
      window_status,
      date_from,
      date_to,
      template_name,
      group_id,
      tag,
      limit = 50,
      offset = 0,
    } = req.query;

    const result = await chatRepo.getConversations(req.orgId, {
      status,
      search,
      waba_id,
      window_status,
      date_from,
      date_to,
      template_name,
      group_id,
      tag,
      limit: +limit,
      offset: +offset,
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getConversation(req, res) {
  try {
    const conv = await chatRepo.getConversationById(req.orgId, req.params.id);
    const msgs  = await chatRepo.getMessages(req.params.id, { limit: 100 });
    await chatRepo.markConversationRead(req.orgId, req.params.id);
    res.json({ conversation: conv, ...msgs });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function closeConversation(req, res) {
  try {
    const conv = await chatRepo.closeConversation(req.orgId, req.params.id);
    res.json({ conversation: conv });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function assignConversation(req, res) {
  try {
    const { user_id } = req.body;
    const conv = await chatRepo.assignConversation(req.orgId, req.params.id, user_id);
    res.json({ conversation: conv });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Messages ──────────────────────────────────────────────────

async function getMessages(req, res) {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await chatRepo.getMessages(req.params.id, { limit: +limit, offset: +offset });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /api/v2/chat/conversations/:id/send
// Send a text reply (must be within 24h window)
async function sendReply(req, res) {
  try {
    const { text, type = 'text' } = req.body;
    if (!text && type === 'text') return res.status(400).json({ error: 'text is required' });

    const conv = await chatRepo.getConversationById(req.orgId, req.params.id);

    // Check 24h window
    const windowExpires = conv.window_expires ? new Date(conv.window_expires) : null;
    const now = new Date();
    if (windowExpires && now > windowExpires) {
      return res.status(400).json({
        error: 'Customer service window has expired (24h). You can only send template messages now.',
        window_expired: true,
      });
    }

    // Get active WABA for this org
    const waba = await orgRepo.getActiveWaba(req.orgId) ||
      (await orgRepo.getWabaAccounts(req.orgId))[0];

    if (!waba) return res.status(404).json({ error: 'No WhatsApp number connected' });

    // Find WABA with matching phone_number_id for this conversation
    const wabaAccounts = await orgRepo.getWabaAccounts(req.orgId);
    const convWaba = conv.waba_id
      ? wabaAccounts.find(a => a.id === conv.waba_id) || wabaAccounts[0]
      : wabaAccounts[0];

    if (!convWaba) return res.status(404).json({ error: 'WABA not found for this conversation' });

    const result = await sendText(convWaba.phone_number_id, convWaba.access_token, conv.customer_phone, text);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to send message', detail: result.raw });
    }

    const wamid = result.data?.messages?.[0]?.id;

    // Save outbound message
    const msg = await chatRepo.addMessage({
      conversation_id: conv.id,
      direction: 'outbound',
      type,
      body: text,
      wamid,
      status: 'sent',
    });

    // Update conversation last message
    const updatedConv = await chatRepo.upsertConversation({
      org_id: req.orgId,
      waba_id: convWaba.id,
      customer_phone: conv.customer_phone,
      last_message: `You: ${text.substring(0, 60)}`,
    });

    const io = req.app.get('io');
    if (io) {
      const payload = {
        conversation_id: conv.id,
        message: msg,
        conversation: updatedConv || conv,
      };
      if (req.orgId) io.to(req.orgId).emit('new_message', payload);
      io.emit('new_message', payload);
    }

    res.json({ message: msg, wamid });
  } catch (err) {
    console.error('[sendReply]', err);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/v2/chat/conversations/:id/send-media
async function sendMediaReply(req, res) {
  try {
    const file = req.file;
    const { caption } = req.body;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const conv = await chatRepo.getConversationById(req.orgId, req.params.id);
    const windowExpires = conv.window_expires ? new Date(conv.window_expires) : null;
    const now = new Date();
    if (windowExpires && now > windowExpires) {
      return res.status(400).json({ error: 'Customer service window expired (24h).', window_expired: true });
    }

    const wabaAccounts = await orgRepo.getWabaAccounts(req.orgId);
    const convWaba = conv.waba_id
      ? wabaAccounts.find(a => a.id === conv.waba_id) || wabaAccounts[0]
      : wabaAccounts[0];
    if (!convWaba) return res.status(404).json({ error: 'WABA not found for this conversation' });

    // Save file locally to CDN public dir
    const pubDir = process.env.PUBLIC_DIR || path.join(__dirname, '../../public');
    const orgDir = path.join(pubDir, req.orgId, 'chat');
    if (!fs.existsSync(orgDir)) fs.mkdirSync(orgDir, { recursive: true });

    // Sanitize filename to avoid spaces and special chars
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${Date.now()}_${safeName}`;
    const filepath = path.join(orgDir, filename);
    fs.writeFileSync(filepath, file.buffer);

    const cdnBase = process.env.CDN_BASE_URL || 'http://localhost:5001/public';
    const mediaLink = `${cdnBase}/${req.orgId}/chat/${filename}`;

    // Determine type
    let type = 'document';
    if (file.mimetype.startsWith('image/')) type = 'image';
    if (file.mimetype.startsWith('video/')) type = 'video';
    if (file.mimetype.startsWith('audio/')) type = 'audio';

    const result = await sendMedia(
      convWaba.phone_number_id,
      convWaba.access_token,
      conv.customer_phone,
      type,
      mediaLink,
      caption,
      type === 'document' ? safeName : undefined
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to send media', detail: result.raw });
    }

    const wamid = result.data?.messages?.[0]?.id;
    const bodyStr = `[${type.charAt(0).toUpperCase() + type.slice(1)}: ${caption || safeName} | URL: ${mediaLink}]`;

    const msg = await chatRepo.addMessage({
      conversation_id: conv.id,
      direction: 'outbound',
      type,
      body: bodyStr,
      wamid,
      status: 'sent',
    });

    const updatedConv = await chatRepo.upsertConversation({
      org_id: req.orgId,
      waba_id: convWaba.id,
      customer_phone: conv.customer_phone,
      last_message: `You: ${bodyStr.substring(0, 60)}`,
    });

    const io = req.app.get('io');
    if (io) {
      const payload = {
        conversation_id: conv.id,
        message: msg,
        conversation: updatedConv || conv,
      };
      if (req.orgId) io.to(req.orgId).emit('new_message', payload);
      io.emit('new_message', payload);
    }

    res.json({ message: msg, wamid, mediaLink });
  } catch (err) {
    console.error('[sendMediaReply]', err);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/v2/chat/start
async function startConversation(req, res) {
  try {
    const { customer_phone, customer_name, waba_id } = req.body;
    if (!customer_phone) return res.status(400).json({ error: 'customer_phone is required' });

    const cleanPhone = require('../utils/phone').normalizePhoneNumber(customer_phone);

    const wabaAccounts = await orgRepo.getWabaAccounts(req.orgId);
    const targetWaba = (waba_id ? wabaAccounts.find(a => a.id === waba_id) : null) ||
      (await orgRepo.getActiveWaba(req.orgId)) ||
      wabaAccounts[0];

    if (!targetWaba) return res.status(404).json({ error: 'No WhatsApp number connected' });

    const conv = await chatRepo.upsertConversation({
      org_id: req.orgId,
      waba_id: targetWaba.id,
      customer_phone: cleanPhone,
      customer_name: customer_name || null,
      last_message: 'Chat opened',
    });

    res.json({ conversation: conv });
  } catch (err) {
    console.error('[startConversation]', err);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/v2/chat/conversations/:id/send-template
async function sendTemplateInChat(req, res) {
  try {
    const { template_name, template_lang = 'en', variables = {} } = req.body;
    if (!template_name) return res.status(400).json({ error: 'template_name is required' });

    const conv = await chatRepo.getConversationById(req.orgId, req.params.id);
    const wabaAccounts = await orgRepo.getWabaAccounts(req.orgId);
    const convWaba = conv.waba_id
      ? wabaAccounts.find(a => a.id === conv.waba_id) || wabaAccounts[0]
      : wabaAccounts[0];

    if (!convWaba) return res.status(404).json({ error: 'WABA not found' });

    const components = [];
    if (variables && Object.keys(variables).length > 0) {
      const params = Object.values(variables).map(v => ({ type: 'text', text: String(v) }));
      components.push({ type: 'body', parameters: params });
    }

    const result = await sendTemplate(
      convWaba.phone_number_id,
      convWaba.access_token,
      conv.customer_phone,
      template_name,
      template_lang,
      components
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to send template', detail: result.raw });
    }

    const wamid = result.data?.messages?.[0]?.id;

    const msg = await chatRepo.addMessage({
      conversation_id: conv.id,
      direction: 'outbound',
      type: 'template',
      body: `[Template: ${template_name}]`,
      wamid,
      status: 'sent',
    });

    const updatedConv = await chatRepo.upsertConversation({
      org_id: req.orgId,
      waba_id: convWaba.id,
      customer_phone: conv.customer_phone,
      last_message: `You: [Template: ${template_name}]`,
    });

    const io = req.app.get('io');
    if (io) {
      const payload = {
        conversation_id: conv.id,
        message: msg,
        conversation: updatedConv || conv,
      };
      if (req.orgId) io.to(req.orgId).emit('new_message', payload);
      io.emit('new_message', payload);
    }

    res.json({ message: msg, wamid });
  } catch (err) {
    console.error('[sendTemplateInChat]', err);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/v2/chat/unread — total unread badge count
async function getUnreadCount(req, res) {
  try {
    const count = await chatRepo.getUnreadCount(req.orgId);
    res.json({ unread: count });
  } catch (err) { res.status(500).json({ error: 0 }); }
}

// GET /api/v2/chat/conversations/:id/poll?since=ISOString
async function pollMessages(req, res) {
  try {
    const { since } = req.query;
    if (!since) return res.status(400).json({ error: 'since timestamp required' });
    const messages = await chatRepo.getNewMessagesSince(req.params.id, since);
    res.json({ messages });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// DELETE /api/v2/chat/conversations/:id
async function deleteConversation(req, res) {
  try {
    const conv = await chatRepo.getConversationById(req.orgId, req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    await chatRepo.deleteConversation(req.orgId, req.params.id);
    const io = req.app.get('io');
    if (io) {
      io.emit('conversation_deleted', { conversation_id: req.params.id });
    }
    res.json({ message: 'Conversation deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/v2/chat/messages/:messageId
async function deleteMessage(req, res) {
  try {
    await chatRepo.deleteMessage(req.params.messageId);
    const io = req.app.get('io');
    if (io) {
      io.emit('message_deleted', { message_id: req.params.messageId });
    }
    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listConversations, getConversation, closeConversation, assignConversation, deleteConversation,
  getMessages, sendReply, sendMediaReply, sendTemplateInChat, startConversation, getUnreadCount, pollMessages, deleteMessage,
};

