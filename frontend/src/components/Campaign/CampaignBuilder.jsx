import React, { useState, useEffect } from 'react';
import { listWabaAccounts, getWabaTemplates } from '../../api/waba.js';
import { listGroups } from '../../api/contacts.js';
import { createCampaign } from '../../api/campaigns.js';
import './Campaign.css';

const STEPS = ['📱 Sender', '📝 Template', '👥 Audience', '🚀 Review'];

export default function CampaignBuilder({ onClose, onCreated }) {
  const [step,         setStep]         = useState(0);
  const [wabaAccounts, setWabaAccounts] = useState([]);
  const [templates,    setTemplates]    = useState([]);
  const [groups,       setGroups]       = useState([]);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  const [form, setForm] = useState({
    name: '',
    waba_id: '',
    template_name: '',
    template_lang: 'en',
    group_id: '',
    variables: {}, // { "1": "{{name}}", "2": "SUMMER10" }
  });

  useEffect(() => {
    Promise.all([listWabaAccounts(), listGroups()])
      .then(([wa, gr]) => { setWabaAccounts(wa.accounts || []); setGroups(gr.groups || []); })
      .catch(e => setError(e.message));
  }, []);

  async function handleWabaChange(waba_id) {
    setForm(f => ({ ...f, waba_id, template_name: '', template_lang: 'en', variables: {} }));
    if (!waba_id) return;
    const acc = wabaAccounts.find(a => a.id === waba_id);
    if (!acc) return;
    try {
      const data = await getWabaTemplates(acc.id);
      setTemplates(data.templates || []);
    } catch (e) { setError(e.message); }
  }

  const selectedTemplate = templates.find(t => t.name === form.template_name);
  const selectedWaba     = wabaAccounts.find(a => a.id === form.waba_id);
  const selectedGroup    = groups.find(g => g.id === form.group_id);

  // Extract variables from template body text e.g. {{1}}, {{2}}
  function getTemplateVariables(tpl) {
    if (!tpl) return [];
    const bodyComp = tpl.components?.find(c => c.type === 'BODY');
    const text = bodyComp?.text || '';
    const matches = text.match(/{{\s*(\d+)\s*}}/g) || [];
    const unique = [...new Set(matches.map(m => m.replace(/[{}]/g, '').trim()))];
    return unique.sort((a, b) => Number(a) - Number(b));
  }

  const templateVars = getTemplateVariables(selectedTemplate);

  function handleSelectTemplate(t) {
    const vars = getTemplateVariables(t);
    const initialVars = {};
    vars.forEach((v, idx) => {
      // Default first variable to {{name}} (Customer Name) as standard best practice
      initialVars[v] = idx === 0 ? '{{name}}' : '';
    });
    setForm(f => ({
      ...f,
      template_name: t.name,
      template_lang: t.language || 'en',
      variables: initialVars,
    }));
  }

  function handleVariableChange(varKey, value) {
    setForm(f => ({
      ...f,
      variables: { ...f.variables, [varKey]: value },
    }));
  }

  // Live preview with sample values
  function renderLivePreview() {
    if (!selectedTemplate) return null;
    const bodyComp = selectedTemplate.components?.find(c => c.type === 'BODY');
    let text = bodyComp?.text || '';
    
    templateVars.forEach(v => {
      let val = form.variables[v];
      if (val === '{{name}}') val = 'Rahul Sharma';
      else if (val === '{{phone}}') val = '+91 98765 43210';
      else if (!val) val = `{{${v}}}`;
      text = text.replace(new RegExp(`{{\\s*${v}\\s*}}`, 'g'), `[${val}]`);
    });

    return text;
  }

  function canProceed() {
    if (step === 0) return !!form.waba_id;
    if (step === 1) {
      if (!form.template_name) return false;
      // All template variables must have a value
      for (const v of templateVars) {
        if (!form.variables[v] || !form.variables[v].trim()) return false;
      }
      return true;
    }
    if (step === 2) return !!form.group_id;
    return !!form.name;
  }

  async function handleCreate() {
    if (!form.name) { setError('Campaign name is required'); return; }
    setSaving(true); setError('');
    try {
      await createCampaign({
        name: form.name,
        waba_id: form.waba_id,
        template_name: form.template_name,
        template_lang: form.template_lang,
        group_id: form.group_id || undefined,
        variables: form.variables,
      });
      onCreated();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 680 }}>
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

        {/* Step 1: Template & Parameters */}
        {step === 1 && (
          <div>
            <p style={{ color: 'var(--clr-text-2)', marginBottom: 12, fontSize: 13.5 }}>
              Choose a template from <strong>{selectedWaba?.display_name || 'your WhatsApp number'}</strong>:
            </p>
            {templates.length === 0 ? (
              <div className="alert alert--info">No approved templates found for this account.</div>
            ) : (
              <div className="campaign-template-grid" style={{ maxHeight: 220, marginBottom: 16 }}>
                {templates.map(t => (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className={`campaign-tpl-card${form.template_name === t.name ? ' campaign-tpl-card--selected' : ''}`}
                  >
                    <strong>{t.name}</strong>
                    <p>{t.components?.find(c => c.type === 'BODY')?.text?.substring(0, 80) || '—'}...</p>
                    <span className="badge badge--green" style={{ fontSize: 9.5, marginTop: 6 }}>APPROVED</span>
                  </div>
                ))}
              </div>
            )}

            {/* Template Parameters Form */}
            {selectedTemplate && (
              <div className="card" style={{ background: 'rgba(255,255,255,0.02)', padding: 14, border: '1px solid var(--clr-border)' }}>
                {templateVars.length > 0 ? (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--clr-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>⚙️ Fill Template Parameters</span>
                      <span className="badge badge--yellow" style={{ fontSize: 10 }}>{templateVars.length} parameters required</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {templateVars.map(v => (
                        <div key={v} className="form-group" style={{ marginBottom: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <label className="form-label" style={{ marginBottom: 0 }}>
                              Parameter <strong>&#123;&#123;{v}&#125;&#125;</strong>:
                            </label>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                style={{ fontSize: 10.5, padding: '2px 6px', color: 'var(--clr-primary)' }}
                                onClick={() => handleVariableChange(v, '{{name}}')}
                              >
                                👤 Contact Name
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                style={{ fontSize: 10.5, padding: '2px 6px' }}
                                onClick={() => handleVariableChange(v, '{{phone}}')}
                              >
                                📞 Phone
                              </button>
                            </div>
                          </div>
                          <input
                            className="form-input"
                            placeholder="e.g. {{name}} or type custom text (e.g. DISCOUNT10 / Rs 500)"
                            value={form.variables[v] || ''}
                            onChange={e => handleVariableChange(v, e.target.value)}
                            required
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12.5, color: 'var(--clr-text-2)' }}>
                    ✅ This template has no dynamic parameters (static message).
                  </div>
                )}

                {/* Message Live Preview Box */}
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#0b1f14', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--clr-primary)', marginBottom: 4, textTransform: 'uppercase' }}>
                    💬 WhatsApp Message Preview:
                  </div>
                  <div style={{ fontSize: 13, color: '#f0f4ff', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                    {renderLivePreview()}
                  </div>
                </div>
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
            <div className="campaign-review-grid" style={{ marginBottom: 16 }}>
              <div className="campaign-review-item"><span>📱 Sender</span><strong>{selectedWaba?.display_name || selectedWaba?.display_number}</strong></div>
              <div className="campaign-review-item"><span>📝 Template</span><strong>{form.template_name}</strong></div>
              <div className="campaign-review-item"><span>👥 Audience</span><strong>{selectedGroup?.name || '—'}</strong></div>
              <div className="campaign-review-item"><span>🌐 Language</span><strong>{form.template_lang}</strong></div>
            </div>

            {/* Preview in Review */}
            <div style={{ padding: '12px 14px', background: '#0b1f14', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--clr-primary)', marginBottom: 4, textTransform: 'uppercase' }}>
                💬 Message that will be sent:
              </div>
              <div style={{ fontSize: 13, color: '#f0f4ff', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                {renderLivePreview()}
              </div>
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
