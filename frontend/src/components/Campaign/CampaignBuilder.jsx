import React, { useState, useEffect } from 'react';
import { listWabaAccounts, getWabaTemplates } from '../../api/waba.js';
import { listGroups } from '../../api/contacts.js';
import { createCampaign } from '../../api/campaigns.js';

const STEPS = ['📱 Sender', '📝 Template', '👥 Audience', '🚀 Review'];

export default function CampaignBuilder({ onClose, onCreated }) {
  const [step,       setStep]       = useState(0);
  const [wabaAccounts, setWabaAccounts] = useState([]);
  const [templates,  setTemplates]  = useState([]);
  const [groups,     setGroups]     = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  const [form, setForm] = useState({
    name: '',
    waba_id: '',
    template_name: '',
    template_lang: 'en',
    group_id: '',
  });

  useEffect(() => {
    Promise.all([listWabaAccounts(), listGroups()])
      .then(([wa, gr]) => { setWabaAccounts(wa.accounts || []); setGroups(gr.groups || []); })
      .catch(e => setError(e.message));
  }, []);

  async function handleWabaChange(waba_id) {
    setForm(f => ({ ...f, waba_id, template_name: '', template_lang: 'en' }));
    if (!waba_id) return;
    const acc = wabaAccounts.find(a => a.id === waba_id);
    if (!acc) return;
    try {
      const data = await getWabaTemplates(acc.id);
      setTemplates(data.templates || []);
    } catch (e) { setError(e.message); }
  }

  function canProceed() {
    if (step === 0) return !!form.waba_id;
    if (step === 1) return !!form.template_name;
    if (step === 2) return !!form.group_id;
    return !!form.name;
  }

  async function handleCreate() {
    if (!form.name) { setError('Campaign name is required'); return; }
    setSaving(true); setError('');
    try {
      await createCampaign({ ...form, group_id: form.group_id || undefined });
      onCreated();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  const selectedTemplate = templates.find(t => t.name === form.template_name);
  const selectedWaba     = wabaAccounts.find(a => a.id === form.waba_id);
  const selectedGroup    = groups.find(g => g.id === form.group_id);

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 640 }}>
        <div className="modal-title">📣 New Campaign</div>

        {/* Step indicator */}
        <div className="campaign-steps">
          {STEPS.map((s, i) => (
            <div key={i} className={`campaign-step${i === step ? ' campaign-step--active' : i < step ? ' campaign-step--done' : ''}`}>
              <div className="campaign-step__dot">{i < step ? '✓' : i + 1}</div>
              <span>{s}</span>
            </div>
          ))}
        </div>

        {error && <div className="alert alert--error" style={{ margin: '12px 0' }}>{error}</div>}

        {/* Step 0: Sender */}
        {step === 0 && (
          <div>
            <p style={{ color: 'var(--clr-text-2)', marginBottom: 16, fontSize: 13.5 }}>
              Select the WhatsApp Business number to send from.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {wabaAccounts.map(acc => (
                <div
                  key={acc.id}
                  onClick={() => handleWabaChange(acc.id)}
                  className={`campaign-select-card${form.waba_id === acc.id ? ' campaign-select-card--selected' : ''}`}
                >
                  <span style={{ fontSize: 24 }}>📱</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{acc.display_name || acc.display_number}</div>
                    <div style={{ fontSize: 12, color: 'var(--clr-text-2)' }}>{acc.display_number} • WABA: {acc.waba_id}</div>
                  </div>
                  {acc.is_active && <span className="badge badge--green" style={{ marginLeft: 'auto' }}>Active</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Template */}
        {step === 1 && (
          <div>
            <p style={{ color: 'var(--clr-text-2)', marginBottom: 16, fontSize: 13.5 }}>
              Choose an approved WhatsApp template from <strong>{selectedWaba?.display_name}</strong>.
            </p>
            {templates.length === 0 ? (
              <div className="alert alert--info">No approved templates found for this account.</div>
            ) : (
              <div className="campaign-template-grid">
                {templates.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setForm(f => ({ ...f, template_name: t.name, template_lang: t.language || 'en' }))}
                    className={`campaign-tpl-card${form.template_name === t.name ? ' campaign-tpl-card--selected' : ''}`}
                  >
                    <strong>{t.name}</strong>
                    <p>{t.components?.find(c => c.type === 'BODY')?.text?.substring(0, 80) || '—'}...</p>
                    <span className="badge badge--green" style={{ fontSize: 9.5, marginTop: 6 }}>APPROVED</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Audience */}
        {step === 2 && (
          <div>
            <p style={{ color: 'var(--clr-text-2)', marginBottom: 16, fontSize: 13.5 }}>
              Select a contact group to target.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groups.map(g => (
                <div
                  key={g.id}
                  onClick={() => setForm(f => ({ ...f, group_id: g.id }))}
                  className={`campaign-select-card${form.group_id === g.id ? ' campaign-select-card--selected' : ''}`}
                >
                  <span style={{ fontSize: 22 }}>👥</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{g.name}</div>
                    {g.vertical && <div style={{ fontSize: 11, color: 'var(--clr-text-3)' }}>{g.vertical}</div>}
                  </div>
                </div>
              ))}
              {groups.length === 0 && <div className="alert alert--info">No contact groups found. Create a group first in Contacts.</div>}
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Campaign Name *</label>
              <input className="form-input" placeholder="e.g. August Payment Reminders" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="campaign-review-grid">
              <div className="campaign-review-item"><span>📱 Sender</span><strong>{selectedWaba?.display_number || '—'}</strong></div>
              <div className="campaign-review-item"><span>📝 Template</span><strong>{form.template_name || '—'}</strong></div>
              <div className="campaign-review-item"><span>👥 Audience</span><strong>{selectedGroup?.name || '—'}</strong></div>
              <div className="campaign-review-item"><span>🌐 Language</span><strong>{form.template_lang}</strong></div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="modal-footer" style={{ marginTop: 24 }}>
          <button className="btn btn--ghost" onClick={step === 0 ? onClose : () => setStep(s => s - 1)}>
            {step === 0 ? 'Cancel' : '← Back'}
          </button>
          {step < 3 ? (
            <button className="btn btn--primary" onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
              Next →
            </button>
          ) : (
            <button className="btn btn--primary" onClick={handleCreate} disabled={saving || !form.name}>
              {saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Creating...</> : '🚀 Create Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
