import React, { useState, useEffect, useRef } from 'react';
import {
  listAdAccounts, connectAdAccount, disconnectAdAccount, fetchMetaAccounts, setActiveAdAccount,
  listCampaigns, createCampaign, updateCampaign, deleteCampaign,
  getAccountInsights, getCampaignInsights, getAccountBalance,
  listAdSets, updateAdSet, deleteAdSet,
  listAds, updateAd, deleteAd,
  listAudiences, createCustomAudience, createLookalikeAudience, createSavedAudience, deleteAudience, searchInterests,
  listPages,
  publishCampaign,
} from '../../api/ads.js';
import { listWabaAccounts } from '../../api/waba.js';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import './Ads.css';

// ── Constants ─────────────────────────────────────────────────────

const OBJECTIVES = [
  { key: 'OUTCOME_ENGAGEMENT', icon: '💬', name: 'WhatsApp Conversations', desc: 'Users click your ad and open WhatsApp chat with you' },
  { key: 'OUTCOME_TRAFFIC',    icon: '🌐', name: 'Website Traffic',        desc: 'Send people to your website or landing page' },
  { key: 'OUTCOME_LEADS',      icon: '📋', name: 'Lead Generation',        desc: 'Collect contact info via Meta Lead Forms' },
  { key: 'OUTCOME_SALES',      icon: '🛍️', name: 'Sales & Conversions',    desc: 'Drive purchases on your website or app' },
];

const DATE_PRESETS = [
  { value: 'last_7d',  label: 'Last 7 Days' },
  { value: 'last_14d', label: 'Last 14 Days' },
  { value: 'last_30d', label: 'Last 30 Days' },
  { value: 'last_90d', label: 'Last 90 Days' },
];

const COUNTRIES = [
  { value: 'IN', label: '🇮🇳 India' },
  { value: 'US', label: '🇺🇸 United States' },
  { value: 'GB', label: '🇬🇧 United Kingdom' },
  { value: 'AE', label: '🇦🇪 UAE' },
  { value: 'SG', label: '🇸🇬 Singapore' },
  { value: 'CA', label: '🇨🇦 Canada' },
  { value: 'AU', label: '🇦🇺 Australia' },
];

function formatCurrency(n, currency = 'INR') {
  const sym = currency === 'INR' ? '₹' : '$';
  return `${sym}${parseFloat(n || 0).toFixed(2)}`;
}

function formatBudgetFromPaise(paise, currency = 'INR') {
  if (!paise) return '—';
  const sym = currency === 'INR' ? '₹' : '$';
  return `${sym}${(paise / 100).toFixed(0)}`;
}

function formatNum(n) {
  const num = parseInt(n || 0);
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000)    return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

