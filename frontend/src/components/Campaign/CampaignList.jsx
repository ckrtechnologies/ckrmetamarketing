import React, { useState, useEffect } from 'react';
import { listCampaigns, deleteCampaign, launchCampaign, pauseCampaign } from '../../api/campaigns.js';
import CampaignBuilder from './CampaignBuilder.jsx';
import CampaignReport from './CampaignReport.jsx';
import './Campaign.css';

const STATUS_BADGE = {
  draft:     'badge--gray',
  scheduled: 'badge--blue',
  running:   'badge--yellow',
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
    return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  if (viewReport) {
    return <CampaignReport campaignId={viewReport} onBack={() => { setViewReport(null); loadCampaigns(); }} />;
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>📣 Campaigns</h1>
          <p>{total} campaigns total</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => setShowBuilder(true)}>+ New Campaign</button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : campaigns.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>📣</div>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>No campaigns yet</h2>
          <p style={{ color: 'var(--clr-text-2)', marginBottom: 20 }}>Create your first WhatsApp campaign to start reaching customers.</p>
          <button className="btn btn--primary btn--lg" onClick={() => setShowBuilder(true)}>+ Create Campaign</button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Campaign Name</th>
                <th>Template</th>
                <th>Number</th>
                <th>Recipients</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700 }}>{c.name}</td>
                  <td><code style={{ fontSize: 11, color: 'var(--clr-primary)' }}>{c.template_name}</code></td>
                  <td style={{ fontSize: 12, color: 'var(--clr-text-2)' }}>
                    {c.waba_accounts?.display_number || '—'}
                  </td>
                  <td style={{ fontWeight: 600 }}>{c.total_recipients?.toLocaleString() || 0}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[c.status] || 'badge--gray'}`}>
                      {c.status === 'running' ? '⚡ ' : ''}{c.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--clr-text-3)' }}>{formatDate(c.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn--secondary btn--sm" onClick={() => setViewReport(c.id)}>📊 Report</button>
                      {c.status === 'draft' && (
                        <button className="btn btn--primary btn--sm" onClick={() => handleLaunch(c.id)} disabled={launching[c.id]}>
                          {launching[c.id] ? '⏳' : '🚀 Launch'}
                        </button>
                      )}
                      {c.status === 'running' && (
                        <button className="btn btn--secondary btn--sm" onClick={() => handlePause(c.id)}>⏸ Pause</button>
                      )}
                      {['paused', 'draft'].includes(c.status) && (
                        <button className="btn btn--danger btn--sm" onClick={() => handleDelete(c.id)}>✕</button>
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
        <CampaignBuilder onClose={() => setShowBuilder(false)} onCreated={() => { setShowBuilder(false); loadCampaigns(); }} />
      )}
    </div>
  );
}
