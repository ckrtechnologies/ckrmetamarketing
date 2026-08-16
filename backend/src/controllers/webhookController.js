const { updateRecipientByWamid, logDelivery } = require('../repositories/campaignRepo');

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'ckrmetamarketing_verify_token';

// GET — Meta webhook verification
function verify(req, res) {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[webhook] ✅ Verified');
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'Forbidden' });
}

// POST — Receive Meta events
async function receive(req, res) {
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') {
      return res.status(404).json({ error: 'Not a WABA event' });
    }

    res.status(200).json({ received: true });

    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        const value = change.value;
        if (!value) continue;

        if (value.messages?.length) {
          for (const msg of value.messages) {
            await handleInboundMessage(value, msg);
          }
        }

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
  const from = msg.from;
  const text = msg.text?.body || `[${msg.type}]`;
  console.log(`[webhook:inbound] From: +${from} | "${text.substring(0, 60)}"`);
  // Phase 3: persist to conversations + messages
}

async function handleStatusUpdate(status) {
  const { id: wamid, status: newStatus, timestamp, errors } = status;
  const error_code = errors?.[0]?.code ? String(errors[0].code) : null;
  const error_msg  = errors?.[0]?.title || null;

  console.log(`[webhook:status] ${wamid} → ${newStatus} ${error_code ? `(err ${error_code})` : ''}`);

  // ── Persist delivery log ──────────────────────────────────
  await logDelivery({ wamid, status: newStatus, error_code, error_msg });

  // ── Update campaign recipient row ─────────────────────────
  const ts = {};
  if (newStatus === 'sent')      ts.sent_at      = new Date(parseInt(timestamp) * 1000).toISOString();
  if (newStatus === 'delivered') ts.delivered_at = new Date(parseInt(timestamp) * 1000).toISOString();
  if (newStatus === 'read')      ts.read_at      = new Date(parseInt(timestamp) * 1000).toISOString();
  if (newStatus === 'failed')    ts.failed_at    = new Date(parseInt(timestamp) * 1000).toISOString();

  await updateRecipientByWamid(wamid, { status: newStatus, ...ts, error_code, error_msg });
}

module.exports = { verify, receive };
