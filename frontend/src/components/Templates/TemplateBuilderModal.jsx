import React, { useState } from 'react';
import { createWabaTemplate } from '../../api/waba.js';
import WhatsAppPreview from './WhatsAppPreview.jsx';

const LANGUAGES = [
  { code: 'en', label: 'English (en)' },
  { code: 'hi', label: 'Hindi (hi)' },
  { code: 'bn', label: 'Bengali (bn)' },
  { code: 'ta', label: 'Tamil (ta)' },
  { code: 'te', label: 'Telugu (te)' },
  { code: 'mr', label: 'Marathi (mr)' },
  { code: 'gu', label: 'Gujarati (gu)' },
];

const CATEGORIES = [
  { code: 'MARKETING', label: '📣 Marketing (Offers, promotions, announcements)', desc: 'Promotional messages to drive awareness and sales' },
  { code: 'UTILITY', label: '⚙️ Utility (Order status, reminders, receipts)', desc: 'Transaction updates or alerts based on user actions' },
  { code: 'AUTHENTICATION', label: '🔒 Authentication (OTPs, verification codes)', desc: 'One-time passwords and login verification' },
];

export default function TemplateBuilderModal({ wabaId, onClose, onSuccess }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('en');

  // Components
  const [headerType, setHeaderType] = useState('NONE'); // NONE, TEXT, IMAGE, DOCUMENT, VIDEO
  const [headerText, setHeaderText] = useState('');

  const [bodyText, setBodyText] = useState('');
  const [bodyExamples, setBodyExamples] = useState({}); // { 1: "John", 2: "20%" }

  const [footerText, setFooterText] = useState('');

  // Buttons (max 3 quick replies, or up to 2 CTAs)
  const [buttonType, setButtonType] = useState('NONE'); // NONE, QUICK_REPLY, CTA
  const [buttons, setButtons] = useState([]);

  // Extract variables from body text {{1}}, {{2}}
  const detectedVars = React.useMemo(() => {
    const matches = bodyText.match(/{{\s*(\d+)\s*}}/g) || [];
    const nums = [...new Set(matches.map(m => m.replace(/[{}]/g, '').trim()))].sort((a, b) => Number(a) - Number(b));
    return nums;
  }, [bodyText]);

  function handleAddVariable() {
    const nextNum = detectedVars.length > 0 ? Number(detectedVars[detectedVars.length - 1]) + 1 : 1;
    setBodyText(prev => prev + ` {{${nextNum}}} `);
  }

  function handleAddButton() {
    if (buttons.length >= 3) return;
    if (buttonType === 'QUICK_REPLY') {
      setButtons([...buttons, { type: 'QUICK_REPLY', text: '' }]);
    } else if (buttonType === 'CTA') {
      if (buttons.length >= 2) return;
      setButtons([...buttons, { type: 'URL', text: 'Visit Website', url: '' }]);
    }
  }

  function handleRemoveButton(index) {
    setButtons(buttons.filter((_, i) => i !== index));
  }

  function handleButtonChange(index, field, value) {
    const updated = [...buttons];
    updated[index][field] = value;
    setButtons(updated);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Clean name: lowercase, numbers, underscores only
    const cleanName = name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    if (!cleanName) {
      setError('Please provide a valid template name.');
      return;
    }

    if (!bodyText.trim()) {
      setError('Template body text is required.');
      return;
    }

    // Ensure all variables have sample values
    for (const v of detectedVars) {
      if (!bodyExamples[v] || !bodyExamples[v].trim()) {
        setError(`Meta requires a sample value for variable {{${v}}}.`);
        return;
      }
    }

    // Build components array for Meta API
    const components = [];

    // Header
    if (headerType === 'TEXT' && headerText.trim()) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: headerText.trim(),
      });
    } else if (['IMAGE', 'DOCUMENT', 'VIDEO'].includes(headerType)) {
      components.push({
        type: 'HEADER',
        format: headerType,
      });
    }

    // Body (Required)
    const bodyComp = {
      type: 'BODY',
      text: bodyText.trim(),
    };

    if (detectedVars.length > 0) {
      bodyComp.example = {
        body_text: [detectedVars.map(v => bodyExamples[v] || 'sample')],
      };
    }
    components.push(bodyComp);

    // Footer (Optional)
    if (footerText.trim()) {
      components.push({
        type: 'FOOTER',
        text: footerText.trim(),
      });
    }

    // Buttons (Optional)
    if (buttons.length > 0 && buttonType !== 'NONE') {
      const validButtons = buttons.filter(b => b.text && b.text.trim());
      if (validButtons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: validButtons.map(b => {
            if (b.type === 'URL') {
              return { type: 'URL', text: b.text.trim(), url: b.url.trim() };
            }
            if (b.type === 'PHONE_NUMBER') {
              return { type: 'PHONE_NUMBER', text: b.text.trim(), phone_number: b.phone_number.trim() };
            }
            return { type: 'QUICK_REPLY', text: b.text.trim() };
          }),
        });
      }
    }

    setSaving(true);
    try {
      await createWabaTemplate(wabaId, {
        name: cleanName,
        category,
        language,
        components,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit template to Meta.');
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 1040, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="modal-title" style={{ margin: 0 }}>
            ✨ Create WhatsApp Template
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert--danger" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="template-modal-layout">
          {/* Left Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Name, Category, Language */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Template Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. festive_offer_2026"
                  value={name}
                  onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  required
                />
                <span style={{ fontSize: 11, color: 'var(--clr-text-3)' }}>
                  Lowercase, numbers, and underscores only
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Language *</label>
                <select className="form-select" value={language} onChange={e => setLanguage(e.target.value)}>
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Category *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                {CATEGORIES.map(c => (
                  <div
                    key={c.code}
                    onClick={() => setCategory(c.code)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${category === c.code ? '#25d366' : 'var(--clr-border)'}`,
                      background: category === c.code ? 'rgba(37, 211, 102, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 12.5, color: category === c.code ? '#25d366' : '#fff' }}>
                      {c.label.split('(')[0]}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 2 }}>
                      {c.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Header */}
            <div className="card" style={{ padding: 14, background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                  🖼️ Header (Optional)
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['NONE', 'TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO'].map(t => (
                    <button
                      type="button"
                      key={t}
                      className={`btn btn--xs ${headerType === t ? 'btn--primary' : 'btn--ghost'}`}
                      onClick={() => setHeaderType(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {headerType === 'TEXT' && (
                <input
                  className="form-input"
                  placeholder="e.g. Special Festive Announcement"
                  maxLength={60}
                  value={headerText}
                  onChange={e => setHeaderText(e.target.value)}
                />
              )}
              {['IMAGE', 'DOCUMENT', 'VIDEO'].includes(headerType) && (
                <div style={{ fontSize: 12, color: 'var(--clr-text-3)', padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
                  ℹ️ Media headers require uploading the file or providing a direct public URL when creating a campaign.
                </div>
              )}
            </div>

            {/* Body */}
            <div className="card" style={{ padding: 14, background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                  💬 Body Text *
                </label>
                <button
                  type="button"
                  className="btn btn--secondary btn--xs"
                  onClick={handleAddVariable}
                >
                  ➕ Add Variable
                </button>
              </div>

              <textarea
                className="form-textarea"
                rows={4}
                placeholder="e.g. Hello {{1}}, thank you for your enquiry. We are pleased to offer you {{2}}% discount valid till {{3}}."
                value={bodyText}
                onChange={e => setBodyText(e.target.value)}
                required
              />

              {/* Sample values for variables */}
              {detectedVars.length > 0 && (
                <div style={{ marginTop: 12, padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#25d366', marginBottom: 6 }}>
                    ⚠️ Meta Approval Requirement: Provide sample values for each variable
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    {detectedVars.map(v => (
                      <div key={v}>
                        <label style={{ fontSize: 11, color: 'var(--clr-text-2)', display: 'block', marginBottom: 2 }}>
                          Sample for &#123;&#123;{v}&#125;&#125;:
                        </label>
                        <input
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          placeholder={`e.g. John or 20%`}
                          value={bodyExamples[v] || ''}
                          onChange={e => setBodyExamples({ ...bodyExamples, [v]: e.target.value })}
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">📄 Footer Text (Optional)</label>
              <input
                className="form-input"
                placeholder="e.g. Reply STOP to opt out"
                maxLength={60}
                value={footerText}
                onChange={e => setFooterText(e.target.value)}
              />
            </div>

            {/* Interactive Buttons */}
            <div className="card" style={{ padding: 14, background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                  🔘 Buttons (Optional)
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['NONE', 'QUICK_REPLY', 'CTA'].map(t => (
                    <button
                      type="button"
                      key={t}
                      className={`btn btn--xs ${buttonType === t ? 'btn--primary' : 'btn--ghost'}`}
                      onClick={() => { setButtonType(t); setButtons([]); }}
                    >
                      {t === 'NONE' ? 'None' : t === 'QUICK_REPLY' ? 'Quick Replies' : 'Call to Action'}
                    </button>
                  ))}
                </div>
              </div>

              {buttonType !== 'NONE' && (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                    {buttons.map((btn, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {buttonType === 'CTA' && (
                          <select
                            className="form-select"
                            style={{ width: 130, padding: '6px 8px', fontSize: 12 }}
                            value={btn.type}
                            onChange={e => handleButtonChange(idx, 'type', e.target.value)}
                          >
                            <option value="URL">Website URL</option>
                            <option value="PHONE_NUMBER">Phone Call</option>
                          </select>
                        )}
                        <input
                          className="form-input"
                          style={{ flex: 1 }}
                          placeholder="Button Label (e.g. Claim Offer)"
                          value={btn.text}
                          onChange={e => handleButtonChange(idx, 'text', e.target.value)}
                          required
                        />
                        {btn.type === 'URL' && (
                          <input
                            className="form-input"
                            style={{ flex: 1 }}
                            placeholder="https://example.com/offer"
                            value={btn.url || ''}
                            onChange={e => handleButtonChange(idx, 'url', e.target.value)}
                            required
                          />
                        )}
                        {btn.type === 'PHONE_NUMBER' && (
                          <input
                            className="form-input"
                            style={{ flex: 1 }}
                            placeholder="+918851235476"
                            value={btn.phone_number || ''}
                            onChange={e => handleButtonChange(idx, 'phone_number', e.target.value)}
                            required
                          />
                        )}
                        <button
                          type="button"
                          className="btn btn--ghost btn--xs"
                          style={{ color: 'var(--clr-danger)' }}
                          onClick={() => handleRemoveButton(idx)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {buttons.length < (buttonType === 'QUICK_REPLY' ? 3 : 2) && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--xs"
                      onClick={handleAddButton}
                    >
                      ➕ Add {buttonType === 'QUICK_REPLY' ? 'Quick Reply' : 'Action Button'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={saving || !name || !bodyText}>
                {saving ? (
                  <><span className="spinner" style={{ width: 14, height: 14 }} /> Submitting to Meta...</>
                ) : (
                  '🚀 Submit to Meta for Approval'
                )}
              </button>
            </div>
          </form>

          {/* Right Live Preview */}
          <div style={{ position: 'sticky', top: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--clr-text-3)', marginBottom: 8, textTransform: 'uppercase' }}>
              📱 Live WhatsApp Preview
            </div>
            <WhatsAppPreview
              name={name}
              headerType={headerType}
              headerText={headerText}
              bodyText={bodyText}
              footerText={footerText}
              buttons={buttons}
              variables={bodyExamples}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
