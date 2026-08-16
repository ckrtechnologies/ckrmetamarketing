const supabase = require('../utils/supabase');

// ── Contact Groups ────────────────────────────────────────────

async function getGroups(org_id) {
  const { data, error } = await supabase
    .from('contact_groups')
    .select('*, contacts(count)')
    .eq('org_id', org_id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(g => ({
    ...g,
    contact_count: g.contacts?.[0]?.count ?? (typeof g.contacts === 'number' ? g.contacts : 0),
  }));
}

async function createGroup({ org_id, name, vertical }) {
  const { data, error } = await supabase
    .from('contact_groups')
    .insert({ org_id, name, vertical })
    .select('*, contacts(count)')
    .single();
  if (error) throw error;
  return {
    ...data,
    contact_count: 0,
  };
}

async function updateGroup(org_id, id, updates) {
  const { data, error } = await supabase
    .from('contact_groups')
    .update(updates)
    .eq('id', id)
    .eq('org_id', org_id)
    .select('*, contacts(count)')
    .single();
  if (error) throw error;
  return {
    ...data,
    contact_count: data.contacts?.[0]?.count ?? 0,
  };
}

async function deleteGroup(org_id, id) {
  // First unset group_id on contacts in this group
  await supabase
    .from('contacts')
    .update({ group_id: null })
    .eq('group_id', id)
    .eq('org_id', org_id);

  const { error } = await supabase
    .from('contact_groups')
    .delete()
    .eq('id', id)
    .eq('org_id', org_id);
  if (error) throw error;
}

// ── Contacts ──────────────────────────────────────────────────

async function getContacts(org_id, { group_id, search, status, tag, limit = 100, offset = 0 } = {}) {
  let query = supabase
    .from('contacts')
    .select('*, contact_groups(id, name, vertical)', { count: 'exact' })
    .eq('org_id', org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (group_id) query = query.eq('group_id', group_id);
  if (status === 'active') query = query.eq('opted_out', false);
  if (status === 'opted_out') query = query.eq('opted_out', true);
  if (search) query = query.or(`phone.ilike.%${search}%,name.ilike.%${search}%`);
  if (tag) query = query.contains('tags', [tag]);

  const { data, error, count } = await query;
  if (error) throw error;
  return { contacts: data, total: count };
}

async function getAllTags(org_id) {
  const { data, error } = await supabase
    .from('contacts')
    .select('tags')
    .eq('org_id', org_id)
    .not('tags', 'is', null);
  if (error) throw error;
  const tagSet = new Set();
  (data || []).forEach(r => {
    if (Array.isArray(r.tags)) r.tags.forEach(t => t && tagSet.add(t.trim()));
  });
  return Array.from(tagSet).sort();
}

async function createContact({ org_id, group_id, name, phone, tags, metadata }) {
  const { data, error } = await supabase
    .from('contacts')
    .insert({ org_id, group_id, name, phone, tags, metadata })
    .select('*, contact_groups(id, name, vertical)')
    .single();
  if (error) throw error;
  return data;
}

async function upsertContacts(rows) {
  // rows: [{ org_id, group_id, name, phone, tags, metadata }]
  const { data, error } = await supabase
    .from('contacts')
    .upsert(rows, { onConflict: 'org_id,phone', ignoreDuplicates: false })
    .select('*, contact_groups(id, name, vertical)');
  if (error) throw error;
  return data;
}

async function updateContact(org_id, id, updates) {
  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .eq('org_id', org_id)
    .select('*, contact_groups(id, name, vertical)')
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

// ── Bulk operations ──────────────────────────────────────────

async function bulkDeleteContacts(org_id, ids) {
  if (!ids || !ids.length) return { count: 0 };
  const { error, count } = await supabase
    .from('contacts')
    .delete({ count: 'exact' })
    .in('id', ids)
    .eq('org_id', org_id);
  if (error) throw error;
  return { count: count || ids.length };
}

async function bulkUpdateGroup(org_id, ids, group_id) {
  if (!ids || !ids.length) return { count: 0 };
  const { data, error } = await supabase
    .from('contacts')
    .update({ group_id: group_id || null })
    .in('id', ids)
    .eq('org_id', org_id)
    .select('id');
  if (error) throw error;
  return { count: (data || []).length };
}

async function bulkUpdateStatus(org_id, ids, opted_out) {
  if (!ids || !ids.length) return { count: 0 };
  const { data, error } = await supabase
    .from('contacts')
    .update({ opted_out: Boolean(opted_out) })
    .in('id', ids)
    .eq('org_id', org_id)
    .select('id');
  if (error) throw error;
  return { count: (data || []).length };
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
  getContacts, getAllTags, createContact, upsertContacts, updateContact, deleteContact,
  bulkDeleteContacts, bulkUpdateGroup, bulkUpdateStatus, getContactsByGroup,
};

