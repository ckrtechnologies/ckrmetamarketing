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
    if (statusFilter !== 'ALL' && t.status?.toUpperCase() !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && t.category?.toUpperCase() !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const bodyText = t.components?.find(c => c.type === 'BODY')?.text || '';
      return t.name.toLowerCase().includes(q) || bodyText.toLowerCase().includes(q);
    }
    return true;
  });

  // Status counts
  const counts = {
    ALL: templates.length,
    APPROVED: templates.filter(t => ['APPROVED', 'ACTIVE'].includes(t.status?.toUpperCase())).length,
    PENDING: templates.filter(t => t.status?.toUpperCase() === 'PENDING').length,
    REJECTED: templates.filter(t => t.status?.toUpperCase() === 'REJECTED').length,
    PAUSED: templates.filter(t => t.status?.toUpperCase() === 'PAUSED').length,
  };

  function getStatusBadge(status) {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED' || s === 'ACTIVE') return <span className="badge badge--green">✅ Approved</span>;
    if (s === 'PENDING') return <span className="badge badge--yellow">⏳ In Review</span>;
    if (s === 'REJECTED') return <span className="badge badge--red">❌ Rejected</span>;
    if (s === 'PAUSED') return <span className="badge badge--yellow">⏸ Paused</span>;
    return <span className="badge badge--ghost">{status}</span>;
  }

  function getQualityBadge(quality) {
    if (!quality) return null;
    const q = quality.toUpperCase();
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

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {wabaAccounts.length > 1 && (
            <select
              className="form-select"
              style={{ width: 200, padding: '8px 12px' }}
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
            className="btn btn--secondary"
            onClick={() => loadTemplates(selectedWaba?.id)}
            disabled={loading || !selectedWaba}
            title="Fetch latest statuses from Meta"
          >
            🔄 Sync with Meta
          </button>

          <button
            className="btn btn--primary"
            onClick={() => setShowBuilder(true)}
            disabled={!selectedWaba}
          >
            ✨ Create Template
          </button>
        </div>
      </div>

      {error && <div className="alert alert--danger" style={{ marginBottom: 20 }}>{error}</div>}

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

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            className="form-select"
            style={{ width: 140, padding: '6px 10px', fontSize: 12.5 }}
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
            style={{ width: 220, padding: '6px 12px', fontSize: 13 }}
            placeholder="🔍 Search templates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Templates Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <span className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
          <div style={{ color: 'var(--clr-text-2)', fontSize: 14 }}>Loading templates from Meta...</div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: 16 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
            No message templates found
          </div>
          <p style={{ color: 'var(--clr-text-3)', fontSize: 13.5, maxWidth: 420, margin: '0 auto 20px' }}>
            {search || statusFilter !== 'ALL'
              ? 'Try adjusting your search query or status filter.'
              : 'Create your first WhatsApp template and submit it directly to Meta for instant approval.'}
          </p>
          <button className="btn btn--primary" onClick={() => setShowBuilder(true)}>
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
                        <span>{t.language?.toUpperCase() || 'EN'}</span>
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
                      <div style={{ fontWeight: 700, marginBottom: 4, color: '#fff' }}>
                        {headerComp.text}
                      </div>
                    )}
                    {headerComp && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(headerComp.format) && (
                      <div style={{ fontSize: 11, color: '#25d366', marginBottom: 4 }}>
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
