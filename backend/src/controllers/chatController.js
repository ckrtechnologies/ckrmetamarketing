const chatRepo = require('../repositories/chatRepo');
const orgRepo  = require('../repositories/orgRepo');
const { sendText, sendTemplate } = require('../utils/metaClient');

// ── Conversations ─────────────────────────────────────────────

async function listConversations(req, res) {
  try {
    const { status, search, limit = 50, offset = 0 } = req.query;
    const result = await chatRepo.getConversations(req.orgId, { status, search, limit: +limit, offset: +offset });
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
    await chatRepo.upsertConversation({
      org_id: req.orgId,
      waba_id: convWaba.id,
      customer_phone: conv.customer_phone,
      last_message: `You: ${text.substring(0, 60)}`,
    });

    res.json({ message: msg, wamid });
  } catch (err) {
    console.error('[sendReply]', err);
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

// GET /api/v2/chat/conversations/:id/poll — lightweight poll for new messages
async function pollMessages(req, res) {
  try {
    const { since } = req.query; // ISO timestamp
    let query = chatRepo.getMessages(req.params.id, { limit: 50 });
    const { messages } = await query;
    const filtered = since ? messages.filter(m => new Date(m.sent_at) > new Date(since)) : messages;
    res.json({ messages: filtered });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { listConversations, getConversation, closeConversation, assignConversation, getMessages, sendReply, getUnreadCount, pollMessages };
