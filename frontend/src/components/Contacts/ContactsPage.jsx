import React, { useState, useEffect, useRef } from 'react';
import { listGroups, createGroup, deleteGroup, listContacts, createContact, deleteContact, importCSV } from '../../api/contacts.js';
import './Contacts.css';

const VERTICALS = ['school', 'ecomm', 'fintech', 'clinic', 'real-estate', 'edtech', 'retail', 'other'];

export default function ContactsPage() {
  const [groups,       setGroups]       = useState([]);
  const [contacts,     setContacts]     = useState([]);
  const [total,        setTotal]        = useState(0);
  const [activeGroup,  setActiveGroup]  = useState(null);
  const [search,       setSearch]       = useState('');
  const [loading,      setLoading]      = useState(true);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [groupForm,    setGroupForm]    = useState({ name: '', vertical: '' });
  const [contactForm,  setContactForm]  = useState({ name: '', phone: '', group_id: '' });
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error,        setError]        = useState('');
  const fileRef = useRef();

  useEffect(() => { loadGroups(); }, []);
  useEffect(() => { loadContacts(); }, [activeGroup, search]);

  async function loadGroups() {
    try {
      const data = await listGroups();
      setGroups(data.groups || []);
    } catch (e) { setError(e.message); }
  }

  async function loadContacts() {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (activeGroup) params.group_id = activeGroup;
      if (search) params.search = search;
      const data = await listContacts(params);
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleCreateGroup(e) {
    e.preventDefault();
    try {
      await createGroup(groupForm);
      setShowAddGroup(false);
      setGroupForm({ name: '', vertical: '' });
      loadGroups();
    } catch (e) { setError(e.message); }
  }

  async function handleDeleteGroup(id) {
    if (!confirm('Delete this group? Contacts will NOT be deleted.')) return;
    try { await deleteGroup(id); loadGroups(); if (activeGroup === id) setActiveGroup(null); }
    catch (e) { alert(e.message); }
  }

  async function handleCreateContact(e) {
    e.preventDefault();
    try {
      await createContact({ ...contactForm, group_id: contactForm.group_id || activeGroup || null });
      setShowAddContact(false);
      setContactForm({ name: '', phone: '', group_id: '' });
      loadContacts();
    } catch (e) { setError(e.message); }
  }

  async function handleDeleteContact(id) {
    if (!confirm('Delete this contact?')) return;
    try { await deleteContact(id); loadContacts(); }
    catch (e) { alert(e.message); }
  }

  async function handleFileImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null); setError('');
    try {
      const result = await importCSV(file, activeGroup);
      setImportResult(result);
      loadContacts(); loadGroups();
    } catch (e) { setError(e.message); }
    finally { setImporting(false); e.target.value = ''; }
  }

  return (
    <div className="contacts-page fade-in">
      <div className="page-header">
        <div>
          <h1>👥 Contacts</h1>
          <p>{total.toLocaleString()} contacts {activeGroup ? 'in this group' : 'total'}</p>
        </div>
        <div className="page-header__actions">
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileImport} />
          <button className="btn btn--secondary btn--sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? '⏳ Importing...' : '📤 Import CSV'}
          </button>
          <button className="btn btn--secondary btn--sm" onClick={() => setShowAddGroup(true)}>+ Group</button>
          <button className="btn btn--primary btn--sm" onClick={() => setShowAddContact(true)}>+ Contact</button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {importResult && <div className="alert alert--success">✅ {importResult.message}</div>}

      <div className="contacts-layout">
        {/* Sidebar: Groups */}
        <aside className="contacts-groups">
          <div className="contacts-groups__header">Groups</div>
          <div
            className={`contacts-groups__item${!activeGroup ? ' contacts-groups__item--active' : ''}`}
            onClick={() => setActiveGroup(null)}
          >
            <span>📋 All Contacts</span>
            <span className="badge badge--gray">{total}</span>
          </div>
          {groups.map(g => (
            <div
              key={g.id}
              className={`contacts-groups__item${activeGroup === g.id ? ' contacts-groups__item--active' : ''}`}
              onClick={() => setActiveGroup(g.id)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                {g.vertical && <div style={{ fontSize: 10, color: 'var(--clr-text-3)', textTransform: 'capitalize' }}>{g.vertical}</div>}
              </div>
              <button className="contacts-groups__del" onClick={e => { e.stopPropagation(); handleDeleteGroup(g.id); }}>✕</button>
            </div>
          ))}
        </aside>

        {/* Main: Contacts Table */}
        <div className="contacts-main">
          <div className="contacts-search-bar">
            <input
              className="form-input"
              type="text"
              placeholder="🔍 Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : contacts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <h3 style={{ marginBottom: 8 }}>No contacts found</h3>
              <p style={{ color: 'var(--clr-text-2)' }}>Import a CSV or add contacts manually.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Phone</th><th>Tags</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {contacts.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name || <span style={{ color: 'var(--clr-text-3)' }}>—</span>}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>+{c.phone}</td>
                      <td>{(c.tags || []).map(t => <span key={t} className="badge badge--blue" style={{ marginRight: 4, fontSize: 10 }}>{t}</span>)}</td>
                      <td>{c.opted_out ? <span className="badge badge--red">Opted Out</span> : <span className="badge badge--green">Active</span>}</td>
                      <td><button className="btn btn--danger btn--sm" onClick={() => handleDeleteContact(c.id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Group Modal */}
      {showAddGroup && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddGroup(false)}>
          <div className="modal-box">
            <div className="modal-title">➕ New Group</div>
            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Group Name *</label>
                <input className="form-input" placeholder="e.g. School Principals Delhi" value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Vertical</label>
                <select className="form-input" value={groupForm.vertical} onChange={e => setGroupForm(f => ({ ...f, vertical: e.target.value }))}>
                  <option value="">Select vertical...</option>
                  {VERTICALS.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowAddGroup(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddContact(false)}>
          <div className="modal-box">
            <div className="modal-title">➕ New Contact</div>
            <form onSubmit={handleCreateContact} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" placeholder="Chandan Mallik" value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input className="form-input" placeholder="919876543210" value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Assign to Group</label>
                <select className="form-input" value={contactForm.group_id || activeGroup || ''} onChange={e => setContactForm(f => ({ ...f, group_id: e.target.value }))}>
                  <option value="">No group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowAddContact(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary">Add Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
