import React, { useState, useEffect } from 'react';
import { getCampaignReport, exportCampaignCSV } from '../../api/campaigns.js';

export default function CampaignReport({ campaignId, onBack }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('');

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    load();
  }, [campaignId]);

  async function load() {
    try {
      const d = await getCampaignReport(campaignId);
      setData(d);
    } catch (e) {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleManualRefresh() {
    setRefreshing(true);
    load();
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!data) return <div className="alert alert--error">Failed to load report</div>;

  const { campaign, stats, recipients = [] } = data;
  const filtered = filter ? recipients.filter(r => (r.status || '').toLowerCase() === filter.toLowerCase()) : recipients;
  const deliveryPct = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
  const readPct     = stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0;

  function fmt(d) {
    if (!d) return '—';
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>📊 Campaign Report: {campaign.name}</h1>
          <p>Real-time delivery & read receipts from Meta WhatsApp Cloud API</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--secondary btn--sm" onClick={handleManualRefresh} disabled={refreshing}>
            {refreshing ? '⏳ Refreshing...' : '🔄 Refresh'}
          </button>
          <a href={exportCampaignCSV(campaignId)} className="btn btn--secondary btn--sm" download>📥 Export CSV</a>
          <button className="btn btn--ghost btn--sm" onClick={onBack}>← Back to Campaigns</button>
        </div>
      </div>

      {/* Funnel KPI Row */}
      <div className="stat-grid" style={{ marginBottom: 14 }}>
        {[
          { label: 'Total',     value: stats.total,     color: '#0f172a', bg: '#f1f5f9', filter: '' },
          { label: 'Sent',      value: stats.sent,      color: '#2563eb', bg: '#eff6ff', filter: 'sent' },
          { label: 'Delivered', value: stats.delivered, color: '#059669', bg: '#ecfdf5', filter: 'delivered', sub: `${deliveryPct}% rate` },
          { label: 'Read',      value: stats.read,      color: '#00a884', bg: '#e6f7f3', filter: 'read', sub: `${readPct}% rate` },
          { label: 'Failed',    value: stats.failed,    color: '#dc2626', bg: '#fef2f2', filter: 'failed' },
          { label: 'Pending',   value: stats.pending,   color: '#64748b', bg: '#f8fafc', filter: 'pending' },
        ].map(s => (
          <div
            key={s.label}
            className="stat-card"
            style={{
              cursor: 'pointer',
              borderWidth: filter === s.filter ? '2px' : '1px',
              borderColor: filter === s.filter ? s.color : 'var(--border-default)',
              padding: '10px 12px'
            }}
            onClick={() => setFilter(filter === s.filter ? '' : s.filter)}
          >
            <div className="stat-card__label">
              <span>{s.label}</span>
              {filter === s.filter && <span style={{ fontSize: 9, color: s.color, fontWeight: 700 }}>● FILTERED</span>}
            </div>
            <div className="stat-card__value" style={{ color: s.color, fontSize: 20 }}>
              {(s.value || 0).toLocaleString()}
            </div>
            {s.sub && <div className="stat-card__sub">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div className="card" style={{ marginBottom: 14, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600 }}>Delivery Progress</span>
            <span className="text-mono">{stats.total - (stats.pending || 0)} / {stats.total} processed ({deliveryPct}%)</span>
          </div>
          <div style={{ height: 6, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${deliveryPct}%`,
                background: 'var(--clr-primary)',
                borderRadius: 6,
                transition: 'width 0.4s ease'
              }}
            />
          </div>
        </div>
      )}

      {/* Recipients high-density table */}
      <div className="table-wrap">
        <table className="table-compact">
          <thead>
            <tr>
              <th>Recipient Phone</th>
              <th className="text-center">Status</th>
              <th>Sent Time</th>
              <th>Delivered Time</th>
              <th>Read Time</th>
              <th>Meta Error Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)' }}>
                  No recipients match this filter.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 250).map(r => (
                <tr key={r.id}>
                  <td className="text-mono" style={{ fontSize: 12, fontWeight: 500 }}>
                    +{r.phone}
                  </td>
                  <td className="text-center">
                    <span className={`badge ${
                      r.status === 'read' ? 'badge--purple' :
                      r.status === 'delivered' ? 'badge--green' :
                      r.status === 'sent' ? 'badge--blue' :
                      r.status === 'failed' ? 'badge--red' : 'badge--gray'
                    }`}>
                      {r.status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{fmt(r.sent_at)}</td>
                  <td className="text-mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{fmt(r.delivered_at)}</td>
                  <td className="text-mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{fmt(r.read_at)}</td>
                  <td style={{ fontSize: 11.5, color: r.error_msg ? 'var(--clr-danger)' : 'var(--text-muted)' }}>
                    {r.error_msg || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filtered.length > 250 && (
          <div style={{ padding: '8px 12px', fontSize: 11.5, color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}>
            Showing top 250 of {filtered.length} recipients. Export CSV for the full audit log.
          </div>
        )}
      </div>
    </div>
  );
}
