const { updateRecipientByWamid, logDelivery } = require('../repositories/campaignRepo');
const { upsertConversation, addMessage, updateMessageStatus } = require('../repositories/chatRepo');
const orgRepo = require('../repositories/orgRepo');

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
            await handleInboundMessage(value, msg).catch(err =>
              console.error('[webhook:inbound error]', err.message)
            );
          }
        }

        if (value.statuses?.length) {
          for (const status of value.statuses) {
            await handleStatusUpdate(status).catch(err =>
              console.error('[webhook:status error]', err.message)
            );
          }
        }
      }
    }
  } catch (err) {
    console.error('[webhook:receive]', err);
  }
}

// ── Inbound Message Handler ───────────────────────────────────
async function handleInboundMessage(value, msg) {
  const from        = msg.from;  // customer phone
  const wabaPhoneId = value.metadata?.phone_number_id;
  const wabaId      = value.metadata?.display_phone_number;
  const msgType     = msg.type || 'text';
  const timestamp   = new Date(parseInt(msg.timestamp) * 1000).toISOString();
  const wamid       = msg.id;

  // Extract message body
  let body = '';
  if (msgType === 'text')     body = msg.text?.body || '';
  if (msgType === 'image')    body = `[Image${msg.image?.caption ? ': ' + msg.image.caption : ''}]`;
  if (msgType === 'document') body = `[Document: ${msg.document?.filename || ''}]`;
  if (msgType === 'audio')    body = '[Voice Message]';
  if (msgType === 'video')    body = '[Video]';
  if (msgType === 'sticker')  body = '[Sticker]';
  if (msgType === 'location') body = `[Location: ${msg.location?.name || ''}]`;

  const customerName = value.contacts?.[0]?.profile?.name || null;

  console.log(`[webhook:inbound] +${from} → "${body.substring(0, 60)}" [${msgType}]`);

  // Find org by phone_number_id → waba_accounts table
  let wabaRow = null;
  if (wabaPhoneId) {
    const { data } = await orgRepo.supabasePublic()
      .from('waba_accounts')
      .select('id, org_id')
      .eq('phone_number_id', String(wabaPhoneId))
      .maybeSingle();
    wabaRow = data;
  }

  // Fallback: If not matched by phone_number_id, match by active WABA or first WABA in DB
  if (!wabaRow) {
    const { data: fallbackWaba } = await orgRepo.supabasePublic()
      .from('waba_accounts')
      .select('id, org_id')
      .order('is_active', { ascending: false })
      .limit(1)
      .maybeSingle();
    wabaRow = fallbackWaba;
  }

  if (!wabaRow) {
    console.warn(`[webhook] No WABA account found in system for inbound message`);
    return;
  }

  const { id: wabaDbId, org_id } = wabaRow;

  // Calculate 24h reply window from this message
  const windowExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // ── Auto-save lead directly into CRM Contacts ────────────────
  try {
    const cleanPhone = require('../utils/phone').normalizePhoneNumber(from);
    const { data: existingContact } = await orgRepo.supabasePublic()
      .from('contacts')
      .select('id, name, tags')
      .eq('org_id', org_id)
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (!existingContact) {
      await orgRepo.supabasePublic()
        .from('contacts')
        .insert({
          org_id,
          phone: cleanPhone,
          name: customerName || null,
          tags: ['ad-lead', 'whatsapp'],
          metadata: { source: 'click_to_whatsapp_ad', first_message: body },
        });
      console.log(`[webhook:crm] 🎯 New Lead captured in CRM: +${cleanPhone} (${customerName || 'No Name'})`);
    } else if (customerName && !existingContact.name) {
      await orgRepo.supabasePublic()
        .from('contacts')
        .update({ name: customerName })
        .eq('id', existingContact.id);
    }
  } catch (crmErr) {
    console.error('[webhook:auto-lead-crm error]', crmErr.message);
  }

  // Upsert conversation
  const conv = await upsertConversation({
    org_id,
    waba_id: wabaDbId,
    customer_phone: from,
    customer_name: customerName,
    last_message: body || `[${msgType}]`,
    window_expires: windowExpires,
  });

  // Save inbound message
  await addMessage({
    conversation_id: conv.id,
    direction: 'inbound',
    type: msgType,
    body,
    wamid,
    status: 'delivered',
  });

}

// ── Delivery Status Handler ───────────────────────────────────
async function handleStatusUpdate(status) {
  const { id: wamid, status: newStatus, timestamp, errors } = status;
  const error_code = errors?.[0]?.code ? String(errors[0].code) : null;
  const error_msg  = errors?.[0]?.title || null;
  const ts         = new Date(parseInt(timestamp) * 1000).toISOString();

  console.log(`[webhook:status] ${wamid.substring(0, 20)}... → ${newStatus}`);

  // Campaign delivery log
  await logDelivery({ wamid, status: newStatus, error_code, error_msg });

  // Campaign recipient update
  const recipientUpdate = { status: newStatus };
  if (newStatus === 'sent')      recipientUpdate.sent_at      = ts;
  if (newStatus === 'delivered') recipientUpdate.delivered_at = ts;
  if (newStatus === 'read')      recipientUpdate.read_at      = ts;
  if (newStatus === 'failed')    recipientUpdate.failed_at    = ts;
  if (error_code) { recipientUpdate.error_code = error_code; recipientUpdate.error_msg = error_msg; }

  await updateRecipientByWamid(wamid, recipientUpdate);

  // Chat message status update
  await updateMessageStatus(wamid, newStatus);
}

module.exports = { verify, receive };
