const supabase = require('../utils/supabase');

// ── Conversations ─────────────────────────────────────────────

async function upsertConversation({ org_id, waba_id, customer_phone, customer_name, last_message, window_expires, last_message_at, is_inbound = false }) {
  const ts = last_message_at || new Date().toISOString();

  // Find existing conversation first
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, unread_count')
    .eq('org_id', org_id)
    .eq('customer_phone', customer_phone)
    .maybeSingle();

  if (existing) {
    // If inbound, increment unread count. If outbound reply from agent, clear unread count. Otherwise preserve.
    const newUnread = is_inbound ? (existing.unread_count || 0) + 1 : 0;

    const updatePayload = {
      last_message,
      last_message_at: ts,
      unread_count: is_inbound ? newUnread : (last_message && last_message.startsWith('You:') ? 0 : existing.unread_count || 0),
      status: 'open',
      ...(window_expires ? { window_expires } : {}),
      ...(waba_id ? { waba_id } : {}),
      ...(customer_name ? { customer_name } : {}),
    };

    const { data, error } = await supabase
      .from('conversations')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        org_id,
        waba_id,
        customer_phone,
        customer_name,
        last_message,
        last_message_at: ts,
        unread_count: is_inbound ? 1 : 0,
        window_expires,
        status: 'open',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

async function getConversations(org_id, {
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
} = {}) {
  let query = supabase
    .from('conversations')
    .select('*, users(name)', { count: 'exact' })
    .eq('org_id', org_id)
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === 'unread') {
    query = query.gt('unread_count', 0);
  } else if (status) {
    query = query.eq('status', status);
  }

  if (waba_id) {
    query = query.eq('waba_id', waba_id);
  }

  if (window_status === 'open') {
    query = query.gt('window_expires', new Date().toISOString());
  } else if (window_status === 'expired') {
    query = query.or(`window_expires.is.null,window_expires.lte.${new Date().toISOString()}`);
  }

  if (date_from) {
    query = query.gte('last_message_at', date_from);
  }
  if (date_to) {
    query = query.lte('last_message_at', date_to);
  }

  if (template_name) {
    query = query.ilike('last_message', `%${template_name}%`);
  }

  if (group_id || tag) {
    let contactQuery = supabase.from('contacts').select('phone').eq('org_id', org_id);
    if (group_id) contactQuery = contactQuery.eq('group_id', group_id);
    if (tag) contactQuery = contactQuery.contains('tags', [tag]);
    const { data: contacts } = await contactQuery;
    const phones = (contacts || []).map(c => c.phone);
    if (phones.length > 0) {
      query = query.in('customer_phone', phones);
    } else {
      return { conversations: [], total: 0 };
    }
  }

  if (search) {
    query = query.or(`customer_phone.ilike.%${search}%,customer_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { conversations: data, total: count };
}

async function getConversationById(org_id, id) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .eq('org_id', org_id)
    .single();
  if (error) throw error;
  return data;
}

async function findConversationByPhone(org_id, customer_phone) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('org_id', org_id)
    .eq('customer_phone', customer_phone)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function markConversationRead(org_id, id) {
  const { error } = await supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', id)
    .eq('org_id', org_id);
  if (error) throw error;
}

async function closeConversation(org_id, id) {
  const { data, error } = await supabase
    .from('conversations')
    .update({ status: 'closed' })
    .eq('id', id)
    .eq('org_id', org_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function assignConversation(org_id, id, user_id) {
  const { data, error } = await supabase
    .from('conversations')
    .update({ assigned_to: user_id })
    .eq('id', id)
    .eq('org_id', org_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Messages ──────────────────────────────────────────────────

async function addMessage({ conversation_id, direction, type, body, template_name, wamid, status, sent_at }) {
  const insertData = { conversation_id, direction, type: type || 'text', body, template_name, wamid, status: status || 'sent' };
  if (sent_at) insertData.sent_at = sent_at;
  
  const { data, error } = await supabase
    .from('messages')
    .insert(insertData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getMessages(conversation_id, { limit = 100, offset = 0 } = {}) {
  const { data, error, count } = await supabase
    .from('messages')
    .select('*', { count: 'exact' })
    .eq('conversation_id', conversation_id)
    .order('sent_at', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { messages: data, total: count };
}

async function updateMessageStatus(wamid, status) {
  const tsField = status === 'delivered' ? 'delivered_at' : status === 'read' ? 'read_at' : null;
  const updates = { status };
  if (tsField) updates[tsField] = new Date().toISOString();

  const { error } = await supabase
    .from('messages')
    .update(updates)
    .eq('wamid', wamid);
  if (error) console.error('[updateMessageStatus]', error.message);
}

async function getUnreadCount(org_id) {
  const { data, error } = await supabase
    .from('conversations')
    .select('unread_count')
    .eq('org_id', org_id)
    .eq('status', 'open')
    .gt('unread_count', 0);
  if (error) return 0;
  return data.reduce((sum, c) => sum + (c.unread_count || 0), 0);
}

async function getNewMessagesSince(conversation_id, since) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation_id)
    .gt('sent_at', since)
    .order('sent_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

module.exports = {
  upsertConversation, getConversations, getConversationById, findConversationByPhone,
  markConversationRead, closeConversation, assignConversation,
  addMessage, getMessages, updateMessageStatus, getUnreadCount, getNewMessagesSince,
};

