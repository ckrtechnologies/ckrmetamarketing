const campaignRepo = require('../repositories/campaignRepo');
const contactRepo  = require('../repositories/contactRepo');
const orgRepo      = require('../repositories/orgRepo');
const chatRepo     = require('../repositories/chatRepo');
const { sendTemplate } = require('../utils/metaClient');

// ── CRUD ──────────────────────────────────────────────────────

async function listCampaigns(req, res) {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const result = await campaignRepo.getCampaigns(req.orgId, { status, limit: +limit, offset: +offset });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getCampaign(req, res) {
  try {
    const campaign = await campaignRepo.getCampaignById(req.orgId, req.params.id);
    const stats    = await campaignRepo.getCampaignStats(req.params.id);
    res.json({ campaign, stats });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function createCampaign(req, res) {
  try {
    const { name, waba_id, template_name, template_lang = 'en', group_id, recipients, variables, template_variables, scheduled_at } = req.body;
    if (!name || !waba_id || !template_name) {
      return res.status(400).json({ error: 'name, waba_id and template_name are required' });
    }

    const campaign = await campaignRepo.createCampaign({
      org_id: req.orgId, waba_id, name, template_name, template_lang, scheduled_at, created_by: req.user.id,
    });

    const varTemplate = variables || template_variables || recipients?.variableMap || {};

    // Helper to resolve variables for a specific contact
    function resolveContactVariables(contact) {
      if (!varTemplate || Object.keys(varTemplate).length === 0) return null;
      const resolved = {};
      for (const [key, val] of Object.entries(varTemplate)) {
        let strVal = String(val || '');
        if (strVal === '{{name}}' || strVal === 'name' || strVal === '{{Name}}') {
          strVal = contact?.name || 'Customer';
        } else if (strVal === '{{phone}}' || strVal === 'phone') {
          strVal = contact?.phone || '';
        } else if (contact?.metadata && contact.metadata[strVal.replace(/[{}]/g, '')]) {
          strVal = contact.metadata[strVal.replace(/[{}]/g, '')];
        }
        resolved[key] = strVal;
      }
      return resolved;
    }

    // Attach recipients from a group or explicit list
    let recipientRows = [];
    if (group_id) {
      const contacts = await contactRepo.getContactsByGroup(req.orgId, group_id);
      recipientRows = contacts.map(c => ({
        contact_id: c.id,
        phone: require('../utils/phone').normalizePhoneNumber(c.phone),
        variables: resolveContactVariables(c),
      }));
    } else if (recipients?.phones?.length) {
      recipientRows = recipients.phones.map(phone => ({
        contact_id: null,
        phone: require('../utils/phone').normalizePhoneNumber(phone),
        variables: resolveContactVariables({ phone }),
      }));
    }

    if (recipientRows.length > 0) {
      await campaignRepo.addRecipients(campaign.id, recipientRows);
      await campaignRepo.updateCampaign(req.orgId, campaign.id, { total_recipients: recipientRows.length });
    }

    res.status(201).json({ campaign, recipientsAdded: recipientRows.length });
  } catch (err) {
    console.error('[createCampaign]', err);
    res.status(500).json({ error: err.message });
  }
}

async function updateCampaign(req, res) {
  try {
    const campaign = await campaignRepo.updateCampaign(req.orgId, req.params.id, req.body);
    res.json({ campaign });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function deleteCampaign(req, res) {
  try {
    const campaign = await campaignRepo.getCampaignById(req.orgId, req.params.id);
    if (['running'].includes(campaign.status)) {
      return res.status(400).json({ error: 'Cannot delete a running campaign. Pause it first.' });
    }
    await campaignRepo.deleteCampaign(req.orgId, req.params.id);
    res.json({ message: 'Campaign deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Launch ────────────────────────────────────────────────────

async function launchCampaign(req, res) {
  try {
    const campaign = await campaignRepo.getCampaignById(req.orgId, req.params.id);
    if (!['draft', 'paused'].includes(campaign.status)) {
      return res.status(400).json({ error: `Campaign is already ${campaign.status}` });
    }

    // Get WABA credentials
    const wabaAccounts = await orgRepo.getWabaAccounts(req.orgId);
    const waba = wabaAccounts.find(a => a.id === campaign.waba_id);
    if (!waba) return res.status(404).json({ error: 'WABA account not found' });

    // Mark running
    await campaignRepo.updateCampaign(req.orgId, campaign.id, { status: 'running', started_at: new Date().toISOString() });

    // Acknowledge immediately, send async
    res.json({ message: 'Campaign launched', campaignId: campaign.id });

    // ── Async bulk send ───────────────────────────────────────
    const pending = await campaignRepo.getPendingRecipients(campaign.id);
    console.log(`[campaign:launch] Sending to ${pending.length} recipients — campaign: ${campaign.name}`);

    let sent = 0, failed = 0;
    const RATE_DELAY_MS = 100; // ~10 msg/sec

    for (const recipient of pending) {
      try {
        // Build components from variables
        const components = [];
        if (recipient.variables && Object.keys(recipient.variables).length > 0) {
          const bodyVars = Object.keys(recipient.variables)
                                 .filter(k => k !== 'header_link')
                                 .sort((a, b) => Number(a) - Number(b))
                                 .map(k => recipient.variables[k]);
          
          if (bodyVars.length > 0) {
            const params = bodyVars.map(v => ({ type: 'text', text: String(v) }));
            components.push({ type: 'body', parameters: params });
          }

          if (recipient.variables.header_link) {
            const link = recipient.variables.header_link;
            let type = 'document';
            if (link.match(/\.(jpg|jpeg|png|gif|webp)$/i)) type = 'image';
            else if (link.match(/\.(mp4|3gp|mov)$/i)) type = 'video';
            
            components.push({
              type: 'header',
              parameters: [
                {
                  type,
                  [type]: { 
                    link,
                    ...(type === 'document' ? { filename: link.split('/').pop().replace(/^\d+_/, '') } : {})
                  }
                }
              ]
            });
          }
        }

        const result = await sendTemplate(
          waba.phone_number_id,
          waba.access_token,
          recipient.phone,
          campaign.template_name,
          campaign.template_lang,
          components
        );

        if (result.success) {
          const wamid = result.data?.messages?.[0]?.id;
          await campaignRepo.updateRecipientStatus(recipient.id, 'sent', { wamid });
          
          // Log the campaign message to Live Chat
          try {
            const conv = await chatRepo.upsertConversation({
              org_id: req.orgId,
              waba_id: waba.id,
              customer_phone: recipient.phone,
              last_message: `You: [Template: ${campaign.template_name}]`,
            });
            await chatRepo.addMessage({
              conversation_id: conv.id,
              direction: 'outbound',
              type: 'template',
              body: `[Template: ${campaign.template_name}]`,
              wamid,
              status: 'sent',
            });
          } catch (e) {
            console.error('[campaign:chat_log_error]', e.message);
          }
          
          sent++;
        } else {
          await campaignRepo.updateRecipientStatus(recipient.id, 'failed', {
            error_code: String(result.code || ''),
            error_msg:  result.error,
          });
          failed++;
        }

        await new Promise(r => setTimeout(r, RATE_DELAY_MS));
      } catch (err) {
        await campaignRepo.updateRecipientStatus(recipient.id, 'failed', { error_msg: err.message });
        failed++;
      }
    }

    // Mark completed
    await campaignRepo.updateCampaign(req.orgId, campaign.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
    console.log(`[campaign:done] ${campaign.name} — sent: ${sent}, failed: ${failed}`);
  } catch (err) {
    console.error('[launchCampaign]', err);
    await campaignRepo.updateCampaign(req.orgId, req.params.id, { status: 'failed' }).catch(() => {});
  }
}

async function pauseCampaign(req, res) {
  try {
    const campaign = await campaignRepo.updateCampaign(req.orgId, req.params.id, { status: 'paused' });
    res.json({ campaign });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Reports ───────────────────────────────────────────────────

async function getCampaignReport(req, res) {
  try {
    const { limit = 500, offset = 0, status } = req.query;
    const campaign = await campaignRepo.getCampaignById(req.orgId, req.params.id);
    const stats    = await campaignRepo.getCampaignStats(req.params.id);
    const { recipients, total } = await campaignRepo.getRecipients(req.params.id, { limit: +limit, offset: +offset, status });
    res.json({ campaign, stats, recipients, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function exportCampaignCSV(req, res) {
  try {
    const campaign = await campaignRepo.getCampaignById(req.orgId, req.params.id);
    const { recipients } = await campaignRepo.getRecipients(req.params.id, { limit: 10000 });

    const header = 'phone,status,sent_at,delivered_at,read_at,failed_at,error_code,error_msg\n';
    const rows = recipients.map(r =>
      [r.phone, r.status, r.sent_at || '', r.delivered_at || '', r.read_at || '', r.failed_at || '', r.error_code || '', r.error_msg || ''].join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${campaign.name}-report.csv"`);
    res.send(header + rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { listCampaigns, getCampaign, createCampaign, updateCampaign, deleteCampaign, launchCampaign, pauseCampaign, getCampaignReport, exportCampaignCSV };
