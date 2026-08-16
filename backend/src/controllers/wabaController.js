const orgRepo = require('../repositories/orgRepo');
const { getTemplates } = require('../utils/metaClient');

// GET /api/v2/waba
async function listWabaAccounts(req, res) {
  try {
    const accounts = await orgRepo.getWabaAccounts(req.orgId);
    return res.json({ accounts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/v2/waba/connect
async function connectWaba(req, res) {
  try {
    const { waba_id, phone_number_id, display_number, display_name, access_token } = req.body;
    if (!waba_id || !phone_number_id || !access_token) {
      return res.status(400).json({ error: 'waba_id, phone_number_id and access_token are required' });
    }

    // Verify credentials with Meta before saving
    const result = await getTemplates(waba_id, access_token);
    if (!result.success) {
      return res.status(400).json({
        error: 'Meta API validation failed. Check your credentials.',
        detail: result.error,
      });
    }

    const account = await orgRepo.upsertWabaAccount({
      org_id: req.orgId,
      waba_id,
      phone_number_id,
      display_number,
      display_name,
      access_token,
    });
    return res.status(201).json({ message: 'WABA connected successfully', account });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/v2/waba/:id/activate
async function activateWaba(req, res) {
  try {
    const account = await orgRepo.setActiveWaba(req.orgId, req.params.id);
    return res.json({ message: 'Active number switched', account });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// DELETE /api/v2/waba/:id
async function deleteWaba(req, res) {
  try {
    await orgRepo.deleteWabaAccount(req.orgId, req.params.id);
    return res.json({ message: 'WABA account removed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/v2/waba/active
async function getActiveWaba(req, res) {
  try {
    const account = await orgRepo.getActiveWaba(req.orgId);
    return res.json({ account });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/v2/waba/:id/templates
async function listTemplates(req, res) {
  try {
    const accounts = await orgRepo.getWabaAccounts(req.orgId);
    const account = accounts.find(a => a.id === req.params.id);
    if (!account) return res.status(404).json({ error: 'WABA account not found' });

    const result = await getTemplates(account.waba_id, account.access_token);
    if (!result.success) return res.status(400).json({ error: result.error });

    const templates = (result.data?.data || []).filter(t => t.status === 'APPROVED');
    return res.json({ templates });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { listWabaAccounts, connectWaba, activateWaba, deleteWaba, getActiveWaba, listTemplates };
