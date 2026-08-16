// ── Meta Cloud API Webhook Handler ────────────────────────────────────────────
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'ckrmetamarketing_verify_token';

// GET /api/v2/webhook  — verification handshake
function verify(req, res) {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[webhook] ✅ Webhook verified');
    return res.status(200).send(challenge);
  }
  console.warn('[webhook] ❌ Verification failed', { mode, token });
  return res.status(403).json({ error: 'Forbidden' });
}

// POST /api/v2/webhook  — receive Meta events
async function receive(req, res) {
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') {
      return res.status(404).json({ error: 'Not a WhatsApp event' });
    }

    // Always acknowledge immediately
    res.status(200).json({ received: true });

    // Process asynchronously
    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        const value = change.value;
        if (!value) continue;

        // ── Inbound Messages ────────────────────────────────
        if (value.messages?.length) {
          for (const msg of value.messages) {
            await handleInboundMessage(value, msg);
          }
        }

        // ── Delivery Status Updates ──────────────────────────
        if (value.statuses?.length) {
          for (const status of value.statuses) {
            await handleStatusUpdate(status);
          }
        }
      }
    }
  } catch (err) {
    console.error('[webhook:receive]', err);
  }
}

async function handleInboundMessage(value, msg) {
  const from        = msg.from;
  const wabaPhoneId = value.metadata?.phone_number_id;
  const msgId       = msg.id;
  const text        = msg.text?.body || msg.type || '';
  const timestamp   = new Date(parseInt(msg.timestamp) * 1000).toISOString();

  console.log(`[webhook:message] From: ${from} | "${text}" | WABA: ${wabaPhoneId}`);

  // TODO Phase 3: persist to conversations + messages table in Supabase
  // TODO Phase 3: auto-reply logic
}

async function handleStatusUpdate(status) {
  const wamid     = status.id;
  const newStatus = status.status;          // sent | delivered | read | failed
  const timestamp = new Date(parseInt(status.timestamp) * 1000).toISOString();
  const errorCode = status.errors?.[0]?.code;
  const errorMsg  = status.errors?.[0]?.title;

  console.log(`[webhook:status] WAMID: ${wamid} → ${newStatus} ${errorCode ? `(err: ${errorCode})` : ''}`);

  // TODO Phase 2: update campaign_recipients.status in Supabase
  // TODO Phase 2: update delivery_logs table
}

module.exports = { verify, receive };
