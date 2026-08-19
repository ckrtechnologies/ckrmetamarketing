import React, { useState, useEffect } from 'react';
import { getCampaignReport, exportCampaignCSV } from '../../api/campaigns.js';

export default function CampaignReport({ campaignId, onBack }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('');

  useEffect(() => {
    load();
    const t = setInterval(() => {
      // Re-fetch always, or use a ref. Since we want live updates, just fetch.
      // The backend handles it quickly. If the campaign is done, we could clear it,
      // but for now, just fetch unconditionally every 10s to ensure fresh data.
      load();
    }, 10000);
    return () => clearInterval(t);
  }, [campaignId]);

  async function load() {
    try {
      const d = await getCampaignReport(campaignId);
      setData(d);
    } catch (e) {}
    finally { setLoading(false); }
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!data) return <div className="alert alert--error">Failed to load report</div>;

  const { campaign, stats, recipients = [] } = data;
  const filtered = filter ? recipients.filter(r => (r.status || '').toLowerCase() === filter.toLowerCase()) : recipients;
  const deliveryPct = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
  const readPct     = stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0;

  function fmt(d) { return d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'; }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>📊 {campaign.name}</h1>
          <p>Delivery report — live updates every 5s</p>
        </div>
        <div className="page-header__actions">
          <a href={exportCampaignCSV(campaignId)} className="btn btn--secondary btn--sm" download>📥 Export CSV</a>
          <button className="btn btn--ghost btn--sm" onClick={onBack}>← Back</button>
        </div>
      </div>

      {/* Funnel stats */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total', value: stats.total,     color: 'var(--clr-text)',    filter: '' },
          { label: 'Sent', value: stats.sent,        color: '#6366f1',            filter: 'sent' },
          { label: 'Delivered', value: stats.delivered, color: '#22c55e',        filter: 'delivered' },
          { label: 'Read', value: stats.read,         color: 'var(--clr-primary)', filter: 'read' },
          { label: 'Failed', value: stats.failed,     color: 'var(--clr-danger)', filter: 'failed' },
          { label: 'Pending', value: stats.pending,   color: '#94a3b8',           filter: 'pending' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ cursor: 'pointer', borderColor: filter === s.filter ? s.color : '' }} onClick={() => setFilter(filter === s.filter ? '' : s.filter)}>
            <div className="stat-card__label">{s.label}</div>
            <div className="stat-card__value" style={{ color: s.color }}>{(s.value || 0).toLocaleString()}</div>
            {s.label === 'Delivered' && <div className="stat-card__sub">{deliveryPct}% delivery rate</div>}
            {s.label === 'Read' && <div className="stat-card__sub">{readPct}% read rate</div>}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div className="card" style={{ marginBottom: 20, padding: '14px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: 'var(--clr-text-2)' }}>
            <span>Overall Progress</span>
            <span>{stats.total - (stats.pending || 0)} / {stats.total} processed</span>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${deliveryPct}%`, background: 'linear-gradient(90deg, var(--clr-primary-dk), var(--clr-primary))', borderRadius: 10, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      )}

      {/* Recipients table */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Phone</th><th>Status</th><th>Sent</th><th>Delivered</th><th>Read</th><th>Error</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--clr-text-3)' }}>
                  No recipients match this filter.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 200).map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>+{r.phone}</td>
                  <td>
                    <span className={`badge ${r.status === 'delivered' || r.status === 'read' ? 'badge--green' : r.status === 'failed' ? 'badge--red' : r.status === 'sent' ? 'badge--blue' : 'badge--gray'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--clr-text-3)' }}>{fmt(r.sent_at)}</td>
                  <td style={{ fontSize: 12, color: 'var(--clr-text-3)' }}>{fmt(r.delivered_at)}</td>
                  <td style={{ fontSize: 12, color: 'var(--clr-text-3)' }}>{fmt(r.read_at)}</td>
                  <td style={{ fontSize: 11, color: 'var(--clr-danger)' }}>{r.error_msg || ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filtered.length > 200 && <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--clr-text-3)' }}>Showing 200 of {filtered.length} — export CSV for full list</div>}
      </div>
    </div>
  );
}
