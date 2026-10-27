import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { getAllAnalytics } from '../../api/analytics.js';
import './Reports.css';

const FUNNEL_COLORS = {
  sent:      '#6366f1',
  delivered: '#22c55e',
  read:      '#25D366',
  failed:    '#ef4444',
  pending:   '#64748b',
};

const CHART_THEME = {
  grid: '#f1f5f9',
  axis: '#64748b',
  tooltip: { background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a' },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#0f172a' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#64748b' }}>{p.name}:</span>
          <strong style={{ color: '#0f172a' }}>{p.value?.toLocaleString()}</strong>
        </div>
      ))}
    </div>
  );
};

function fmtDay(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function FunnelBars({ funnel }) {
  const total = funnel.total || 1;
  const items = [
    { label: 'Sent',      value: (funnel.sent || 0) + (funnel.delivered || 0) + (funnel.read || 0), color: '#6366f1' },
    { label: 'Delivered', value: (funnel.delivered || 0) + (funnel.read || 0),                      color: '#22c55e' },
    { label: 'Read',      value: funnel.read || 0,                                                  color: '#25D366' },
    { label: 'Failed',    value: funnel.failed || 0,                                                color: '#ef4444' },
  ];

  return (
    <div className="funnel-bars">
      {items.map(item => (
        <div key={item.label} className="funnel-row">
          <span className="funnel-label">{item.label}</span>
          <div className="funnel-bar-wrap">
            <div className="funnel-bar" style={{ width: `${Math.min((item.value / total) * 100, 100)}%`, background: item.color }} />
          </div>
          <span className="funnel-value">{item.value.toLocaleString()}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
        <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
          Delivery rate: <strong style={{ color: '#22c55e' }}>{funnel.delivery_rate ?? 0}%</strong>
        </div>
        <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
          Read rate: <strong style={{ color: '#25D366' }}>{funnel.read_rate ?? 0}%</strong>
        </div>
      </div>
    </div>
  );
}

function RateBar({ value, color }) {
  return (
    <div className="rate-bar">
      <div className="rate-bar__track">
        <div className="rate-bar__fill" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
      <span className="rate-bar__label" style={{ color }}>{value}%</span>
    </div>
  );
}

export default function ReportsPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [days,    setDays]    = useState(14);
  const [error,   setError]   = useState('');

  useEffect(() => { load(); }, [days]);

  async function load() {
    setLoading(true);
    try {
      const d = await getAllAnalytics(days);
      setData(d);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  const stats    = data?.stats    || {};
  const funnel   = data?.funnel   || {};
  const dailyMsgs= data?.dailyMessages || [];
  const dailyCamp= data?.dailyCampaigns || [];
  const templates= data?.templates || [];
  const campaigns= data?.campaigns || [];

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>📈 Analytics</h1>
          <p>Campaign performance, message volume, and delivery insights.</p>
        </div>
        <div className="page-header__actions">
          <div className="day-picker">
            {[7, 14, 30].map(d => (
              <button key={d} className={`day-picker-btn${days === d ? ' day-picker-btn--active' : ''}`} onClick={() => setDays(d)}>
                {d}d
              </button>
            ))}
          </div>
          <button className="btn btn--secondary btn--sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {/* ── Overview KPI Cards ── */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Campaigns',    value: stats.total_campaigns,     color: '#6366f1', icon: '📣' },
          { label: 'Messages Sent',      value: stats.total_recipients,    color: '#25D366', icon: '📤' },
          { label: 'Total Contacts',     value: stats.total_contacts,      color: '#22c55e', icon: '👥' },
          { label: 'Live Conversations', value: stats.open_conversations,  color: '#f59e0b', icon: '💬' },
          { label: 'Delivery Rate',      value: `${funnel.delivery_rate ?? 0}%`, color: '#22c55e', icon: '✅' },
          { label: 'Read Rate',          value: `${funnel.read_rate ?? 0}%`,     color: '#25D366', icon: '👁' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-card__label">{s.icon} {s.label}</div>
            <div className="stat-card__value" style={{ color: s.color, fontSize: 26 }}>
              {loading ? <div className="skeleton" style={{ height: 26, width: 60 }} /> : (s.value ?? 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="reports-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`chart-card ${i < 2 ? 'col-6' : 'col-6'}`}>
              <div className="skeleton" style={{ height: 220 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="reports-grid">

          {/* ── Campaign Volume Area Chart ── */}
          <div className="chart-card col-8">
            <div className="chart-card__header">
              <div>
                <div className="chart-card__title">📤 Campaign Delivery Volume</div>
                <div className="chart-card__sub">Messages sent by status — last {days} days</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyCamp.map(d => ({ ...d, date: fmtDay(d.date) }))}>
                <defs>
                  <linearGradient id="g-sent"      x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                  <linearGradient id="g-delivered" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
                  <linearGradient id="g-read"      x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#25D366" stopOpacity={0.3}/><stop offset="95%" stopColor="#25D366" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="sent"      name="Sent"      stroke="#6366f1" fill="url(#g-sent)"      strokeWidth={2} />
                <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#22c55e" fill="url(#g-delivered)"  strokeWidth={2} />
                <Area type="monotone" dataKey="read"      name="Read"      stroke="#25D366" fill="url(#g-read)"      strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Delivery Funnel ── */}
          <div className="chart-card col-4">
            <div className="chart-card__header">
              <div>
                <div className="chart-card__title">🔽 Delivery Funnel</div>
                <div className="chart-card__sub">All-time across {stats.total_campaigns} campaigns</div>
              </div>
            </div>
            <FunnelBars funnel={funnel} />
            <div style={{ padding: '8px 0 0', borderTop: '1px solid var(--clr-border)' }}>
              {[
                { label: 'Total Sent',    v: funnel.total || 0,     c: '#f0f4ff' },
                { label: 'Failed',        v: funnel.failed || 0,    c: '#ef4444' },
                { label: 'Pending',       v: funnel.pending || 0,   c: '#64748b' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: '#94a3b8' }}>
                  <span>{s.label}</span><strong style={{ color: s.c }}>{s.v.toLocaleString()}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* ── Live Chat Volume ── */}
          <div className="chart-card col-6">
            <div className="chart-card__header">
              <div>
                <div className="chart-card__title">💬 Live Chat Volume</div>
                <div className="chart-card__sub">Inbound vs outbound messages — last {days} days</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyMsgs.map(d => ({ ...d, date: fmtDay(d.date) }))} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tick={{ fill: CHART_THEME.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="inbound"  name="Inbound"  fill="#25D366" radius={[3,3,0,0]} />
                <Bar dataKey="outbound" name="Outbound" fill="#6366f1" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Top Templates ── */}
          <div className="chart-card col-6">
            <div className="chart-card__header">
              <div>
                <div className="chart-card__title">📝 Top Templates</div>
                <div className="chart-card__sub">By messages sent — delivery & read rates</div>
              </div>
            </div>
            {templates.length === 0 ? (
              <div style={{ color: 'var(--clr-text-3)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                No template data yet. Launch a campaign!
              </div>
            ) : (
              <div className="template-grid">
                <div className="tpl-row" style={{ borderBottom: '1px solid var(--clr-border)' }}>
                  <span style={{ fontSize: 10.5, color: 'var(--clr-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Template</span>
                  <span style={{ fontSize: 10.5, color: 'var(--clr-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Sent</span>
                  <span style={{ fontSize: 10.5, color: 'var(--clr-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Delivery</span>
                  <span style={{ fontSize: 10.5, color: 'var(--clr-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Read</span>
                </div>
                {templates.map((t, i) => (
                  <div key={t.template_name} className="tpl-row">
                    <span className="tpl-name" title={t.template_name}>{t.template_name}</span>
                    <span className="tpl-stat">{(t.total_sent || 0).toLocaleString()}</span>
                    <span className="tpl-rate" style={{ color: '#22c55e' }}>{t.delivery_rate}%</span>
                    <span className="tpl-rate" style={{ color: '#25D366' }}>{t.read_rate}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Campaign Performance Table ── */}
          <div className="chart-card col-12">
            <div className="chart-card__header">
              <div>
                <div className="chart-card__title">📣 Campaign Performance</div>
                <div className="chart-card__sub">Recent campaigns with delivery and read rates</div>
              </div>
            </div>
            {campaigns.length === 0 ? (
              <div style={{ color: 'var(--clr-text-3)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                No completed campaigns yet.
              </div>
            ) : (
              <table className="perf-table">
                <thead>
                  <tr>
                    <th>Campaign</th><th>Template</th><th>Status</th>
                    <th>Recipients</th><th>Delivery Rate</th><th>Read Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700 }}>{c.name}</td>
                      <td><code style={{ fontSize: 11, color: 'var(--clr-primary)' }}>{c.template_name}</code></td>
                      <td>
                        <span className={`badge ${c.status === 'completed' ? 'badge--green' : c.status === 'running' ? 'badge--yellow' : 'badge--gray'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{(c.total_recipients || 0).toLocaleString()}</td>
                      <td style={{ minWidth: 130 }}><RateBar value={c.delivery_rate} color="#22c55e" /></td>
                      <td style={{ minWidth: 130 }}><RateBar value={c.read_rate} color="#25D366" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
