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
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#0f172a' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 6, fontSize: 11.5 }}>
          <span style={{ color: '#64748b' }}>{p.name}:</span>
          <strong style={{ color: '#0f172a' }}>{p.value?.toLocaleString()}</strong>
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
          <p>Real-time WhatsApp campaign metrics & delivery performance for {org?.name || 'your workspace'}.</p>
        </div>
        <div className="page-header__actions">
          <a href="/campaigns" className="btn btn--primary btn--sm">+ New Campaign</a>
        </div>
      </div>

      {/* Primary KPI Row (Compact 80px Cards) */}
      <div className="stat-grid" style={{ marginBottom: 12 }}>
        {[
          { label: 'Total Campaigns',  value: stats.total_campaigns,    color: '#4f46e5', bg: '#eef2ff', icon: '📣' },
          { label: 'Messages Sent',    value: stats.total_recipients,   color: '#059669', bg: '#ecfdf5', icon: '📤' },
          { label: 'Total Contacts',   value: stats.total_contacts,     color: '#2563eb', bg: '#eff6ff', icon: '👥' },
          { label: 'Open Chats',       value: stats.open_conversations, color: '#d97706', bg: '#fffbeb', icon: '💬' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-card__label">
              <span>{s.label}</span>
              <span className="sidebar-icon-tile" style={{ width: 22, height: 22, background: s.bg, color: s.color, fontSize: 11 }}>
                {s.icon}
              </span>
            </div>
            <div className="stat-card__value" style={{ color: s.color }}>
              {loading ? '—' : (s.value ?? 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Delivery Rates Row */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        {[
          { label: 'Delivery Rate', value: `${funnel.delivery_rate ?? 0}%`, color: '#059669', bg: '#ecfdf5', icon: '✅', sub: `${(funnel.delivered || 0).toLocaleString()} delivered` },
          { label: 'Read Rate',     value: `${funnel.read_rate ?? 0}%`,     color: '#00a884', bg: '#e6f7f3', icon: '👁', sub: `${(funnel.read || 0).toLocaleString()} read` },
          { label: 'Failed',        value: (funnel.failed || 0).toLocaleString(), color: '#dc2626', bg: '#fef2f2', icon: '❌', sub: 'delivery failures' },
          { label: 'Active Now',    value: stats.active_campaigns || 0, color: '#d97706', bg: '#fffbeb', icon: '⚡', sub: 'campaigns running' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-card__label">
              <span>{s.label}</span>
              <span className="sidebar-icon-tile" style={{ width: 22, height: 22, background: s.bg, color: s.color, fontSize: 11 }}>
                {s.icon}
              </span>
            </div>
            <div className="stat-card__value" style={{ color: s.color }}>
              {loading ? '—' : s.value}
            </div>
            <div className="stat-card__sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Campaign Volume Chart */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
            📊 Campaign Volume Trend (Last 7 Days)
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4f46e5', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#4f46e5' }} /> Sent
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#059669', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#059669' }} /> Delivered
            </span>
          </div>
        </div>
        {loading ? (
          <div style={{ height: 160, background: '#f8fafc', borderRadius: 6 }} />
        ) : chartData.every(d => d.sent === 0 && d.delivered === 0) ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No campaign data yet. <a href="/campaigns" style={{ color: 'var(--clr-primary)', marginLeft: 6, fontWeight: 600 }}>Launch your first campaign →</a>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="db-sent"      x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/><stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/></linearGradient>
                <linearGradient id="db-delivered" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#059669" stopOpacity={0.2}/><stop offset="95%" stopColor="#059669" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10.5 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10.5 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="sent"      name="Sent"      stroke="#4f46e5" fill="url(#db-sent)"      strokeWidth={2} />
              <Area type="monotone" dataKey="delivered" name="Delivered" stroke="#059669" fill="url(#db-delivered)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quick Launch Cards */}
      <div className="stat-grid">
        {[
          { icon: '📣', title: 'New Campaign', desc: 'Broadcast WhatsApp templates to contact lists', href: '/campaigns', btn: 'Launch', color: '#059669', bg: '#ecfdf5' },
          { icon: '👥', title: 'Manage Contacts', desc: 'Import CSV lists or organize tags & groups', href: '/contacts', btn: 'Contacts', color: '#2563eb', bg: '#eff6ff' },
          { icon: '💬', title: 'Live Chat', desc: 'Respond to incoming customer inquiries live', href: '/chat', btn: 'Open Inbox', color: '#00a884', bg: '#e6f7f3' },
          { icon: '📈', title: 'Analytics', desc: 'Detailed delivery, read rates, and error logs', href: '/reports', btn: 'Reports', color: '#d97706', bg: '#fffbeb' },
        ].map(q => (
          <div key={q.title} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="sidebar-icon-tile" style={{ width: 26, height: 26, background: q.bg, color: q.color, fontSize: 13 }}>
                {q.icon}
              </span>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{q.title}</div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', flex: 1, minHeight: 32 }}>{q.desc}</div>
            <a href={q.href} className="btn btn--secondary btn--sm" style={{ width: '100%', justifyContent: 'center', borderColor: '#e2e8f0', color: q.color }}>
              {q.btn} →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
