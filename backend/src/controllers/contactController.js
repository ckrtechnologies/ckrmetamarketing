const contactRepo = require('../repositories/contactRepo');
const { parse }   = require('fast-csv');
const { Readable } = require('stream');
const { normalizePhoneNumber } = require('../utils/phone');

// ── Groups ────────────────────────────────────────────────────

async function listGroups(req, res) {
  try {
    const groups = await contactRepo.getGroups(req.orgId);
    res.json({ groups });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function createGroup(req, res) {
  try {
    const { name, vertical } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const group = await contactRepo.createGroup({ org_id: req.orgId, name, vertical });
    res.status(201).json({ group });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function updateGroup(req, res) {
  try {
    const group = await contactRepo.updateGroup(req.orgId, req.params.id, req.body);
    res.json({ group });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function deleteGroup(req, res) {
  try {
    await contactRepo.deleteGroup(req.orgId, req.params.id);
    res.json({ message: 'Group deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Contacts ─────────────────────────────────────────────────

async function listContacts(req, res) {
  try {
    const { group_id, search, limit = 100, offset = 0 } = req.query;
    const result = await contactRepo.getContacts(req.orgId, {
      group_id,
      search,
      limit:  parseInt(limit),
      offset: parseInt(offset),
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function createContact(req, res) {
  try {
    const { name, phone, group_id, tags, metadata } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return res.status(400).json({ error: 'Valid phone number required' });
    }
    const contact = await contactRepo.createContact({
      org_id: req.orgId,
      group_id: group_id || null,
      name: name || null,
      phone: normalizedPhone,
      tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : null),
      metadata,
    });
    res.status(201).json({ contact });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Contact with this phone already exists' });
    res.status(500).json({ error: err.message });
  }
}

async function updateContact(req, res) {
  try {
    const { name, phone, group_id, tags, opted_out, metadata } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) {
      const normalizedPhone = normalizePhoneNumber(phone);
      if (!normalizedPhone || normalizedPhone.length < 10) {
        return res.status(400).json({ error: 'Valid phone number required' });
      }
      updates.phone = normalizedPhone;
    }
    if (group_id !== undefined) updates.group_id = group_id || null;
    if (tags !== undefined) {
      updates.tags = Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : null);
    }
    if (opted_out !== undefined) updates.opted_out = Boolean(opted_out);
    if (metadata !== undefined) updates.metadata = metadata;

    const contact = await contactRepo.updateContact(req.orgId, req.params.id, updates);
    res.json({ contact });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Contact with this phone already exists' });
    res.status(500).json({ error: err.message });
  }
}

async function deleteContact(req, res) {
  try {
    await contactRepo.deleteContact(req.orgId, req.params.id);
    res.json({ message: 'Contact deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── CSV Import ───────────────────────────────────────────────

async function importCSV(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });
    const { group_id } = req.body;
    const csvText = req.file.buffer.toString('utf-8');

    const rows = [];
    await new Promise((resolve, reject) => {
      const stream = Readable.from([csvText]);
      stream
        .pipe(parse({ headers: true, trim: true }))
        .on('data', (row) => {
          const rawPhone = row.phone || row.Phone || row.mobile || row.Mobile || '';
          const phone = normalizePhoneNumber(rawPhone);
          if (phone.length >= 10) {
            rows.push({
              org_id:   req.orgId,
              group_id: group_id || null,
              name:     row.name || row.Name || null,
              phone,
              tags:     row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
              metadata: Object.keys(row).reduce((acc, k) => {
                if (!['phone','Phone','mobile','Mobile','name','Name','tags'].includes(k)) acc[k] = row[k];
                return acc;
              }, {}),
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (rows.length === 0) return res.status(400).json({ error: 'No valid phone numbers found in CSV' });

    // Batch upsert in chunks of 500
    let imported = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const saved = await contactRepo.upsertContacts(chunk);
      imported += (saved || []).length;
    }

    res.json({ message: `${imported} contacts imported successfully`, total: rows.length, imported });
  } catch (err) {
    console.error('[importCSV]', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { listGroups, createGroup, updateGroup, deleteGroup, listContacts, createContact, updateContact, deleteContact, importCSV };

