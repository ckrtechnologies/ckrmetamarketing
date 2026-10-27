import React, { useState, useEffect } from 'react';
import { listWabaAccounts, getWabaTemplates, deleteWabaTemplate } from '../../api/waba.js';
import TemplateBuilderModal from './TemplateBuilderModal.jsx';
import WhatsAppPreview from './WhatsAppPreview.jsx';
import './Templates.css';

export default function TemplatesPage() {
  const [wabaAccounts, setWabaAccounts] = useState([]);
  const [selectedWaba, setSelectedWaba] = useState(null);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Modals
  const [showBuilder, setShowBuilder] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [deletingName, setDeletingName] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const data = await listWabaAccounts();
      const accounts = data.accounts || [];
      setWabaAccounts(accounts);
      if (accounts.length > 0) {
        setSelectedWaba(accounts[0]);
        loadTemplates(accounts[0].id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function loadTemplates(wabaId) {
    if (!wabaId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getWabaTemplates(wabaId, { all: 'true' });
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleWabaChange(accId) {
    const acc = wabaAccounts.find(a => a.id === accId);
    if (!acc) return;
    setSelectedWaba(acc);
    loadTemplates(acc.id);
  }

  async function handleDelete(templateName) {
    if (!confirm(`Are you sure you want to permanently delete template "${templateName}" from Meta?`)) return;
    setDeletingName(templateName);
    try {
      await deleteWabaTemplate(selectedWaba.id, templateName);
      setTemplates(prev => prev.filter(t => t.name !== templateName));
    } catch (err) {
      alert('Failed to delete template: ' + err.message);
    } finally {
      setDeletingName(null);
    }
  }

  // Filtered Templates
  const filteredTemplates = templates.filter(t => {
    const s = String(t.status || '').toUpperCase();
    const c = String(t.category || '').toUpperCase();
    if (statusFilter !== 'ALL' && s !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && c !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const bodyText = t.components?.find(comp => comp.type === 'BODY')?.text || '';
      return (t.name || '').toLowerCase().includes(q) || bodyText.toLowerCase().includes(q);
    }
    return true;
  });

  // Status counts
  const counts = {
    ALL: templates.length,
    APPROVED: templates.filter(t => ['APPROVED', 'ACTIVE'].includes(String(t.status || '').toUpperCase())).length,
    PENDING: templates.filter(t => String(t.status || '').toUpperCase() === 'PENDING').length,
    REJECTED: templates.filter(t => String(t.status || '').toUpperCase() === 'REJECTED').length,
    PAUSED: templates.filter(t => String(t.status || '').toUpperCase() === 'PAUSED').length,
  };

  function getStatusBadge(status) {
    const s = String(status || '').toUpperCase();
    if (s === 'APPROVED' || s === 'ACTIVE') return <span className="badge badge--green">✅ Approved</span>;
    if (s === 'PENDING') return <span className="badge badge--yellow">⏳ In Review</span>;
    if (s === 'REJECTED') return <span className="badge badge--red">❌ Rejected</span>;
    if (s === 'PAUSED') return <span className="badge badge--yellow">⏸ Paused</span>;
    return <span className="badge badge--ghost">{String(status || '')}</span>;
  }

  function getQualityBadge(quality) {
    if (!quality) return null;
    const raw = typeof quality === 'object' ? quality?.score : quality;
    if (!raw || typeof raw !== 'string') return null;
    const q = raw.toUpperCase();
    if (q === 'GREEN') return <span className="badge badge--green" style={{ fontSize: 9.5 }}>High Quality</span>;
    if (q === 'YELLOW') return <span className="badge badge--yellow" style={{ fontSize: 9.5 }}>Medium Quality</span>;
    if (q === 'RED') return <span className="badge badge--red" style={{ fontSize: 9.5 }}>Low Quality</span>;
    return null;
  }

  return (
    <div className="templates-container">
      {/* Top Header */}
      <div className="templates-header">
        <div className="templates-title">
          <h1>📑 WhatsApp Message Templates</h1>
          <p>Create, manage, and monitor approved Meta Cloud API templates without leaving your dashboard.</p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {wabaAccounts.length > 1 && (
            <select
              className="form-select"
              style={{ width: 180, padding: '5px 10px', fontSize: 12 }}
              value={selectedWaba?.id || ''}
              onChange={e => handleWabaChange(e.target.value)}
            >
              {wabaAccounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.display_name || a.display_number}
                </option>
              ))}
            </select>
          )}

          <button
            className="btn btn--secondary btn--sm"
            onClick={() => loadTemplates(selectedWaba?.id)}
            disabled={loading || !selectedWaba}
            title="Fetch latest statuses from Meta"
          >
            🔄 Sync with Meta
          </button>

          <button
            className="btn btn--primary btn--sm"
            onClick={() => setShowBuilder(true)}
            disabled={!selectedWaba}
          >
            ✨ Create Template
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert--danger" style={{ marginBottom: 10, fontSize: 12 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Filters Bar */}
      <div className="templates-filters">
        <div className="templates-tabs">
          {[
            { key: 'ALL', label: 'All Templates' },
            { key: 'APPROVED', label: 'Approved' },
            { key: 'PENDING', label: 'In Review' },
            { key: 'REJECTED', label: 'Rejected' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`template-tab-btn ${statusFilter === tab.key ? 'template-tab-btn--active' : ''}`}
              onClick={() => setStatusFilter(tab.key)}
            >
              <span>{tab.label}</span>
              <span className="template-tab-count">{counts[tab.key] || 0}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="form-select"
            style={{ width: 130, padding: '5px 8px', fontSize: 12 }}
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            <option value="MARKETING">Marketing</option>
            <option value="UTILITY">Utility</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>

          <input
            className="form-input"
            style={{ width: 200, padding: '5px 10px', fontSize: 12 }}
            placeholder="🔍 Search templates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Templates Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <span className="spinner" style={{ width: 28, height: 28, margin: '0 auto 12px' }} />
          <div style={{ color: 'var(--text-secondary, #475569)', fontSize: 13 }}>Loading templates from Meta...</div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-default, #e2e8f0)', background: 'var(--bg-surface, #ffffff)', width: '100%' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📝</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: 4 }}>
            No message templates found
          </div>
          <p style={{ color: 'var(--text-secondary, #475569)', fontSize: 12.5, maxWidth: 460, margin: '0 auto 16px' }}>
            {search || statusFilter !== 'ALL'
              ? 'Try adjusting your search query or status filter.'
              : 'Create your first WhatsApp template and submit it directly to Meta for instant approval.'}
          </p>
          <button className="btn btn--primary btn--sm" onClick={() => setShowBuilder(true)}>
            ✨ Create New Template
          </button>
        </div>
      ) : (
        <div className="templates-grid">
          {filteredTemplates.map(t => {
            const bodyComp = t.components?.find(c => c.type === 'BODY');
            const headerComp = t.components?.find(c => c.type === 'HEADER');
            const buttonsComp = t.components?.find(c => c.type === 'BUTTONS');

            return (
              <div key={t.id || t.name} className="template-card">
                <div>
                  <div className="template-card-top">
                    <div>
                      <div className="template-card-name">{t.name}</div>
                      <div className="template-card-cat">
                        <span>{t.category || 'MARKETING'}</span>
                        <span>•</span>
                        <span>{(typeof t.language === 'string' ? t.language : t.language?.code || 'EN').toUpperCase()}</span>
                        {getQualityBadge(t.quality_score)}
                      </div>
                    </div>
                    <div>{getStatusBadge(t.status)}</div>
                  </div>

                  {/* Rejection notice if rejected */}
                  {t.rejected_reason && (
                    <div className="alert alert--danger" style={{ fontSize: 11, padding: '6px 10px', marginBottom: 10 }}>
                      ⚠️ Rejection Reason: {t.rejected_reason}
                    </div>
                  )}

                  {/* Preview Box */}
                  <div className="template-card-preview">
                    {headerComp && headerComp.text && (
                      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary, #0f172a)' }}>
                        {headerComp.text}
                      </div>
                    )}
                    {headerComp && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(headerComp.format) && (
                      <div style={{ fontSize: 11, color: '#047857', marginBottom: 4 }}>
                        [{headerComp.format.toLowerCase()} header]
                      </div>
                    )}
                    {bodyComp?.text || '—'}
                  </div>
                </div>

                <div>
                  <div className="template-card-footer-info">
                    <span>
                      {buttonsComp?.buttons?.length ? `🔘 ${buttonsComp.buttons.length} Buttons` : 'No Buttons'}
                    </span>
                    <span>Meta ID: {t.id ? t.id.substring(0, 10) + '...' : '—'}</span>
                  </div>

                  <div className="template-card-actions">
                    <button
                      className="btn btn--secondary btn--xs"
                      onClick={() => setPreviewTemplate(t)}
                    >
                      👁️ Preview
                    </button>

                    <button
                      className="btn btn--ghost btn--xs"
                      style={{ color: 'var(--clr-danger)' }}
                      onClick={() => handleDelete(t.name)}
                      disabled={deletingName === t.name}
                      title="Delete from Meta"
                    >
                      {deletingName === t.name ? '⏳' : '🗑️ Delete'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Creation Modal */}
      {showBuilder && selectedWaba && (
        <TemplateBuilderModal
          wabaId={selectedWaba.id}
          onClose={() => setShowBuilder(false)}
          onSuccess={() => {
            setShowBuilder(false);
            loadTemplates(selectedWaba.id);
          }}
        />
      )}

      {/* View Preview Modal */}
      {previewTemplate && (
        <div className="modal-overlay" onClick={() => setPreviewTemplate(null)}>
          <div className="modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title" style={{ margin: 0 }}>
                📱 {previewTemplate.name}
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => setPreviewTemplate(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <WhatsAppPreview
                name={previewTemplate.name}
                headerType={previewTemplate.components?.find(c => c.type === 'HEADER')?.format || 'NONE'}
                headerText={previewTemplate.components?.find(c => c.type === 'HEADER')?.text || ''}
                bodyText={previewTemplate.components?.find(c => c.type === 'BODY')?.text || ''}
                footerText={previewTemplate.components?.find(c => c.type === 'FOOTER')?.text || ''}
                buttons={previewTemplate.components?.find(c => c.type === 'BUTTONS')?.buttons || []}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
