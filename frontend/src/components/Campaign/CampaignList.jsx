import React, { useState, useEffect } from 'react';
import { listCampaigns, deleteCampaign, launchCampaign, pauseCampaign } from '../../api/campaigns.js';
import CampaignBuilder from './CampaignBuilder.jsx';
import CampaignReport from './CampaignReport.jsx';
import './Campaign.css';

const STATUS_BADGE = {
  draft:     'badge--gray',
  scheduled: 'badge--yellow',
  running:   'badge--blue',
  paused:    'badge--yellow',
  completed: 'badge--green',
  failed:    'badge--red',
};

export default function CampaignList() {
  const [campaigns,    setCampaigns]    = useState([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [showBuilder,  setShowBuilder]  = useState(false);
  const [viewReport,   setViewReport]   = useState(null);
  const [error,        setError]        = useState('');
  const [launching,    setLaunching]    = useState({});

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const data = await listCampaigns({ limit: 50 });
      setCampaigns(data.campaigns || []);
      setTotal(data.total || 0);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleLaunch(id) {
    if (!confirm('Launch this campaign? Messages will start sending immediately.')) return;
    setLaunching(l => ({ ...l, [id]: true }));
    try {
      await launchCampaign(id);
      setTimeout(loadCampaigns, 1500);
    } catch (err) { alert(err.message); }
    finally { setLaunching(l => ({ ...l, [id]: false })); }
  }

  async function handlePause(id) {
    try { await pauseCampaign(id); loadCampaigns(); }
    catch (err) { alert(err.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this campaign?')) return;
    try { await deleteCampaign(id); loadCampaigns(); }
    catch (err) { alert(err.message); }
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  if (viewReport) {
    return <CampaignReport campaignId={viewReport} onBack={() => { setViewReport(null); loadCampaigns(); }} />;
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>📣 WhatsApp Broadcast Campaigns</h1>
          <p>{total} campaigns total • Trigger template messages to targeted contact lists</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary btn--sm" onClick={() => { setEditingCampaign(null); setIsDuplicate(false); setShowBuilder(true); }}>+ New Campaign</button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : campaigns.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📣</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 6, color: 'var(--text-primary)' }}>No campaigns yet</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginBottom: 14 }}>Create your first WhatsApp campaign to start reaching customers.</p>
          <button className="btn btn--primary btn--sm" onClick={() => { setEditingCampaign(null); setIsDuplicate(false); setShowBuilder(true); }}>+ Create Campaign</button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table-compact">
            <thead>
              <tr>
                <th>Campaign Name</th>
                <th>Meta Template</th>
                <th>Phone Number</th>
                <th className="text-right">Recipients</th>
                <th className="text-center">Status</th>
                <th>Created At</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{c.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge--teal text-mono" style={{ fontSize: 11 }}>
                      {c.template_name}
                    </span>
                  </td>
                  <td className="text-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {c.waba_accounts?.display_number || '—'}
                  </td>
                  <td className="td-num td-mono" style={{ fontWeight: 600 }}>
                    {c.total_recipients?.toLocaleString() || 0}
                  </td>
                  <td className="text-center">
                    <span className={`badge ${STATUS_BADGE[c.status] || 'badge--gray'}`}>
                      {c.status === 'running' ? '⚡ ' : ''}{c.status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {formatDate(c.created_at)}
                  </td>
                  <td className="text-right">
                    <div style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn--secondary btn--xs" onClick={() => setViewReport(c.id)}>
                        📊 Report
                      </button>
                      {c.status === 'draft' && (
                        <button className="btn btn--primary btn--xs" onClick={() => handleLaunch(c.id)} disabled={launching[c.id]}>
                          {launching[c.id] ? '⏳' : '🚀 Launch'}
                        </button>
                      )}
                      {c.status === 'running' && (
                        <button className="btn btn--secondary btn--xs" onClick={() => handlePause(c.id)}>
                          ⏸ Pause
                        </button>
                      )}
                      {['paused', 'draft'].includes(c.status) && (
                        <button
                          className="btn btn--secondary btn--xs"
                          onClick={() => { setEditingCampaign(c); setIsDuplicate(false); setShowBuilder(true); }}
                          title="Edit Campaign"
                        >
                          ✏️ Edit
                        </button>
                      )}
                      <button
                        className="btn btn--secondary btn--xs"
                        onClick={() => { setEditingCampaign(c); setIsDuplicate(true); setShowBuilder(true); }}
                        title="Clone / Duplicate Campaign"
                      >
                        📋 Clone
                      </button>
                      {['paused', 'draft', 'failed', 'completed'].includes(c.status) && (
                        <button className="btn btn--danger btn--xs" onClick={() => handleDelete(c.id)} title="Delete">
                          ✕
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showBuilder && (
        <CampaignBuilder
          campaignToEdit={editingCampaign}
          isDuplicate={isDuplicate}
          onClose={() => { setShowBuilder(false); setEditingCampaign(null); setIsDuplicate(false); }}
          onCreated={() => { setShowBuilder(false); setEditingCampaign(null); setIsDuplicate(false); loadCampaigns(); }}
          onSuccess={() => { setShowBuilder(false); setEditingCampaign(null); setIsDuplicate(false); loadCampaigns(); }}
        />
      )}
    </div>
  );
}
