const supabase = require('../utils/supabase');

// ── Contact Groups ────────────────────────────────────────────

async function getGroups(org_id) {
  const { data, error } = await supabase
    .from('contact_groups')
    .select('*, contacts(count)')
    .eq('org_id', org_id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function createGroup({ org_id, name, vertical }) {
  const { data, error } = await supabase
    .from('contact_groups')
    .insert({ org_id, name, vertical })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateGroup(org_id, id, updates) {
  const { data, error } = await supabase
    .from('contact_groups')
    .update(updates)
    .eq('id', id)
    .eq('org_id', org_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteGroup(org_id, id) {
  const { error } = await supabase
    .from('contact_groups')
    .delete()
    .eq('id', id)
    .eq('org_id', org_id);
  if (error) throw error;
}

// ── Contacts ──────────────────────────────────────────────────

async function getContacts(org_id, { group_id, search, limit = 100, offset = 0 } = {}) {
  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('org_id', org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (group_id) query = query.eq('group_id', group_id);
  if (search)   query = query.ilike('phone', `%${search}%`).or(`name.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { contacts: data, total: count };
}

async function createContact({ org_id, group_id, name, phone, tags, metadata }) {
  const { data, error } = await supabase
    .from('contacts')
    .insert({ org_id, group_id, name, phone, tags, metadata })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function upsertContacts(rows) {
  // rows: [{ org_id, group_id, name, phone, tags, metadata }]
  const { data, error } = await supabase
    .from('contacts')
    .upsert(rows, { onConflict: 'org_id,phone', ignoreDuplicates: false })
    .select();
  if (error) throw error;
  return data;
}

async function updateContact(org_id, id, updates) {
  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .eq('org_id', org_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteContact(org_id, id) {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)
    .eq('org_id', org_id);
  if (error) throw error;
}

async function getContactsByGroup(org_id, group_id) {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('org_id', org_id)
    .eq('group_id', group_id)
    .eq('opted_out', false);
  if (error) throw error;
  return data;
}

module.exports = {
  getGroups, createGroup, updateGroup, deleteGroup,
  getContacts, createContact, upsertContacts, updateContact, deleteContact, getContactsByGroup,
};
