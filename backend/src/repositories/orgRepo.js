const supabase = require('../utils/supabase');

// ── Organizations ─────────────────────────────────────────────

async function createOrg(name, slug) {
  const { data, error } = await supabase
    .from('organizations')
    .insert({ name, slug })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getOrgById(id) {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function orgSlugExists(slug) {
  const { count } = await supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug);
  return count > 0;
}

// ── Users ─────────────────────────────────────────────────────

async function createUser({ org_id, email, name, role, password_hash }) {
  const { data, error } = await supabase
    .from('users')
    .insert({ org_id, email, name, role, password_hash })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getUserById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, role, org_id, created_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function getOrgMembers(org_id) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, role, created_at')
    .eq('org_id', org_id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

// ── WABA Accounts ─────────────────────────────────────────────

async function getWabaAccounts(org_id) {
  const { data, error } = await supabase
    .from('waba_accounts')
    .select('*')
    .eq('org_id', org_id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function upsertWabaAccount({ org_id, waba_id, phone_number_id, display_number, display_name, access_token }) {
  // Check if a WABA with this phone_number_id already exists for this org
  const { data: existing } = await supabase
    .from('waba_accounts')
    .select('id')
    .eq('org_id', org_id)
    .eq('phone_number_id', phone_number_id)
    .maybeSingle();

  if (existing) {
    // UPDATE existing row
    const { data, error } = await supabase
      .from('waba_accounts')
      .update({ waba_id, display_number, display_name, access_token })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    // INSERT new row
    const { data, error } = await supabase
      .from('waba_accounts')
      .insert({ org_id, waba_id, phone_number_id, display_number, display_name, access_token })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

async function setActiveWaba(org_id, waba_account_id) {
  // Deactivate all first
  await supabase.from('waba_accounts').update({ is_active: false }).eq('org_id', org_id);
  // Activate target
  const { data, error } = await supabase
    .from('waba_accounts')
    .update({ is_active: true })
    .eq('id', waba_account_id)
    .eq('org_id', org_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getActiveWaba(org_id) {
  const { data, error } = await supabase
    .from('waba_accounts')
    .select('*')
    .eq('org_id', org_id)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function updateWabaAccount(org_id, id, updates) {
  const { data, error } = await supabase
    .from('waba_accounts')
    .update(updates)
    .eq('id', id)
    .eq('org_id', org_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteWabaAccount(org_id, id) {
  const { error } = await supabase
    .from('waba_accounts')
    .delete()
    .eq('id', id)
    .eq('org_id', org_id);
  if (error) throw error;
}

module.exports = {
  createOrg, getOrgById, orgSlugExists,
  createUser, getUserByEmail, getUserById, getOrgMembers,
  getWabaAccounts, upsertWabaAccount, updateWabaAccount, setActiveWaba, getActiveWaba, deleteWabaAccount,
};

// ── Utility: expose supabase instance for webhook org lookup ──
function supabasePublic() {
  return require('../utils/supabase');
}
module.exports.supabasePublic = supabasePublic;
