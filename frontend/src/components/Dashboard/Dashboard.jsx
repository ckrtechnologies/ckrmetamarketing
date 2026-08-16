import React, { useState, useEffect } from 'react';
import { getAllAnalytics } from '../../api/analytics.js';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function fmtDay(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a2540', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '9px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 5, color: '#f0f4ff' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 6 }}>
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <strong style={{ color: '#f0f4ff' }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard({ user, org }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllAnalytics(7)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats  = data?.stats  || {};
  const funnel = data?.funnel || {};
  const chartData = (data?.dailyCampaigns || []).map(d => ({ ...d, date: fmtDay(d.date) }));

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>👋 Welcome, {user?.name?.split(' ')[0] || 'there'}!</h1>
          <p>Here's your WhatsApp campaign overview for the last 7 days.</p>
        </div>
        <div className="page-header__actions">
          <a href="/campaigns" className="btn btn--primary btn--sm">+ New Campaign</a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Campaigns',  value: stats.total_campaigns,    color: '#6366f1', icon: '📣' },
          { label: 'Messages Sent',    value: stats.total_recipients,   color: '#25D366', icon: '📤' },
          { label: 'Total Contacts',   value: stats.total_contacts,     color: '#22c55e', icon: '👥' },
          { label: 'Open Chats',       value: stats.open_conversations, color: '#f59e0b', icon: '💬' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-card__label">{s.icon} {s.label}</div>
            <div className="stat-card__value" style={{ color: s.color }}>
              {loading ? '—' : (s.value ?? 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Delivery rates row */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Delivery Rate', value: `${funnel.delivery_rate ?? 0}%`, color: '#22c55e', icon: '✅', sub: `${(funnel.delivered || 0).toLocaleString()} delivered` },
          { label: 'Read Rate',     value: `${funnel.read_rate ?? 0}%`,     color: '#25D366', icon: '👁', sub: `${(funnel.read || 0).toLocaleString()} read` },
          { label: 'Failed',        value: (funnel.failed || 0).toLocaleString(), color: '#ef4444', icon: '❌', sub: 'delivery failures' },
          { label: 'Active Now',    value: stats.active_campaigns || 0, color: '#f59e0b', icon: '⚡', sub: 'campaigns running' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-card__label">{s.icon} {s.label}</div>
            <div className="stat-card__value" style={{ color: s.color, fontSize: 24 }}>
              {loading ? '—' : s.value}
            </div>
            <div className="stat-card__sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card" style={{ marginBottom: 20, padding: '20px 24px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: 16, color: 'var(--clr-text)' }}>
          📊 Campaign Volume — Last 7 Days
        </div>
        {loading ? (
          <div style={{ height: 180, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />
        ) : chartData.every(d => d.sent === 0 && d.delivered === 0) ? (
          <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--clr-text-3)', fontSize: 13 }}>
            No campaign data yet. <a href="/campaigns" style={{ color: 'var(--clr-primary)', marginLeft: 6, fontWeight: 600 }}>Launch your first campaign →</a>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="db-sent"      x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                <linearGradient id="db-delivered" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="sent"      name="Sent"      stroke="#6366f1" fill="url(#db-sent)"      strokeWidth={2} />
              <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#22c55e" fill="url(#db-delivered)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quick links */}
      <div className="stat-grid">
        {[
          { icon: '📣', title: 'Create Campaign', desc: 'Send bulk WhatsApp messages', href: '/campaigns', btn: 'New Campaign', color: '#25D366' },
          { icon: '👥', title: 'Import Contacts', desc: 'Upload CSV or add manually', href: '/contacts', btn: 'Manage Contacts', color: '#6366f1' },
          { icon: '💬', title: 'Live Chat', desc: 'Reply to incoming messages', href: '/chat', btn: 'Open Inbox', color: '#f59e0b' },
          { icon: '📈', title: 'Analytics', desc: 'Delivery & read rate reports', href: '/reports', btn: 'View Reports', color: '#22c55e' },
        ].map(q => (
          <div key={q.title} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 28 }}>{q.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--clr-text)' }}>{q.title}</div>
            <div style={{ fontSize: 12, color: 'var(--clr-text-2)', flex: 1 }}>{q.desc}</div>
            <a href={q.href} className="btn btn--secondary btn--sm" style={{ width: '100%', justifyContent: 'center', borderColor: q.color + '44', color: q.color }}>
              {q.btn} →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