function StatusPill({ status }) {
  const s = (status || '').toUpperCase();
  return (
    <span className={`campaign-status-pill campaign-status-pill--${s.toLowerCase()}`}>
      {s === 'ACTIVE' ? '🟢' : s === 'PAUSED' ? '⏸' : s === 'DELETED' ? '🗑️' : '📦'} {s}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN ADS PAGE
// ═══════════════════════════════════════════════════════════════

export default function AdsPage() {
  const [tab, setTab] = useState('overview');

  // Account state
  const [accounts,       setAccounts]       = useState([]);
  const [activeAccount,  setActiveAccount]  = useState(null);
  const [accountBalance, setAccountBalance] = useState(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Error / success
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    setLoadingAccounts(true);
    try {
      const data = await listAdAccounts();
      const accs = data.accounts || [];
      setAccounts(accs);
      const active = accs.find(a => a.is_active) || accs[0] || null;
      setActiveAccount(active);
      if (active) {
        getAccountBalance().then(res => {
          if (res.balance_info) setAccountBalance(res.balance_info);
        }).catch(() => {});
      }
    } catch (e) { setError(e.message); }
    finally { setLoadingAccounts(false); }
  }

  async function handleSwitchAccount(accountId) {
    if (!accountId || (activeAccount && activeAccount.id === accountId)) return;
    setError('');
    setLoadingAccounts(true);
    try {
      await setActiveAdAccount(accountId);
      await loadAccounts();
    } catch (e) {
      setError('Failed to switch ad account: ' + e.message);
      setLoadingAccounts(false);
    }
  }

  const tabs = [
    { key: 'overview',   label: '📊 Overview' },
    { key: 'campaigns',  label: '📣 Campaigns' },
    { key: 'create',     label: '✨ Create Ad' },
    { key: 'audiences',  label: '👥 Audiences' },
    { key: 'accounts',   label: '🔗 Ad Accounts' },
  ];

  return (
    <div className="ads-page fade-in">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1>📣 Ads Manager</h1>
          <p>Create, publish, and track your Meta ad campaigns</p>
        </div>
        {activeAccount && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {accountBalance?.available_balance_str ? (
              <div className="ads-account-chip" style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25d366', borderColor: 'rgba(37, 211, 102, 0.35)', fontWeight: 700 }}>
                💳 Balance: <strong>₹{accountBalance.available_balance_str}</strong>
              </div>
            ) : accountBalance?.funding_source_display ? (
              <div className="ads-account-chip" style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25d366', borderColor: 'rgba(37, 211, 102, 0.35)', fontWeight: 700 }}>
                💳 {accountBalance.funding_source_display}
              </div>
            ) : null}

            {accountBalance?.spend_cap_remaining_num !== null && accountBalance?.spend_cap_remaining_num !== undefined && (
              <div className="ads-account-chip" style={{ background: 'rgba(24, 119, 242, 0.15)', color: '#1877f2', borderColor: 'rgba(24, 119, 242, 0.35)', fontWeight: 700 }}>
                🛑 Spend Cap Left: <strong>{formatCurrency(accountBalance.spend_cap_remaining_num * 100, activeAccount.currency)}</strong>
              </div>
            )}

            {/* Quick Switcher Dropdown */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: '20px', padding: '3px 12px 3px 10px', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
              <span style={{ fontSize: 13 }}>🏢</span>
              <select
                style={{ background: 'transparent', border: 'none', color: 'var(--clr-text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', outline: 'none' }}
                value={activeAccount?.id || ''}
                onChange={e => handleSwitchAccount(e.target.value)}
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id} style={{ background: '#1c1e21', color: '#fff' }}>
                    {a.name || 'Unnamed'} ({a.act_id}) {a.id === activeAccount?.id ? '✓ Active' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert--success" style={{ marginBottom: 16 }}>{success}</div>}

      {/* No Account Banner */}
      {!loadingAccounts && !activeAccount && (
        <div className="ads-connect-banner">
          <div style={{ fontSize: 40, marginBottom: 12 }}>📣</div>
          <h3>Connect Your Meta Ad Account</h3>
          <p>Link your Facebook Business Ad Account to start creating and managing campaigns directly from this dashboard.</p>
          <button className="btn btn--primary" onClick={() => setTab('accounts')}>🔗 Connect Ad Account</button>
        </div>
      )}

      {/* Tab Nav */}
      <div className="ads-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`ads-tab${tab === t.key ? ' ads-tab--active' : ''}`}
            onClick={() => { setTab(t.key); setError(''); setSuccess(''); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview'  && <OverviewTab account={activeAccount} accountBalance={accountBalance} />}
      {tab === 'campaigns' && <CampaignsTab account={activeAccount} onRefresh={loadAccounts} />}
      {tab === 'create'    && <CreateAdTab  account={activeAccount} accounts={accounts} onSuccess={(msg) => { setSuccess(msg); setTab('campaigns'); }} />}
      {tab === 'audiences' && <AudiencesTab account={activeAccount} />}
      {tab === 'accounts'  && <AccountsTab accounts={accounts} onRefresh={loadAccounts} onSwitchAccount={handleSwitchAccount} accountBalance={accountBalance} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TAB: OVERVIEW (Insights Dashboard)
// ═══════════════════════════════════════════════════════════════

function OverviewTab({ account, accountBalance }) {
  const [insights,    setInsights]    = useState([]);
  const [totals,      setTotals]      = useState({});
  const [balanceInfo, setBalanceInfo] = useState(accountBalance || null);
  const [datePreset,  setDatePreset]  = useState('last_30d');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => { if (account) loadInsights(); }, [account, datePreset]);
  useEffect(() => { if (accountBalance) setBalanceInfo(accountBalance); }, [accountBalance]);

  async function loadInsights() {
    setLoading(true); setError('');
    try {
      const data = await getAccountInsights({ date_preset: datePreset });
      setInsights(data.insights || []);
      setTotals(data.totals || {});
      if (data.balance_info) setBalanceInfo(data.balance_info);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  if (!account) return (
    <div className="card" style={{ textAlign: 'center', padding: 48 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
      <p style={{ color: 'var(--clr-text-2)' }}>Connect an Ad Account to see performance data</p>
    </div>
  );

  const kpis = [
    ...(balanceInfo?.available_balance_str ? [{
      label: 'Available Balance',
      value: `₹${balanceInfo.available_balance_str}`,
      sub: 'Prepaid wallet balance',
      gradient: 'linear-gradient(135deg, rgba(37,211,102,.15), transparent)'
    }] : balanceInfo?.funding_source_display ? [{
      label: 'Account Funds',
      value: balanceInfo.funding_source_display.replace(/Available balance \((.+)\)/, '$1'),
      sub: 'Funding source balance',
      gradient: 'linear-gradient(135deg, rgba(37,211,102,.15), transparent)'
    }] : []),

    ...(balanceInfo?.spend_cap_remaining_num !== null && balanceInfo?.spend_cap_remaining_num !== undefined ? [{
      label: 'Spend Cap Remaining',
      value: formatCurrency(balanceInfo.spend_cap_remaining_num * 100, account.currency),
      sub: `of ${formatCurrency((balanceInfo.spend_cap_num || 0) * 100, account.currency)} limit`,
      gradient: 'linear-gradient(135deg, rgba(24,119,242,.15), transparent)'
    }] : []),

    { label: 'Total Spend',   value: formatCurrency(totals.spend, account.currency), sub: 'Ad budget consumed', gradient: 'linear-gradient(135deg,rgba(255,165,0,.1),transparent)' },
    { label: 'Reach',         value: formatNum(totals.reach),                         sub: 'Unique users reached', gradient: 'linear-gradient(135deg,rgba(24,119,242,.1),transparent)' },
    { label: 'Impressions',   value: formatNum(totals.impressions),                   sub: 'Total ad views', gradient: 'linear-gradient(135deg,rgba(37,211,102,.08),transparent)' },
    { label: 'Clicks',        value: formatNum(totals.clicks),                        sub: 'Link clicks', gradient: 'linear-gradient(135deg,rgba(120,86,255,.1),transparent)' },
    { label: 'CTR',           value: `${totals.ctr || '0.00'}%`,                      sub: 'Click-through rate', gradient: 'linear-gradient(135deg,rgba(255,100,100,.1),transparent)' },
    { label: 'CPC',           value: formatCurrency(totals.cpc, account.currency),    sub: 'Cost per click', gradient: 'linear-gradient(135deg,rgba(0,200,200,.08),transparent)' },
    { label: 'CPM',           value: formatCurrency(totals.cpm, account.currency),    sub: 'Cost per 1000 views', gradient: 'linear-gradient(135deg,rgba(255,200,0,.08),transparent)' },
  ];


  return (
    <div>
      {/* Date Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {DATE_PRESETS.map(d => (
          <button
            key={d.value}
            className={`chat-filter-btn${datePreset === d.value ? ' chat-filter-btn--active' : ''}`}
            onClick={() => setDatePreset(d.value)}
          >
            {d.label}
          </button>
        ))}
        <button className="btn btn--ghost btn--sm" onClick={loadInsights} disabled={loading}>
          {loading ? '⏳' : '↻'} Refresh
        </button>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* KPI Cards */}
      <div className="ads-kpi-row">
        {kpis.map(k => (
          <div key={k.label} className="ads-kpi-card" style={{ '--ads-kpi-gradient': k.gradient }}>
            <div className="ads-kpi-label">{k.label}</div>
            <div className="ads-kpi-value">{k.value}</div>
            <div className="ads-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {insights.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="ads-chart-wrap">
            <div className="ads-chart-title">💰 Spend Over Time</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={insights}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff9500" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ff9500" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="date_start" tick={{ fontSize: 10, fill: 'var(--clr-text-3)' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--clr-text-3)' }} />
                <Tooltip contentStyle={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="spend" stroke="#ff9500" fill="url(#spendGrad)" name="Spend" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="ads-chart-wrap">
            <div className="ads-chart-title">👁 Impressions & Clicks</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={insights}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                <XAxis dataKey="date_start" tick={{ fontSize: 10, fill: 'var(--clr-text-3)' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--clr-text-3)' }} />
                <Tooltip contentStyle={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="impressions" fill="rgba(24,119,242,.7)" name="Impressions" radius={[3,3,0,0]} />
                <Bar dataKey="clicks"      fill="rgba(37,211,102,.8)" name="Clicks"      radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
          <p style={{ color: 'var(--clr-text-2)' }}>No insights data yet. Create and run a campaign to see performance here.</p>
        </div>
      )}
    </div>
  );
}

function formatBudgetDisplay(c, currency = 'INR') {
  const sym = currency === 'INR' ? '₹' : '$';
  if (c.daily_budget) {
    return `${sym}${(c.daily_budget / 100).toLocaleString('en-IN')}/day`;
  }
  if (c.lifetime_budget) {
    return `${sym}${(c.lifetime_budget / 100).toLocaleString('en-IN')} (Lifetime)`;
  }
  return '—';
}

function CampaignsTab({ account, onRefresh }) {
  const [campaigns,    setCampaigns]    = useState([]);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [objFilter,    setObjFilter]    = useState('');
  const [minBudget,    setMinBudget]    = useState('');
  const [maxBudget,    setMaxBudget]    = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Sorting
  const [sortKey, setSortKey] = useState('created_time');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [expandedId,      setExpandedId]      = useState(null);
  const [insights,        setInsights]        = useState({});
  const [expandedTreeId,  setExpandedTreeId]  = useState(null);
  const [treeData,        setTreeData]        = useState({});
  const [editingItem,     setEditingItem]     = useState(null); // { type: 'campaign'|'adset'|'ad', item: obj, campaignId?: string }

  useEffect(() => { if (account) load(); }, [account]);

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await listCampaigns();
      setCampaigns(data.campaigns || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function toggleStatus(c) {
    const newStatus = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await updateCampaign(c.id, { meta_campaign_id: c.id, status: newStatus });
      setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, status: newStatus } : x));
    } catch (e) { alert(e.message); }
  }

  async function handleDelete(c) {
    if (!confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) return;
    try {
      await deleteCampaign(c.id);
      setCampaigns(prev => prev.filter(x => x.id !== c.id));
    } catch (e) { alert(e.message); }
  }

  async function loadInsights(c) {
    if (expandedId === c.id) { setExpandedId(null); return; }
    setExpandedId(c.id);
    try {
      const data = await getCampaignInsights(c.id, { date_preset: 'last_30d' });
      setInsights(prev => ({ ...prev, [c.id]: data }));
    } catch (e) {}
  }

  async function loadTree(campaignId) {
    if (expandedTreeId === campaignId) {
      setExpandedTreeId(null);
      return;
    }
    setExpandedTreeId(campaignId);
    setTreeData(prev => ({ ...prev, [campaignId]: { ...(prev[campaignId] || {}), loading: true } }));
    try {
      const [setsRes, adsRes] = await Promise.all([
        listAdSets({ campaign_id: campaignId }),
        listAds({ campaign_id: campaignId }),
      ]);
      setTreeData(prev => ({
        ...prev,
        [campaignId]: { adsets: setsRes.adsets || [], ads: adsRes.ads || [], loading: false }
      }));
    } catch (e) {
      setTreeData(prev => ({ ...prev, [campaignId]: { ...(prev[campaignId] || {}), loading: false, error: e.message } }));
    }
  }

  async function toggleAdSetStatus(campaignId, adset) {
    const newStatus = adset.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await updateAdSet(adset.id, { status: newStatus });
      setTreeData(prev => ({
        ...prev,
        [campaignId]: {
          ...prev[campaignId],
          adsets: prev[campaignId]?.adsets?.map(a => a.id === adset.id ? { ...a, status: newStatus, effective_status: newStatus } : a) || []
        }
      }));
      load(); // refresh campaign aggregated budget
    } catch (e) { alert(e.message); }
  }

  async function handleDeleteAdSet(campaignId, adset) {
    if (!confirm(`Delete Ad Set "${adset.name}"?`)) return;
    try {
      await deleteAdSet(adset.id);
      setTreeData(prev => ({
        ...prev,
        [campaignId]: {
          ...prev[campaignId],
          adsets: prev[campaignId]?.adsets?.filter(a => a.id !== adset.id) || []
        }
      }));
      load();
    } catch (e) { alert(e.message); }
  }

  async function toggleAdStatus(campaignId, ad) {
    const newStatus = ad.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await updateAd(ad.id, { status: newStatus });
      setTreeData(prev => ({
        ...prev,
        [campaignId]: {
          ...prev[campaignId],
          ads: prev[campaignId]?.ads?.map(a => a.id === ad.id ? { ...a, status: newStatus, effective_status: newStatus } : a) || []
        }
      }));
    } catch (e) { alert(e.message); }
  }

  async function handleDeleteAd(campaignId, ad) {
    if (!confirm(`Delete Ad "${ad.name}"?`)) return;
    try {
      await deleteAd(ad.id);
      setTreeData(prev => ({
        ...prev,
        [campaignId]: {
          ...prev[campaignId],
          ads: prev[campaignId]?.ads?.filter(a => a.id !== ad.id) || []
        }
      }));
    } catch (e) { alert(e.message); }
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function getSortIndicator(key) {
    if (sortKey !== key) return <span style={{ opacity: 0.25, marginLeft: 4 }}>⇅</span>;
    return <span style={{ color: 'var(--clr-primary)', marginLeft: 4 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
  }

  function clearAllFilters() {
    setSearch('');
    setStatusFilter('');
    setObjFilter('');
    setMinBudget('');
    setMaxBudget('');
  }

  const hasActiveFilters = Boolean(search || statusFilter || objFilter || minBudget || maxBudget);

  if (!account) return <div className="card" style={{ textAlign: 'center', padding: 48 }}><p style={{ color: 'var(--clr-text-2)' }}>Connect an Ad Account first</p></div>;

  // Filter & Sort
  const filteredCampaigns = campaigns.filter(c => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (objFilter && c.objective !== objFilter) return false;
    if (minBudget && (c.effective_budget || 0) / 100 < parseFloat(minBudget)) return false;
    if (maxBudget && (c.effective_budget || 0) / 100 > parseFloat(maxBudget)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (c.name || '').toLowerCase().includes(q) || (c.id || '').includes(q);
    }
    return true;
  }).sort((a, b) => {
    let aVal = a[sortKey];
    let bVal = b[sortKey];

    if (sortKey === 'budget') {
      aVal = a.effective_budget || 0;
      bVal = b.effective_budget || 0;
    } else if (sortKey === 'name') {
      aVal = (a.name || '').toLowerCase();
      bVal = (b.name || '').toLowerCase();
    } else if (sortKey === 'created_time') {
      aVal = new Date(a.created_time || 0).getTime();
      bVal = new Date(b.created_time || 0).getTime();
    }

    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div>
      {/* Search & Quick Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 260 }}>
          <input
            className="form-input"
            style={{ maxWidth: 280, padding: '7px 12px', fontSize: 13 }}
            placeholder="🔍 Search campaigns by name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {['', 'ACTIVE', 'PAUSED'].map(s => (
              <button
                key={s}
                className={`chat-filter-btn${statusFilter === s ? ' chat-filter-btn--active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === '' ? `All (${campaigns.length})` : s === 'ACTIVE' ? `🟢 Active (${campaigns.filter(x => x.status === 'ACTIVE').length})` : `⏸ Paused (${campaigns.filter(x => x.status === 'PAUSED').length})`}
              </button>
            ))}
          </div>
          <button
            className={`btn btn--sm ${showFilterPanel ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setShowFilterPanel(prev => !prev)}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            ⚙️ Filters {hasActiveFilters && <span className="badge badge--green" style={{ fontSize: 10, padding: '2px 5px' }}>Active</span>}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--clr-text-3)' }}>
            Showing {filteredCampaigns.length} of {campaigns.length}
          </span>
          <button className="btn btn--secondary btn--sm" onClick={load} disabled={loading}>
            {loading ? '...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {showFilterPanel && (
        <div className="card" style={{ marginBottom: 16, padding: '16px 20px', background: 'var(--clr-surface-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text)' }}>🎛 Advanced Filter Panel</span>
            {hasActiveFilters && (
              <button className="btn btn--ghost btn--sm" onClick={clearAllFilters} style={{ fontSize: 11, padding: '2px 8px' }}>
                ✕ Clear All Filters
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Objective</label>
              <select className="form-input" style={{ fontSize: 12, padding: '6px 10px' }} value={objFilter} onChange={e => setObjFilter(e.target.value)}>
                <option value="">All Objectives</option>
                {OBJECTIVES.map(o => <option key={o.key} value={o.key}>{o.icon} {o.name}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Status</label>
              <select className="form-input" style={{ fontSize: 12, padding: '6px 10px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="ACTIVE">🟢 Active</option>
                <option value="PAUSED">⏸ Paused</option>
                <option value="DELETED">🗑 Deleted</option>
                <option value="ARCHIVED">📦 Archived</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Min Budget ({account.currency})</label>
              <input
                className="form-input"
                type="number"
                placeholder="e.g. 100"
                style={{ fontSize: 12, padding: '6px 10px' }}
                value={minBudget}
                onChange={e => setMinBudget(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Max Budget ({account.currency})</label>
              <input
                className="form-input"
                type="number"
                placeholder="e.g. 5000"
                style={{ fontSize: 12, padding: '6px 10px' }}
                value={maxBudget}
                onChange={e => setMaxBudget(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📣</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>No campaigns found</div>
          <p style={{ color: 'var(--clr-text-2)', fontSize: 13 }}>
            {campaigns.length === 0 ? 'Create your first campaign to get started' : 'No campaigns match the current filters'}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
                  Campaign {getSortIndicator('name')}
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('objective')}>
                  Objective {getSortIndicator('objective')}
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('budget')}>
                  Budget {getSortIndicator('budget')}
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('status')}>
                  Status {getSortIndicator('status')}
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('created_time')}>
                  Created {getSortIndicator('created_time')}
                </th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.map(c => {
                const currentTree = treeData[c.id];
                const isTreeOpen = expandedTreeId === c.id;

                return (
                  <React.Fragment key={c.id}>
                    <tr>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 2 }}>ID: {c.id}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--clr-text-2)' }}>
                          {OBJECTIVES.find(o => o.key === c.objective)?.icon || '📢'}&nbsp;
                          {c.objective?.replace('OUTCOME_', '') || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--clr-text)' }}>
                          {formatBudgetDisplay(c, account.currency)}
                        </span>
                      </td>
                      <td><StatusPill status={c.status} /></td>
                      <td style={{ fontSize: 11, color: 'var(--clr-text-3)' }}>
                        {c.created_time ? new Date(c.created_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            className={`btn btn--sm ${isTreeOpen ? 'btn--primary' : 'btn--secondary'}`}
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => loadTree(c.id)}
                          >
                            {isTreeOpen ? '▲ Hide' : '📦 Ad Sets & Ads'}
                          </button>
                          <button className="btn btn--secondary btn--sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => loadInsights(c)}>
                            {expandedId === c.id ? '▲ Insights' : '📊 Insights'}
                          </button>
                          <button
                            className="btn btn--secondary btn--sm"
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => setEditingItem({ type: 'campaign', item: c })}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn--secondary btn--sm"
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => toggleStatus(c)}
                            disabled={['DELETED', 'ARCHIVED'].includes(c.status)}
                          >
                            {c.status === 'ACTIVE' ? '⏸ Pause' : '▶ Resume'}
                          </button>
                          <button className="btn btn--danger btn--sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => handleDelete(c)}>
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline Ad Sets & Ads Tree Hierarchy */}
                    {isTreeOpen && (
                      <tr>
                        <td colSpan={6} style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '16px 20px' }}>
                          {currentTree?.loading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, color: 'var(--clr-text-2)' }}>
                              <div className="spinner" style={{ width: 16, height: 16 }} />
                              <span>Loading Ad Sets and Ads from Meta...</span>
                            </div>
                          ) : currentTree?.error ? (
                            <div className="alert alert--error" style={{ margin: 0 }}>{currentTree.error}</div>
                          ) : (
                            <div className="nested-tree-container">
                              {(!currentTree?.adsets || currentTree.adsets.length === 0) && (!currentTree?.ads || currentTree.ads.length === 0) ? (
                                <div style={{ fontSize: 12, color: 'var(--clr-text-3)', padding: '12px 0', textAlign: 'center' }}>
                                  No Ad Sets or Ads found for this campaign.
                                </div>
                              ) : (
                                <>
                                  {/* AD SETS CONTAINER LIST */}
                                  {(currentTree?.adsets || []).map(adset => {
                                    const matchingAds = (currentTree?.ads || []).filter(ad => ad.adset_id === adset.id);
                                    const t = adset.targeting || {};
                                    
                                    // Parse geo
                                    const cityList = t.geo_locations?.cities?.map(c => c.name) || [];
                                    const regionList = t.geo_locations?.regions?.map(r => r.name) || [];
                                    const countryList = t.geo_locations?.countries || [];
                                    const locationSummary = cityList.length > 0
                                      ? `${cityList.slice(0, 5).join(', ')}${cityList.length > 5 ? ` +${cityList.length - 5} more` : ''}`
                                      : regionList.length > 0
                                      ? `${regionList.join(', ')}`
                                      : countryList.length > 0
                                      ? countryList.join(', ')
                                      : 'India (IN)';

                                    // Parse age & gender
                                    const ageMin = t.age_min || 18;
                                    const ageMax = t.age_max || 65;
                                    const genderLabel = t.genders?.[0] === 1 ? 'Men Only' : t.genders?.[0] === 2 ? 'Women Only' : 'All Genders';

                                    // Parse interests / behaviors / job titles
                                    const rawInterests = [];
                                    if (t.flexible_spec) {
                                      t.flexible_spec.forEach(spec => {
                                        if (spec.interests) spec.interests.forEach(i => rawInterests.push(i.name));
                                        if (spec.behaviors) spec.behaviors.forEach(b => rawInterests.push(b.name));
                                        if (spec.work_positions) spec.work_positions.forEach(w => rawInterests.push(w.name));
                                      });
                                    }
                                    if (t.interests) {
                                      t.interests.forEach(i => rawInterests.push(i.name));
                                    }

                                    // Parse devices & placements
                                    const deviceSummary = t.device_platforms ? t.device_platforms.map(d => d === 'mobile' ? '📱 Mobile' : '💻 Desktop').join(', ') : '📱 Mobile & 💻 Desktop';
                                    const platformSummary = t.publisher_platforms ? t.publisher_platforms.join(', ') : 'Facebook & Instagram';

                                    return (
                                      <div key={adset.id} className="nested-adset-card">
                                        {/* Ad Set Header */}
                                        <div className="nested-adset-header">
                                          <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                              <span style={{ fontSize: 16 }}>📦</span>
                                              <strong style={{ fontSize: 14, color: 'var(--clr-text)' }}>{adset.name}</strong>
                                              <StatusPill status={adset.status} />
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 2 }}>
                                              Ad Set ID: <code>{adset.id}</code>
                                            </div>
                                          </div>

                                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                            <div style={{ textAlign: 'right' }}>
                                              <span style={{ color: 'var(--clr-text-3)', fontSize: 10, display: 'block', textTransform: 'uppercase' }}>Daily Budget</span>
                                              <strong style={{ color: 'var(--clr-primary)', fontFamily: 'monospace', fontSize: 14 }}>
                                                {adset.daily_budget ? formatBudgetFromPaise(adset.daily_budget, account.currency) + '/day' : '—'}
                                              </strong>
                                            </div>

                                            <div style={{ display: 'flex', gap: 6 }}>
                                              <button
                                                className="btn btn--secondary btn--sm"
                                                style={{ fontSize: 11, padding: '3px 8px' }}
                                                onClick={() => setEditingItem({ type: 'adset', item: adset, campaignId: c.id })}
                                              >
                                                ✏️ Edit Ad Set
                                              </button>
                                              <button
                                                className="btn btn--secondary btn--sm"
                                                style={{ fontSize: 11, padding: '3px 8px' }}
                                                onClick={() => toggleAdSetStatus(c.id, adset)}
                                              >
                                                {adset.status === 'ACTIVE' ? '⏸ Pause' : '▶ Resume'}
                                              </button>
                                              <button
                                                className="btn btn--danger btn--sm"
                                                style={{ fontSize: 11, padding: '3px 8px' }}
                                                onClick={() => handleDeleteAdSet(c.id, adset)}
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Ad Set Audience, Placements & Demographics Box */}
                                        <div className="audience-meta-box">
                                          <div className="audience-tag-row">
                                            <span className="audience-pill audience-pill--green">📍 {locationSummary}</span>
                                            <span className="audience-pill audience-pill--blue">👤 Age {ageMin}–{ageMax} ({genderLabel})</span>
                                            <span className="audience-pill audience-pill--purple">{deviceSummary}</span>
                                            <span className="audience-pill">🌐 {platformSummary}</span>
                                            {adset.optimization_goal && (
                                              <span className="audience-pill">⚡ {adset.optimization_goal}</span>
                                            )}
                                          </div>

                                          {rawInterests.length > 0 && (
                                            <div style={{ marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                              <span style={{ fontSize: 11, color: 'var(--clr-text-3)', fontWeight: 600 }}>🎯 Targeting:</span>
                                              {rawInterests.slice(0, 10).map((interest, idx) => (
                                                <span key={idx} style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 3, color: 'var(--clr-text-2)' }}>
                                                  {interest}
                                                </span>
                                              ))}
                                              {rawInterests.length > 10 && (
                                                <span style={{ fontSize: 10, color: 'var(--clr-text-3)' }}>+{rawInterests.length - 10} more</span>
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        {/* Nested Ads inside this Ad Set */}
                                        <div style={{ marginTop: 6 }}>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span>🎨 Ads in this Ad Set ({matchingAds.length})</span>
                                          </div>

                                          {matchingAds.length === 0 ? (
                                            <div style={{ fontSize: 11, color: 'var(--clr-text-3)', fontStyle: 'italic', padding: '6px 0' }}>
                                              No ads created inside this Ad Set yet.
                                            </div>
                                          ) : (
                                            <div className="nested-ads-grid">
                                              {matchingAds.map(ad => {
                                                const cr = ad.creative || {};
                                                const imgSrc = cr.image_url || cr.thumbnail_url;
                                                const headline = cr.title || cr.object_story_spec?.link_data?.name || cr.object_story_spec?.link_data?.title;
                                                const body = cr.body || cr.object_story_spec?.link_data?.message;
                                                const desc = cr.object_story_spec?.link_data?.description;
                                                const cta = cr.call_to_action_type || cr.object_story_spec?.link_data?.call_to_action?.type;

                                                return (
                                                  <div key={ad.id} className="nested-ad-card">
                                                    <div>
                                                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                                        {imgSrc ? (
                                                          <a href={imgSrc} target="_blank" rel="noopener noreferrer" title="Click to open high-res creative image">
                                                            <img src={imgSrc} alt="Creative" className="nested-ad-preview-thumb" />
                                                          </a>
                                                        ) : (
                                                          <div className="nested-ad-preview-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                                                            🖼️
                                                          </div>
                                                        )}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                                                            <strong style={{ fontSize: 13, color: 'var(--clr-text)', wordBreak: 'break-word' }}>{ad.name}</strong>
                                                            <StatusPill status={ad.status} />
                                                          </div>
                                                          <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 2 }}>ID: <code>{ad.id}</code></div>
                                                        </div>
                                                      </div>

                                                      {/* Headline, Description & Body preview */}
                                                      <div style={{ marginTop: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, padding: '8px 10px' }}>
                                                        {headline && (
                                                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text)', marginBottom: 3 }}>
                                                            📌 {headline}
                                                          </div>
                                                        )}
                                                        {body && (
                                                          <div style={{ fontSize: 11, color: 'var(--clr-text-2)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-line' }}>
                                                            {body}
                                                          </div>
                                                        )}
                                                        {desc && (
                                                          <div style={{ fontSize: 10, color: 'var(--clr-text-3)', marginTop: 4 }}>
                                                            {desc}
                                                          </div>
                                                        )}
                                                      </div>

                                                      {cta && (
                                                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--clr-primary)', fontWeight: 700 }}>
                                                          💬 CTA: {cta}
                                                        </div>
                                                      )}
                                                    </div>

                                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                                                      <button
                                                        className="btn btn--secondary btn--sm"
                                                        style={{ fontSize: 11, padding: '3px 8px' }}
                                                        onClick={() => setEditingItem({ type: 'ad', item: ad, campaignId: c.id, adset: adset })}
                                                      >
                                                        ✏️ Edit Ad & Copy
                                                      </button>
                                                      <button
                                                        className="btn btn--secondary btn--sm"
                                                        style={{ fontSize: 11, padding: '3px 8px' }}
                                                        onClick={() => toggleAdStatus(c.id, ad)}
                                                      >
                                                        {ad.status === 'ACTIVE' ? '⏸ Pause' : '▶ Resume'}
                                                      </button>
                                                      <button
                                                        className="btn btn--danger btn--sm"
                                                        style={{ fontSize: 11, padding: '3px 8px' }}
                                                        onClick={() => handleDeleteAd(c.id, ad)}
                                                      >
                                                        ✕
                                                      </button>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* Orphan / Unassigned Ads (if any) */}
                                  {(() => {
                                    const orphanAds = (currentTree?.ads || []).filter(ad => !(currentTree?.adsets || []).some(s => s.id === ad.adset_id));
                                    if (orphanAds.length === 0) return null;
                                    return (
                                      <div className="nested-adset-card" style={{ borderStyle: 'dashed' }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text-2)', marginBottom: 8 }}>
                                          🎨 Other Ads ({orphanAds.length})
                                        </div>
                                        <div className="nested-ads-grid">
                                          {orphanAds.map(ad => (
                                            <div key={ad.id} className="nested-ad-card">
                                              <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                  <strong style={{ fontSize: 13 }}>{ad.name}</strong>
                                                  <StatusPill status={ad.status} />
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 2 }}>ID: {ad.id}</div>
                                              </div>
                                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                                                <button className="btn btn--secondary btn--sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setEditingItem({ type: 'ad', item: ad, campaignId: c.id })}>
                                                  ✏️ Edit
                                                </button>
                                                <button className="btn btn--secondary btn--sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => toggleAdStatus(c.id, ad)}>
                                                  {ad.status === 'ACTIVE' ? '⏸ Pause' : '▶ Resume'}
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}

                    {/* Inline Insights Row */}
                    {expandedId === c.id && insights[c.id] && (
                      <tr>
                        <td colSpan={6} style={{ background: 'rgba(37,211,102,.04)', padding: '16px 20px' }}>
                          {insights[c.id].totals ? (
                            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                              {[
                                ['Impressions', formatNum(insights[c.id].totals?.impressions)],
                                ['Clicks', formatNum(insights[c.id].totals?.clicks)],
                                ['Spend', formatCurrency(insights[c.id].totals?.spend, account.currency)],
                                ['Reach', formatNum(insights[c.id].totals?.reach)],
                                ['CTR', `${(parseFloat(insights[c.id].totals?.ctr || 0) * 100).toFixed(2)}%`],
                                ['CPC', formatCurrency(insights[c.id].totals?.cpc, account.currency)],
                              ].map(([label, val]) => (
                                <div key={label}>
                                  <div style={{ fontSize: 10, color: 'var(--clr-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--clr-text)', fontFamily: 'var(--font-display)' }}>{val}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--clr-text-3)', fontSize: 12 }}>No insights data for this campaign yet.</span>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Entity Modal */}
      {editingItem && (
        <EditEntityModal
          target={editingItem}
          currency={account.currency}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            load();
            if (editingItem.campaignId) {
              loadTree(editingItem.campaignId);
            }
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MODAL: EDIT ENTITY (Campaign, AdSet, Ad & Creative)
// ═══════════════════════════════════════════════════════════════

function EditEntityModal({ target, currency, onClose, onSaved }) {
  const { type, item, adset } = target;
  
  // General
  const [name, setName] = useState(item.name || '');
  const [status, setStatus] = useState(item.status || 'ACTIVE');
  const [budget, setBudget] = useState(
    type === 'adset' && item.daily_budget
      ? (parseInt(item.daily_budget) / 100).toString()
      : type === 'campaign' && item.daily_budget
      ? (parseInt(item.daily_budget) / 100).toString()
      : ''
  );

  // AdSet Optimization & Schedule
  const [optGoal, setOptGoal] = useState(item.optimization_goal || 'CONVERSATIONS');
  const [destType, setDestType] = useState(item.destination_type || 'WHATSAPP');
  const [startTime, setStartTime] = useState(item.start_time ? item.start_time.slice(0, 16) : '');
  const [endTime, setEndTime] = useState(item.end_time ? item.end_time.slice(0, 16) : '');

  // AdSet Targeting State
  const initialTargeting = item.targeting || {};
  const [country, setCountry] = useState(initialTargeting.geo_locations?.countries?.[0] || 'IN');
  const [ageMin, setAgeMin] = useState(initialTargeting.age_min || 18);
  const [ageMax, setAgeMax] = useState(initialTargeting.age_max || 65);
  const [gender, setGender] = useState(initialTargeting.genders?.[0] !== undefined ? initialTargeting.genders[0] : 0);
  
  // Devices & Placements
  const [devices, setDevices] = useState(initialTargeting.device_platforms || ['mobile', 'desktop']);
  const [publishers, setPublishers] = useState(initialTargeting.publisher_platforms || ['facebook', 'instagram', 'messenger', 'audience_network']);

  // Extract initial interests / behaviors / job titles
  const extractedInterests = [];
  if (initialTargeting.flexible_spec) {
    initialTargeting.flexible_spec.forEach(spec => {
      if (spec.interests) spec.interests.forEach(i => extractedInterests.push({ ...i, category: 'Interest' }));
      if (spec.behaviors) spec.behaviors.forEach(b => extractedInterests.push({ ...b, category: 'Behavior' }));
      if (spec.work_positions) spec.work_positions.forEach(w => extractedInterests.push({ ...w, category: 'Job Title' }));
    });
  } else if (initialTargeting.interests) {
    initialTargeting.interests.forEach(i => extractedInterests.push({ ...i, category: 'Interest' }));
  }
  const [interests, setInterests] = useState(extractedInterests);
  const [interestQuery, setInterestQuery] = useState('');
  const [interestSuggestions, setInterestSuggestions] = useState([]);
  const [searchingInterests, setSearchingInterests] = useState(false);

  // Ad Creative State
  const initialCr = item.creative || {};
  const [headline, setHeadline] = useState(initialCr.title || initialCr.object_story_spec?.link_data?.name || initialCr.name || '');
  const [body, setBody] = useState(initialCr.body || initialCr.object_story_spec?.link_data?.message || '');
  const [description, setDescription] = useState(initialCr.object_story_spec?.link_data?.description || '');
  const [cta, setCta] = useState(initialCr.call_to_action_type || initialCr.object_story_spec?.link_data?.call_to_action?.type || 'WHATSAPP_MESSAGE');
  const [whatsappNumber, setWhatsappNumber] = useState(
    initialCr.object_story_spec?.link_data?.call_to_action?.value?.whatsapp_number ||
    item.promoted_object?.whatsapp_phone_number ||
    '917042603342'
  );
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(initialCr.image_url || initialCr.thumbnail_url || null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Search Meta interests
  async function handleSearchInterests(q) {
    setInterestQuery(q);
    if (!q || q.length < 2) { setInterestSuggestions([]); return; }
    setSearchingInterests(true);
    try {
      const data = await searchInterests(q);
      setInterestSuggestions(data.interests || []);
    } catch {
      setInterestSuggestions([]);
    } finally {
      setSearchingInterests(false);
    }
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }

  function toggleDevice(d) {
    setDevices(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function togglePublisher(p) {
    setPublishers(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');

    try {
      if (type === 'campaign') {
        const payload = { name: name.trim(), status };
        if (budget) payload.daily_budget = Math.round(parseFloat(budget) * 100);
        await updateCampaign(item.id, payload);
      } else if (type === 'adset') {
        const payload = {
          name: name.trim(),
          status,
          daily_budget: budget || undefined,
          optimization_goal: optGoal,
          start_time: startTime ? new Date(startTime).toISOString() : undefined,
          end_time: endTime ? new Date(endTime).toISOString() : undefined,
          targeting: {
            countries: [country],
            age_min: parseInt(ageMin) || 18,
            age_max: parseInt(ageMax) || 65,
            genders: [parseInt(gender)],
            device_platforms: devices.length > 0 ? devices : ['mobile', 'desktop'],
            publisher_platforms: publishers.length > 0 ? publishers : ['facebook', 'instagram'],
            interests: interests.map(i => ({ id: i.id, name: i.name })),
          }
        };
        await updateAdSet(item.id, payload);
      } else if (type === 'ad') {
        const payload = {
          name: name.trim(),
          status,
          headline: headline.trim(),
          body: body.trim(),
          description: description.trim(),
          call_to_action_type: cta,
          whatsapp_number: whatsappNumber.trim() || undefined,
          image_base64: imageFile && imagePreview && imagePreview.startsWith('data:') ? imagePreview : undefined,
        };
        await updateAd(item.id, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: type === 'ad' || type === 'adset' ? 700 : 460, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-title">
          ✏️ Edit {type === 'campaign' ? 'Campaign' : type === 'adset' ? 'Ad Set & Targeting' : 'Ad & Creative'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: -14, marginBottom: 16 }}>
          Meta ID: <code>{item.id}</code>
        </div>

        {error && <div className="alert alert--error" style={{ marginBottom: 14 }}>{error}</div>}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section 1: Basic Config */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--clr-border)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text)', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>
              📋 Basic Information & Budget
            </div>

            <div className="form-group">
              <label className="form-label">{type === 'ad' ? 'Ad Name' : type === 'adset' ? 'Ad Set Name' : 'Campaign Name'} *</label>
              <input
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: (type === 'adset' || (type === 'campaign' && item.budget_type === 'daily')) ? '1fr 1fr' : '1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="ACTIVE">🟢 Active</option>
                  <option value="PAUSED">⏸ Paused</option>
                </select>
              </div>

              {(type === 'adset' || (type === 'campaign' && item.budget_type === 'daily')) && (
                <div className="form-group">
                  <label className="form-label">Daily Budget ({currency || 'INR'})</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-3)', fontSize: 13, fontWeight: 700 }}>
                      {currency === 'INR' ? '₹' : '$'}
                    </span>
                    <input
                      className="form-input"
                      style={{ paddingLeft: 24 }}
                      type="number"
                      step="1"
                      min="50"
                      placeholder="e.g. 500"
                      value={budget}
                      onChange={e => setBudget(e.target.value)}
                    />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--clr-text-3)', marginTop: 2, display: 'block' }}>
                    Current spend: {budget ? `₹${parseFloat(budget).toFixed(0)}/day` : '—'}
                  </span>
                </div>
              )}
            </div>

            {type === 'adset' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Optimization Goal</label>
                  <select className="form-input" value={optGoal} onChange={e => setOptGoal(e.target.value)}>
                    <option value="CONVERSATIONS">💬 Conversations (WhatsApp / Messenger)</option>
                    <option value="LINK_CLICKS">🌐 Link Clicks (Website Traffic)</option>
                    <option value="LEAD_GENERATION">📋 Lead Generation</option>
                    <option value="IMPRESSIONS">👁️ Impressions</option>
                    <option value="REACH">📢 Reach</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Destination</label>
                  <select className="form-input" value={destType} onChange={e => setDestType(e.target.value)}>
                    <option value="WHATSAPP">🟢 Click-to-WhatsApp</option>
                    <option value="MESSENGER">🔵 Messenger</option>
                    <option value="WEBSITE">🌐 Website URL</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* ════ AD SET TARGETING EDIT CONTROLS ════ */}
          {type === 'adset' && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--clr-border)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text)', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>
                🎯 Demographics & Location Targeting
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Target Country</label>
                  <select className="form-input" value={country} onChange={e => setCountry(e.target.value)}>
                    {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Min Age</label>
                  <input className="form-input" type="number" min="18" max="65" value={ageMin} onChange={e => setAgeMin(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Max Age</label>
                  <input className="form-input" type="number" min="18" max="65" value={ageMax} onChange={e => setAgeMax(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-input" value={gender} onChange={e => setGender(parseInt(e.target.value))}>
                  <option value={0}>All Genders</option>
                  <option value={1}>Men Only</option>
                  <option value={2}>Women Only</option>
                </select>
              </div>

              {/* Interests Picker */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">🎯 Detailed Interests, Behaviors & Job Titles</label>
                <input
                  className="form-input"
                  placeholder="Search Meta interests e.g. Healthcare, Software, Education, CEO..."
                  value={interestQuery}
                  onChange={e => handleSearchInterests(e.target.value)}
                />
                {interestSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                    background: 'var(--clr-surface)', border: '1px solid var(--clr-border)',
                    borderRadius: 8, maxHeight: 160, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.5)'
                  }}>
                    {interestSuggestions.map(item => (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!interests.some(i => i.id === item.id)) {
                            setInterests(prev => [...prev, { id: item.id, name: item.name, category: item.topic || 'Interest' }]);
                          }
                          setInterestQuery('');
                          setInterestSuggestions([]);
                        }}
                        style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.05)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,211,102,.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <strong>{item.name}</strong> <span style={{ color: 'var(--clr-text-3)', fontSize: 10 }}>({item.topic || 'Interest'})</span>
                      </div>
                    ))}
                  </div>
                )}

                {interests.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {interests.map(item => (
                      <span key={item.id} className="badge badge--green" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', fontSize: 11 }}>
                        🎯 {item.name} {item.category && <span style={{ opacity: 0.7, fontSize: 10 }}>({item.category})</span>}
                        <button type="button" onClick={() => setInterests(interests.filter(i => i.id !== item.id))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Placements & Devices */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--clr-text-2)', marginBottom: 8, textTransform: 'uppercase' }}>
                  📱 Devices & Platforms
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={devices.includes('mobile')} onChange={() => toggleDevice('mobile')} />
                    📱 Mobile Devices
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={devices.includes('desktop')} onChange={() => toggleDevice('desktop')} />
                    💻 Desktop Computers
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {['facebook', 'instagram', 'messenger', 'audience_network'].map(p => (
                    <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', textTransform: 'capitalize' }}>
                      <input type="checkbox" checked={publishers.includes(p)} onChange={() => togglePublisher(p)} />
                      {p.replace('_', ' ')}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════ AD CREATIVE & COPY EDIT CONTROLS ════ */}
          {type === 'ad' && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--clr-border)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text)', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6 }}>
                🎨 Ad Creative, Headline & Copy
              </div>

              <div className="form-group">
                <label className="form-label">Headline (Catchy bold title)</label>
                <input
                  className="form-input"
                  placeholder="e.g. Launch Your Mobile App in 15 Days"
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Primary Text (Ad Message Body)</label>
                <textarea
                  className="form-input"
                  rows={5}
                  placeholder="Write your ad copy/message..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Description (Optional sub-text)</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Chat with our specialists"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Call To Action (CTA)</label>
                  <select className="form-input" value={cta} onChange={e => setCta(e.target.value)}>
                    <option value="WHATSAPP_MESSAGE">💬 Send WhatsApp Message</option>
                    <option value="LEARN_MORE">📖 Learn More</option>
                    <option value="GET_QUOTE">💰 Get Quote</option>
                    <option value="CONTACT_US">📞 Contact Us</option>
                    <option value="SIGN_UP">✍️ Sign Up</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Destination WhatsApp Phone Number</label>
                <input
                  className="form-input"
                  placeholder="e.g. +91 70426 03342"
                  value={whatsappNumber}
                  onChange={e => setWhatsappNumber(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Replace Creative Image (Optional)</label>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" style={{ width: 70, height: 70, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--clr-border)' }} />
                  )}
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ fontSize: 12 }} />
                </div>
              </div>
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving...' : '💾 Save Changes to Meta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TAB: CREATE AD (Wizard)
// ═══════════════════════════════════════════════════════════════

function CreateAdTab({ account, accounts, onSuccess }) {
  const [step,         setStep]         = useState(1);
  const [pages,        setPages]        = useState([]);
  const [wabaAccounts, setWabaAccounts] = useState([]);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  // Interest search state
  const [interestQuery,       setInterestQuery]       = useState('');
  const [interestSuggestions, setInterestSuggestions] = useState([]);
  const [searchingInterests,  setSearchingInterests]  = useState(false);

  // Form state
  const [form, setForm] = useState({
    account_id:        '',
    campaign_name:     '',
    objective:         'OUTCOME_ENGAGEMENT',
    status:            'PAUSED',
    daily_budget:      '',
    // Targeting
    countries:         ['IN'],
    age_min:           18,
    age_max:           65,
    genders:           [0],
    interests:         [],
    // Creative
    page_id:           '',
    whatsapp_source:   'page',
    whatsapp_number:   '',
    headline:          '',
    body:              '',
    description:       '',
    image_base64:      '',
    call_to_action_type: 'WHATSAPP_MESSAGE',
  });

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Image file is too large (max 8MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setField('image_base64', reader.result);
    };
    reader.readAsDataURL(file);
  }


  useEffect(() => {
    if (account) {
      loadPages();
      loadWabaNumbers();
    }
  }, [account]);

  async function loadPages() {
    try {
      const data = await listPages();
      setPages(data.pages || []);
      if (data.pages?.length) {
        const first = data.pages[0];
        const pageNum = first.whatsapp_number || first.phone || (first.id === '461194823752748' ? '+917042603342' : '');
        setForm(f => ({
          ...f,
          page_id: first.id,
          whatsapp_number: f.whatsapp_number || pageNum || '+917042603342',
        }));
      }
    } catch (e) {}
  }

  async function loadWabaNumbers() {
    try {
      const data = await listWabaAccounts();
      setWabaAccounts(data.accounts || []);
    } catch (e) {}
  }

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSearchInterests(q) {
    setInterestQuery(q);
    if (!q || q.length < 2) { setInterestSuggestions([]); return; }
    setSearchingInterests(true);
    try {
      const data = await searchInterests(q);
      setInterestSuggestions(data.interests || []);
    } catch (e) {}
    finally { setSearchingInterests(false); }
  }

  function addInterest(interest) {
    if (!form.interests.some(i => i.id === interest.id)) {
      setField('interests', [...form.interests, { id: interest.id, name: interest.name }]);
    }
    setInterestQuery('');
    setInterestSuggestions([]);
  }

  function removeInterest(id) {
    setField('interests', form.interests.filter(i => i.id !== id));
  }

  async function handlePublish(e) {
    e.preventDefault();
    if (!account && !form.account_id) { setError('Please connect an Ad Account first'); return; }
    if (!form.campaign_name.trim())   { setError('Campaign name is required'); return; }
    if (!form.page_id)                { setError('Please select a Facebook Page'); return; }
    if (!form.headline.trim())        { setError('Ad headline is required'); return; }
    if (!form.body.trim())            { setError('Ad body text is required'); return; }

    setSaving(true); setError('');
    try {
      const payload = {
        account_id:    form.account_id || undefined,
        campaign_name: form.campaign_name.trim(),
        objective:     form.objective,
        status:        form.status,
        daily_budget:  form.daily_budget || undefined,
        adset_name:    `${form.campaign_name} — Ad Set`,
        targeting: {
          geo_locations: { countries: form.countries },
          age_min: parseInt(form.age_min),
          age_max: parseInt(form.age_max),
          genders: form.genders,
          interests: form.interests,
        },
        page_id:             form.page_id,
        whatsapp_number:     form.whatsapp_number || undefined,
        headline:            form.headline.trim(),
        body:                form.body.trim(),
        description:         form.description.trim(),
        image_base64:        form.image_base64 || undefined,
        call_to_action_type: form.call_to_action_type,
      };

      const result = await publishCampaign(payload);
      onSuccess(`✅ Campaign "${form.campaign_name}" published! Campaign ID: ${result.campaign_id}`);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const selectedObjective = OBJECTIVES.find(o => o.key === form.objective);

  if (!account) return (
    <div className="card" style={{ textAlign: 'center', padding: 48 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
      <p style={{ color: 'var(--clr-text-2)', marginBottom: 16 }}>Connect an Ad Account first to create campaigns</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* Wizard Steps */}
      <div className="wizard-steps">
        {['Objective', 'Targeting', 'Budget', 'Creative', 'Review'].map((label, i) => {
          const num = i + 1;
          const cls = step > num ? 'done' : step === num ? 'active' : '';
          return (
            <div
              key={label}
              className={`wizard-step wizard-step--${cls}`}
              onClick={() => num < step && setStep(num)}
              style={{ cursor: num < step ? 'pointer' : 'default' }}
            >
              <span className="wizard-step-num">{step > num ? '✓' : num}</span>
              {label}
            </div>
          );
        })}
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ─── Step 1: Objective ─── */}
      {step === 1 && (
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>1. Choose Campaign Objective</div>
          <div style={{ fontSize: 13, color: 'var(--clr-text-2)', marginBottom: 20 }}>What do you want people to do when they see your ad?</div>

          <div className="form-group">
            <label className="form-label">Campaign Name *</label>
            <input className="form-input" placeholder="e.g. Healthy Manushya — Summer Offer" value={form.campaign_name} onChange={e => setField('campaign_name', e.target.value)} required />
          </div>

          <div className="objective-grid">
            {OBJECTIVES.map(o => (
              <div
                key={o.key}
                className={`objective-card${form.objective === o.key ? ' objective-card--selected' : ''}`}
                onClick={() => setField('objective', o.key)}
              >
                <div className="objective-card__icon">{o.icon}</div>
                <div className="objective-card__name">{o.name}</div>
                <div className="objective-card__desc">{o.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <button className="btn btn--primary" onClick={() => { if (!form.campaign_name.trim()) { setError('Campaign name is required'); return; } setError(''); setStep(2); }}>
              Next: Targeting →
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 2: Targeting ─── */}
      {step === 2 && (
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>2. Define Your Audience</div>
          <div style={{ fontSize: 13, color: 'var(--clr-text-2)', marginBottom: 20 }}>Choose demographics, location, and interest targeting</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Country / Region</label>
              <select className="form-input" value={form.countries[0]} onChange={e => setField('countries', [e.target.value])}>
                {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-input" value={form.genders[0]} onChange={e => setField('genders', [parseInt(e.target.value)])}>
                <option value={0}>All Genders</option>
                <option value={1}>Male Only</option>
                <option value={2}>Female Only</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Min Age</label>
              <input className="form-input" type="number" min="18" max="65" value={form.age_min} onChange={e => setField('age_min', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Max Age</label>
              <input className="form-input" type="number" min="18" max="65" value={form.age_max} onChange={e => setField('age_max', e.target.value)} />
            </div>
          </div>

          {/* Detailed Interests Search */}
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">🎯 Detailed Targeting / Interests (Optional)</label>
            <input
              className="form-input"
              placeholder="🔍 Search interests e.g. Health & wellness, Ayurveda, Shopping, Real estate..."
              value={interestQuery}
              onChange={e => handleSearchInterests(e.target.value)}
            />

            {/* Autocomplete dropdown */}
            {interestSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: 'var(--clr-surface)', border: '1px solid var(--clr-border)',
                borderRadius: 8, maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.3)'
              }}>
                {interestSuggestions.map(item => (
                  <div
                    key={item.id}
                    onClick={() => addInterest(item)}
                    style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.05)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,211,102,.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <strong>{item.name}</strong> <span style={{ color: 'var(--clr-text-3)', fontSize: 10 }}>({item.audience_size_lower_bound ? formatNum(item.audience_size_lower_bound) + ' people' : item.topic || 'Interest'})</span>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Interest chips */}
            {form.interests.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {form.interests.map(item => (
                  <span key={item.id} className="badge badge--green" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 11 }}>
                    🎯 {item.name}
                    <button type="button" onClick={() => removeInterest(item.id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button className="btn btn--ghost" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn--primary" onClick={() => { setError(''); setStep(3); }}>Next: Budget →</button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Budget ─── */}
      {step === 3 && (
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>3. Set Budget & Schedule</div>
          <div style={{ fontSize: 13, color: 'var(--clr-text-2)', marginBottom: 20 }}>Set how much to spend per day</div>

          <div className="form-group">
            <label className="form-label">Daily Budget ({account?.currency || 'INR'}) *</label>
            <input
              className="form-input"
              type="number"
              min="50"
              step="10"
              placeholder="e.g. 500"
              value={form.daily_budget}
              onChange={e => setField('daily_budget', e.target.value)}
            />
            <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 4 }}>Minimum: ₹50/day</div>
          </div>

          <div className="form-group">
            <label className="form-label">Launch Status</label>
            <select className="form-input" value={form.status} onChange={e => setField('status', e.target.value)}>
              <option value="PAUSED">Save as Draft (Paused) — publish manually later</option>
              <option value="ACTIVE">Go Live Immediately 🚀</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button className="btn btn--ghost" onClick={() => setStep(2)}>← Back</button>
            <button className="btn btn--primary" onClick={() => { if (!form.daily_budget) { setError('Daily budget is required'); return; } setError(''); setStep(4); }}>Next: Creative →</button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Creative ─── */}
      {step === 4 && (
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>4. Create Your Ad</div>
          <div style={{ fontSize: 13, color: 'var(--clr-text-2)', marginBottom: 20 }}>Write the copy for your Facebook / Instagram ad</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
            {/* Left: Form */}
            <div>
              <div className="form-group">
                <label className="form-label">Facebook Page *</label>
                {pages.length > 0 ? (
                  <select
                    className="form-input"
                    value={form.page_id}
                    onChange={e => {
                      const selPage = pages.find(p => p.id === e.target.value);
                      setField('page_id', e.target.value);
                      if (form.whatsapp_source === 'page' && selPage?.whatsapp_number) {
                        setField('whatsapp_number', selPage.whatsapp_number);
                      }
                    }}
                  >
                    {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--clr-text-3)', background: 'var(--clr-surface-2)', padding: '10px 12px', borderRadius: 8 }}>
                    ⚠️ No Facebook Pages found. Make sure your access token has `pages_read_engagement` permission.
                  </div>
                )}
              </div>

              {/* Destination WhatsApp Number */}
              <div className="form-group">
                <label className="form-label">Destination WhatsApp Number *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <select
                    className="form-input"
                    value={form.whatsapp_source || 'page'}
                    onChange={e => {
                      const src = e.target.value;
                      setField('whatsapp_source', src);
                      if (src === 'page') {
                        const curPage = pages.find(p => p.id === form.page_id);
                        const pageNum = curPage?.whatsapp_number || (curPage?.id === '461194823752748' ? '+91 70426 03342' : '');
                        setField('whatsapp_number', pageNum);
                      } else if (src.startsWith('waba_')) {
                        const wId = src.replace('waba_', '');
                        const wAcc = wabaAccounts.find(x => x.id === wId);
                        setField('whatsapp_number', wAcc?.display_number || '');
                      } else if (src === 'custom') {
                        setField('whatsapp_number', '');
                      }
                    }}
                  >
                    <option value="page">
                      📄 Facebook Page Linked Number ({pages.find(p => p.id === form.page_id)?.whatsapp_number || (form.page_id === '461194823752748' ? '+91 70426 03342' : 'Default Page Number')})
                    </option>
                    {wabaAccounts.map(w => (
                      <option key={w.id} value={`waba_${w.id}`}>
                        📱 Connected WABA: {w.display_name ? `${w.display_name} (+91 ${w.display_number})` : `+91 ${w.display_number}`}
                      </option>
                    ))}
                    <option value="custom">✏️ Enter Custom WhatsApp Number...</option>
                  </select>

                  {(form.whatsapp_source === 'custom' || !form.whatsapp_number) && (
                    <input
                      className="form-input"
                      placeholder="e.g. 8920932354 or +91 89209 32354"
                      value={form.whatsapp_number}
                      onChange={e => setField('whatsapp_number', e.target.value)}
                      required
                    />
                  )}

                  {form.whatsapp_number && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--clr-primary)' }}>
                      <span>✓ Routing customer messages to:</span>
                      <strong style={{ fontFamily: 'monospace' }}>
                        {form.whatsapp_number.startsWith('+') ? form.whatsapp_number : `+91 ${form.whatsapp_number}`}
                      </strong>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 4 }}>
                  Incoming leads from this ad will automatically land in your CRM & Live Chat.
                </div>
              </div>

              {/* Ad Creative Media Upload */}
              <div className="form-group">
                <label className="form-label">Ad Image / Banner *</label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <label
                    className="btn btn--secondary btn--sm"
                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    📁 {form.image_base64 ? 'Change Image' : 'Choose Image (JPG/PNG)'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      style={{ display: 'none' }}
                      onChange={handleImageUpload}
                    />
                  </label>
                  {form.image_base64 ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      style={{ fontSize: 11, color: 'var(--clr-danger)' }}
                      onClick={() => setField('image_base64', '')}
                    >
                      ✕ Remove
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--clr-text-3)' }}>
                      Optional — default green branding banner used if none selected
                    </span>
                  )}
                </div>
                {form.image_base64 && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img
                      src={form.image_base64}
                      alt="Ad Preview"
                      style={{ width: 80, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--clr-border)' }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--clr-primary)' }}>✓ Image ready for upload</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Ad Headline *</label>
                <input className="form-input" placeholder="e.g. Get 20% Off Today!" value={form.headline} onChange={e => setField('headline', e.target.value)} maxLength={40} />
                <div style={{ fontSize: 10, color: 'var(--clr-text-3)', marginTop: 2 }}>{form.headline.length}/40 characters</div>
              </div>

              <div className="form-group">
                <label className="form-label">Primary Ad Text *</label>
                <textarea className="form-input" rows={3} placeholder="e.g. Discover our latest wellness products. Chat with us on WhatsApp to know more!" value={form.body} onChange={e => setField('body', e.target.value)} maxLength={125} />
                <div style={{ fontSize: 10, color: 'var(--clr-text-3)', marginTop: 2 }}>{form.body.length}/125 characters</div>
              </div>

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <input className="form-input" placeholder="e.g. Limited time offer. Click to chat." value={form.description} onChange={e => setField('description', e.target.value)} maxLength={30} />
              </div>

              <div className="form-group">
                <label className="form-label">Call to Action</label>
                <select className="form-input" value={form.call_to_action_type} onChange={e => setField('call_to_action_type', e.target.value)}>
                  <option value="WHATSAPP_MESSAGE">💬 Send WhatsApp Message</option>
                  <option value="LEARN_MORE">Learn More</option>
                  <option value="SIGN_UP">Sign Up</option>
                  <option value="SHOP_NOW">Shop Now</option>
                  <option value="GET_QUOTE">Get Quote</option>
                  <option value="CONTACT_US">Contact Us</option>
                </select>
              </div>
            </div>

            {/* Right: Live Preview */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-2)', marginBottom: 10 }}>📱 Live Preview</div>
              <div className="wa-ad-preview">
                <div className="wa-ad-preview__sponsor">Sponsored · {pages.find(p => p.id === form.page_id)?.name || 'Your Page'}</div>
                <div className="wa-ad-preview__bubble">
                  <div className="wa-ad-preview__image" style={{ padding: 0, overflow: 'hidden', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a2318' }}>
                    {form.image_base64 ? (
                      <img src={form.image_base64} alt="Ad creative" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--clr-primary)' }}>
                        <span style={{ fontSize: 24 }}>🖼️</span>
                        <span style={{ fontSize: 10, opacity: 0.8 }}>WhatsApp Ad Banner</span>
                      </div>
                    )}
                  </div>
                  <div className="wa-ad-preview__content">
                    <div className="wa-ad-preview__headline">{form.headline || 'Your Headline Here'}</div>
                    <div className="wa-ad-preview__body">{form.body || 'Your ad copy will appear here. Keep it concise and compelling!'}</div>
                    <div className="wa-ad-preview__cta">
                      {form.call_to_action_type === 'WHATSAPP_MESSAGE' ? '💬 Send WhatsApp Message' :
                       form.call_to_action_type === 'LEARN_MORE' ? 'Learn More' :
                       form.call_to_action_type === 'SHOP_NOW' ? '🛍 Shop Now' :
                       form.call_to_action_type === 'GET_QUOTE' ? 'Get Quote' : 'Contact Us'}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 10, lineHeight: 1.4 }}>
                💡 <strong>Destination:</strong> {form.whatsapp_number ? `+${form.whatsapp_number.replace(/\D/g, '')}` : 'Page default WhatsApp'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button className="btn btn--ghost" onClick={() => setStep(3)}>← Back</button>
            <button className="btn btn--primary" onClick={() => { if (!form.headline.trim() || !form.body.trim()) { setError('Headline and ad text are required'); return; } setError(''); setStep(5); }}>Review →</button>
          </div>
        </div>
      )}

      {/* ─── Step 5: Review & Publish ─── */}
      {step === 5 && (
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 20 }}>5. Review & Publish</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {[
              ['Campaign Name',    form.campaign_name],
              ['Objective',        `${selectedObjective?.icon} ${selectedObjective?.name}`],
              ['Target Country',   COUNTRIES.find(c => c.value === form.countries[0])?.label],
              ['Age Range',        `${form.age_min} – ${form.age_max}`],
              ['Interests',        form.interests.length > 0 ? form.interests.map(i => i.name).join(', ') : 'All / Broad Audience'],
              ['Daily Budget',     `${account?.currency === 'INR' ? '₹' : '$'}${form.daily_budget}`],
              ['Launch Status',    form.status],
              ['Facebook Page',    pages.find(p => p.id === form.page_id)?.name || '—'],
              ['Target WhatsApp',  form.whatsapp_number || 'Page Default WhatsApp'],
              ['Headline',         form.headline],
              ['Ad Text',          form.body],
              ['CTA',              form.call_to_action_type],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', gap: 12, padding: '10px 14px', background: 'var(--clr-surface-2)', borderRadius: 8 }}>
                <div style={{ width: 140, fontSize: 12, fontWeight: 700, color: 'var(--clr-text-2)', flexShrink: 0 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--clr-text)' }}>{val}</div>
              </div>
            ))}
          </div>

          {form.status === 'ACTIVE' && (
            <div style={{ background: 'rgba(255,165,0,.12)', border: '1px solid rgba(255,165,0,.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#ffaa00' }}>
              ⚠️ Setting status to <strong>ACTIVE</strong> will immediately start running your ad and spending budget. Set to <strong>PAUSED</strong> if you want to review in Meta Ads Manager first.
            </div>
          )}

          {error && <div className="alert alert--error" style={{ marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn--ghost" onClick={() => setStep(4)}>← Edit</button>
            <button className="btn btn--primary" onClick={handlePublish} disabled={saving}>
              {saving ? '⏳ Publishing...' : form.status === 'ACTIVE' ? '🚀 Go Live!' : '💾 Save as Draft'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TAB: AUDIENCES (Custom, Lookalike, Saved)
// ═══════════════════════════════════════════════════════════════

function AudiencesTab({ account }) {
  const [filter,       setFilter]       = useState('all');
  const [audiences,    setAudiences]    = useState([]);
  const [customList,   setCustomList]   = useState([]);
  const [lookalikeList, setLookalikeList] = useState([]);
  const [savedList,    setSavedList]    = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  // Modals
  const [showCustomModal,    setShowCustomModal]    = useState(false);
  const [showLookalikeModal, setShowLookalikeModal] = useState(false);
  const [showSavedModal,     setShowSavedModal]     = useState(false);
  const [saving,             setSaving]             = useState(false);

  // Forms
  const [customForm, setCustomForm] = useState({ name: '', description: '', sync_from_crm: true });
  const [lookalikeForm, setLookalikeForm] = useState({ name: '', origin_audience_id: '', country: 'IN', ratio: '0.01' });
  const [savedForm, setSavedForm] = useState({ name: '', description: '', countries: ['IN'], age_min: 18, age_max: 65, genders: [0], interests: [] });

  // Interest search for Saved Audience
  const [sq, setSq] = useState('');
  const [suggs, setSuggs] = useState([]);

  useEffect(() => { if (account) load(); }, [account]);

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await listAudiences();
      setAudiences(data.audiences || []);
      setCustomList(data.custom_audiences || []);
      setLookalikeList(data.lookalike_audiences || []);
      setSavedList(data.saved_audiences || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleCreateCustom(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createCustomAudience(customForm);
      setShowCustomModal(false);
      setCustomForm({ name: '', description: '', sync_from_crm: true });
      load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function handleCreateLookalike(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createLookalikeAudience(lookalikeForm);
      setShowLookalikeModal(false);
      setLookalikeForm({ name: '', origin_audience_id: '', country: 'IN', ratio: '0.01' });
      load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function handleSearchSavedInterests(q) {
    setSq(q);
    if (!q || q.length < 2) { setSuggs([]); return; }
    try {
      const data = await searchInterests(q);
      setSuggs(data.interests || []);
    } catch (e) {}
  }

  async function handleCreateSaved(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createSavedAudience(savedForm);
      setShowSavedModal(false);
      setSavedForm({ name: '', description: '', countries: ['IN'], age_min: 18, age_max: 65, genders: [0], interests: [] });
      load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this audience from Meta?')) return;
    try {
      await deleteAudience(id);
      load();
    } catch (e) { alert(e.message); }
  }

  if (!account) return <div className="card" style={{ textAlign: 'center', padding: 48 }}><p style={{ color: 'var(--clr-text-2)' }}>Connect an Ad Account first</p></div>;

  // Filter list
  let displayList = [];
  if (filter === 'all') {
    displayList = [...audiences, ...savedList.map(s => ({ ...s, subtype: 'SAVED' }))];
  } else if (filter === 'custom') {
    displayList = customList;
  } else if (filter === 'lookalike') {
    displayList = lookalikeList;
  } else if (filter === 'saved') {
    displayList = savedList.map(s => ({ ...s, subtype: 'SAVED' }));
  }

  return (
    <div>
      {/* Top action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            ['all',       `All (${audiences.length + savedList.length})`],
            ['custom',    `👥 Custom (${customList.length})`],
            ['lookalike', `🧬 Lookalike (${lookalikeList.length})`],
            ['saved',     `🎯 Saved (${savedList.length})`],
          ].map(([k, label]) => (
            <button
              key={k}
              className={`chat-filter-btn${filter === k ? ' chat-filter-btn--active' : ''}`}
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--secondary btn--sm" onClick={() => setShowCustomModal(true)}>
            + Custom Audience
          </button>
          <button className="btn btn--secondary btn--sm" onClick={() => setShowLookalikeModal(true)}>
            + Lookalike Audience
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => setShowSavedModal(true)}>
            + Saved Targeting
          </button>
          <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
            ↻
          </button>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : displayList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <h3>No Audiences Found</h3>
          <p style={{ color: 'var(--clr-text-2)', marginBottom: 16 }}>
            Define custom, lookalike, or saved audiences using the buttons above.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Audience Name</th>
                <th>Type</th>
                <th>Approx. Size</th>
                <th>Details / Targetings</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map(a => {
                const isLookalike = a.subtype === 'LOOKALIKE' || a.lookalike_spec;
                const isSaved = a.subtype === 'SAVED';

                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 2 }}>ID: {a.id}</div>
                    </td>
                    <td>
                      {isLookalike ? (
                        <span className="badge badge--green">🧬 Lookalike</span>
                      ) : isSaved ? (
                        <span className="badge badge--blue">🎯 Saved</span>
                      ) : (
                        <span className="badge badge--gray">👥 {a.subtype || 'Custom'}</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {a.approximate_count_lower_bound
                        ? `${formatNum(a.approximate_count_lower_bound)} - ${formatNum(a.approximate_count_upper_bound || a.approximate_count_lower_bound)}`
                        : a.approximate_count_upper_bound ? `${formatNum(a.approximate_count_upper_bound)}` : '—'}
                    </td>
                    <td style={{ color: 'var(--clr-text-2)', fontSize: 12 }}>
                      {a.description || (a.targeting?.geo_locations?.countries?.join(', ') ? `📍 ${a.targeting.geo_locations.countries.join(', ')} (Age ${a.targeting.age_min || 18}-${a.targeting.age_max || 65})` : '—')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn--danger btn--sm"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => handleDelete(a.id)}
                        title="Delete Audience"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Custom Audience ── */}
      {showCustomModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCustomModal(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="modal-title">👥 Create Custom Audience</div>
            <form onSubmit={handleCreateCustom} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Audience Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Existing Customers / Inbound WhatsApp Leads"
                  value={customForm.name}
                  onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <input
                  className="form-input"
                  placeholder="e.g. Leads collected from WhatsApp CRM"
                  value={customForm.description}
                  onChange={e => setCustomForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div style={{ background: 'rgba(37,211,102,.1)', border: '1px solid rgba(37,211,102,.25)', borderRadius: 8, padding: '12px 14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--clr-text)' }}>
                  <input
                    type="checkbox"
                    checked={customForm.sync_from_crm}
                    onChange={e => setCustomForm(f => ({ ...f, sync_from_crm: e.target.checked }))}
                  />
                  <span>⚡ Auto-sync phone numbers from CRM Contacts table</span>
                </label>
                <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 4, marginLeft: 24 }}>
                  Contacts will be SHA-256 hashed and securely matched by Meta.
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowCustomModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Audience'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Lookalike Audience ── */}
      {showLookalikeModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowLookalikeModal(false)}>
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="modal-title">🧬 Create Lookalike Audience</div>
            <form onSubmit={handleCreateLookalike} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Lookalike Audience Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Lookalike (1%) — India — Website Visitors"
                  value={lookalikeForm.name}
                  onChange={e => setLookalikeForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Source Audience *</label>
                <select
                  className="form-input"
                  value={lookalikeForm.origin_audience_id}
                  onChange={e => setLookalikeForm(f => ({ ...f, origin_audience_id: e.target.value }))}
                  required
                >
                  <option value="">Select source custom audience...</option>
                  {audiences.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.subtype || 'Custom'})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Target Country</label>
                  <select
                    className="form-input"
                    value={lookalikeForm.country}
                    onChange={e => setLookalikeForm(f => ({ ...f, country: e.target.value }))}
                  >
                    {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Audience Size Ratio</label>
                  <select
                    className="form-input"
                    value={lookalikeForm.ratio}
                    onChange={e => setLookalikeForm(f => ({ ...f, ratio: e.target.value }))}
                  >
                    <option value="0.01">1% (Most Similar)</option>
                    <option value="0.02">2%</option>
                    <option value="0.03">3%</option>
                    <option value="0.05">5%</option>
                    <option value="0.10">10% (Broadest Reach)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowLookalikeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving || !lookalikeForm.origin_audience_id}>
                  {saving ? 'Creating...' : 'Create Lookalike'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Saved Audience ── */}
      {showSavedModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSavedModal(false)}>
          <div className="modal-box" style={{ maxWidth: 540 }}>
            <div className="modal-title">🎯 Define Saved Audience (Targeting)</div>
            <form onSubmit={handleCreateSaved} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Audience Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. India — Health & Wellness Enthusiasts (25-45)"
                  value={savedForm.name}
                  onChange={e => setSavedForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <select
                    className="form-input"
                    value={savedForm.countries[0]}
                    onChange={e => setSavedForm(f => ({ ...f, countries: [e.target.value] }))}
                  >
                    {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-input"
                    value={savedForm.genders[0]}
                    onChange={e => setSavedForm(f => ({ ...f, genders: [parseInt(e.target.value)] }))}
                  >
                    <option value={0}>All Genders</option>
                    <option value={1}>Male Only</option>
                    <option value={2}>Female Only</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Min Age</label>
                  <input
                    className="form-input"
                    type="number"
                    min="18"
                    max="65"
                    value={savedForm.age_min}
                    onChange={e => setSavedForm(f => ({ ...f, age_min: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Max Age</label>
                  <input
                    className="form-input"
                    type="number"
                    min="18"
                    max="65"
                    value={savedForm.age_max}
                    onChange={e => setSavedForm(f => ({ ...f, age_max: e.target.value }))}
                  />
                </div>
              </div>

              {/* Interests search */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">🎯 Detailed Interests Targeting</label>
                <input
                  className="form-input"
                  placeholder="Search interests e.g. Healthcare, Fitness, Ayurveda, Shopping..."
                  value={sq}
                  onChange={e => handleSearchSavedInterests(e.target.value)}
                />
                {suggs.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                    background: 'var(--clr-surface)', border: '1px solid var(--clr-border)',
                    borderRadius: 8, maxHeight: 160, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.3)'
                  }}>
                    {suggs.map(item => (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!savedForm.interests.some(i => i.id === item.id)) {
                            setSavedForm(f => ({ ...f, interests: [...f.interests, { id: item.id, name: item.name }] }));
                          }
                          setSq(''); setSuggs([]);
                        }}
                        style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.05)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,211,102,.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <strong>{item.name}</strong> <span style={{ color: 'var(--clr-text-3)', fontSize: 10 }}>({item.topic || 'Interest'})</span>
                      </div>
                    ))}
                  </div>
                )}

                {savedForm.interests.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {savedForm.interests.map(item => (
                      <span key={item.id} className="badge badge--green" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 11 }}>
                        🎯 {item.name}
                        <button type="button" onClick={() => setSavedForm(f => ({ ...f, interests: f.interests.filter(i => i.id !== item.id) }))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowSavedModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving || !savedForm.name.trim()}>
                  {saving ? 'Saving...' : 'Save Audience'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TAB: AD ACCOUNTS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

function AccountsTab({ accounts, onRefresh, onSwitchAccount, accountBalance }) {
  const [showConnect,   setShowConnect]   = useState(false);
  const [accessToken,   setAccessToken]   = useState('');
  const [actId,         setActId]         = useState('');
  const [metaAccounts,  setMetaAccounts]  = useState([]);
  const [fetching,      setFetching]      = useState(false);
  const [connecting,    setConnecting]    = useState(false);
  const [error,         setError]         = useState('');

  async function fetchFromMeta() {
    if (!accessToken.trim()) { setError('Paste your Access Token first'); return; }
    setFetching(true); setError('');
    try {
      const data = await fetchMetaAccounts(accessToken.trim());
      setMetaAccounts(data.accounts || []);
      if (data.accounts?.length) setActId(data.accounts[0].id);
    } catch (e) { setError(e.message); }
    finally { setFetching(false); }
  }

  async function handleConnect(e) {
    e.preventDefault();
    setConnecting(true); setError('');
    try {
      await connectAdAccount({ access_token: accessToken.trim(), act_id: actId || undefined });
      setShowConnect(false);
      setAccessToken(''); setActId(''); setMetaAccounts([]);
      onRefresh();
    } catch (e) { setError(e.message); }
    finally { setConnecting(false); }
  }

  async function handleDisconnect(id) {
    if (!confirm('Disconnect this Ad Account?')) return;
    try {
      await disconnectAdAccount(id);
      onRefresh();
    } catch (e) { alert(e.message); }
  }

  const activeAcc = accounts.find(a => a.is_active) || accounts[0];

  return (
    <div>
      {/* Active Account Balance & Spend Summary */}
      {activeAcc && accountBalance && (
        <div className="card" style={{ marginBottom: 20, padding: '20px 24px', background: 'linear-gradient(135deg, rgba(37,211,102,.06), rgba(24,119,242,.06))', border: '1px solid var(--clr-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--clr-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Meta Ad Account Funds & Spend Status
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--clr-text)', marginTop: 2 }}>
                {activeAcc.name} ({activeAcc.act_id})
              </div>
            </div>
            <button className="btn btn--secondary btn--sm" onClick={onRefresh} style={{ fontSize: 12, padding: '4px 10px' }}>
              ↻ Refresh Balance
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {accountBalance.available_balance_str ? (
              <div style={{ background: 'var(--clr-surface)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--clr-border)' }}>
                <div style={{ fontSize: 11, color: 'var(--clr-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>💳 Available Balance</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#25d366', fontFamily: 'var(--font-display)', marginTop: 4 }}>
                  ₹{accountBalance.available_balance_str}
                </div>
                <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 2 }}>Prepaid funds ready to spend</div>
              </div>
            ) : accountBalance.funding_source_display ? (
              <div style={{ background: 'var(--clr-surface)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--clr-border)' }}>
                <div style={{ fontSize: 11, color: 'var(--clr-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>💳 Funding Source</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#25d366', marginTop: 4 }}>
                  {accountBalance.funding_source_display}
                </div>
              </div>
            ) : null}

            {accountBalance.spend_cap_remaining_num !== null && accountBalance.spend_cap_remaining_num !== undefined && (
              <div style={{ background: 'var(--clr-surface)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--clr-border)' }}>
                <div style={{ fontSize: 11, color: 'var(--clr-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>🛑 Spend Cap Remaining</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1877f2', fontFamily: 'var(--font-display)', marginTop: 4 }}>
                  {formatCurrency(accountBalance.spend_cap_remaining_num * 100, activeAcc.currency)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 2 }}>
                  Cap limit: {formatCurrency((accountBalance.spend_cap_num || 0) * 100, activeAcc.currency)}
                </div>
              </div>
            )}

            <div style={{ background: 'var(--clr-surface)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--clr-border)' }}>
              <div style={{ fontSize: 11, color: 'var(--clr-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>💸 Total Lifetime Spent</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--clr-text)', fontFamily: 'var(--font-display)', marginTop: 4 }}>
                {formatCurrency((accountBalance.amount_spent_num || 0) * 100, activeAcc.currency)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--clr-text-3)', marginTop: 2 }}>Across all campaigns</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ color: 'var(--clr-text-2)', fontSize: 13 }}>{accounts.length} connected ad account{accounts.length !== 1 ? 's' : ''}</div>
        <button className="btn btn--primary btn--sm" onClick={() => setShowConnect(true)}>+ Connect Ad Account</button>
      </div>

      {accounts.length === 0 ? (
        <div className="ads-connect-banner">
          <div style={{ fontSize: 40, marginBottom: 12 }}>📣</div>
          <h3>Connect Your First Ad Account</h3>
          <p>You need a Facebook Business Ad Account to create campaigns. Paste your Access Token below to get started.</p>
          <button className="btn btn--primary" onClick={() => setShowConnect(true)}>🔗 Connect Now</button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Account</th><th>ID</th><th>Currency</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {accounts.map(a => {
                const isActive = a.id === activeAcc?.id || a.is_active;

                return (
                  <tr key={a.id} style={{ background: isActive ? 'rgba(37,211,102,.03)' : undefined }}>
                    <td style={{ fontWeight: 600 }}>
                      {a.name || 'Unnamed'}
                      {isActive && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--clr-primary)' }}>(Current Active)</span>}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.act_id}</td>
                    <td>{a.currency}</td>
                    <td>
                      {isActive ? (
                        <span className="badge badge--green">✓ Active</span>
                      ) : (
                        <button
                          className="btn btn--secondary btn--sm"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => onSwitchAccount && onSwitchAccount(a.id)}
                        >
                          👉 Switch to this
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn--danger btn--sm" onClick={() => handleDisconnect(a.id)} style={{ fontSize: 11, padding: '3px 8px' }}>Disconnect</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Connect Modal */}
      {showConnect && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowConnect(false)}>
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <div className="modal-title">🔗 Connect Meta Ad Account</div>
            <div style={{ fontSize: 13, color: 'var(--clr-text-2)', marginBottom: 16, lineHeight: 1.5 }}>
              Generate a <strong>System User Access Token</strong> with <code>ads_management</code> and <code>ads_read</code> permissions from your <a href="https://business.facebook.com" target="_blank" rel="noreferrer" style={{ color: 'var(--clr-primary)' }}>Meta Business Manager</a>.
            </div>

            {error && <div className="alert alert--error" style={{ marginBottom: 12 }}>{error}</div>}

            <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Access Token *</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Paste your System User Access Token (EAA...)"
                  value={accessToken}
                  onChange={e => setAccessToken(e.target.value)}
                  required
                  style={{ fontFamily: 'monospace', fontSize: 11 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn--secondary" onClick={fetchFromMeta} disabled={fetching || !accessToken.trim()} style={{ flexShrink: 0 }}>
                  {fetching ? '⏳ Fetching...' : '🔍 Fetch My Ad Accounts'}
                </button>
              </div>

              {metaAccounts.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Select Ad Account</label>
                  <select className="form-input" value={actId} onChange={e => setActId(e.target.value)}>
                    {metaAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id}) — {a.currency}</option>)}
                  </select>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowConnect(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={connecting || !accessToken.trim()}>
                  {connecting ? 'Connecting...' : '✅ Connect Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
