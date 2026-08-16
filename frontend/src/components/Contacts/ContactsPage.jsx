import React, { useState, useEffect, useRef } from 'react';
import { listGroups, createGroup, deleteGroup, listContacts, createContact, updateContact, deleteContact, importCSV } from '../../api/contacts.js';
import './Contacts.css';

const VERTICALS = ['school', 'ecomm', 'fintech', 'clinic', 'real-estate', 'edtech', 'retail', 'other'];

function formatPhoneDisplay(phone) {
  if (!phone) return '—';
  const clean = String(phone).replace(/\D/g, '');
  if (clean.startsWith('91') && clean.length === 12) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return `+${clean}`;
}

function normalizeInputPreview(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (digits.length === 10) digits = '91' + digits;
  return formatPhoneDisplay(digits);
}

export default function ContactsPage() {
  const [groups,       setGroups]       = useState([]);
  const [contacts,     setContacts]     = useState([]);
  const [total,        setTotal]        = useState(0);
  const [activeGroup,  setActiveGroup]  = useState(null);
  const [search,       setSearch]       = useState('');
  const [loading,      setLoading]      = useState(true);
  
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  
  const [groupForm,    setGroupForm]    = useState({ name: '', vertical: '' });
  const [contactForm,  setContactForm]  = useState({ name: '', phone: '', group_id: '', tags: '' });
  const [editForm,     setEditForm]     = useState({ id: '', name: '', phone: '', group_id: '', tags: '', opted_out: false });
  
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error,        setError]        = useState('');
  const [saving,       setSaving]       = useState(false);
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
    setSaving(true);
    setError('');
    try {
      await createContact({
        name: contactForm.name.trim() || undefined,
        phone: contactForm.phone.trim(),
        group_id: contactForm.group_id || activeGroup || null,
        tags: contactForm.tags ? contactForm.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
      });
      setShowAddContact(false);
      setContactForm({ name: '', phone: '', group_id: '', tags: '' });
      loadContacts();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  function startEditContact(c) {
    setEditingContact(c);
    setEditForm({
      id: c.id,
      name: c.name || '',
      phone: c.phone || '',
      group_id: c.group_id || '',
      tags: Array.isArray(c.tags) ? c.tags.join(', ') : (c.tags || ''),
      opted_out: Boolean(c.opted_out),
    });
  }

  async function handleUpdateContact(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateContact(editForm.id, {
        name: editForm.name.trim() || null,
        phone: editForm.phone.trim(),
        group_id: editForm.group_id || null,
        tags: editForm.tags ? editForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        opted_out: editForm.opted_out,
      });
      setEditingContact(null);
      loadContacts();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
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

  function downloadSampleCSV() {
    const csvContent = "name,phone,tags,city\nRahul Sharma,919876543210,\"vip,lead\",Delhi\nPriya Patel,7982296878,\"customer,ecomm\",Mumbai\nDr. Amit Verma,+919811122233,\"clinic,doctor\",Bangalore\nSneha Gupta,9822334455,school,Pune\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'contacts_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="contacts-page fade-in">
      <div className="page-header">
        <div>
          <h1>👥 Contacts</h1>
          <p>{total.toLocaleString()} contacts {activeGroup ? 'in this group' : 'total'}</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--ghost btn--sm" onClick={downloadSampleCSV} title="Download ready-to-use CSV template">
            📥 Sample CSV
          </button>
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
                  <tr>
                    <th>Name</th>
                    <th>Phone Number</th>
                    <th>Tags</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name || <span style={{ color: 'var(--clr-text-3)' }}>—</span>}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--clr-text)' }}>
                          {formatPhoneDisplay(c.phone)}
                        </span>
                      </td>
                      <td>
                        {(c.tags && c.tags.length > 0)
                          ? c.tags.map(t => <span key={t} className="badge badge--blue" style={{ marginRight: 4, fontSize: 10 }}>{t}</span>)
                          : <span style={{ color: 'var(--clr-text-3)', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td>
                        {c.opted_out
                          ? <span className="badge badge--red">Opted Out</span>
                          : <span className="badge badge--green">Active</span>
                        }
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn btn--secondary btn--sm"
                            style={{ padding: '3px 9px', fontSize: 11 }}
                            onClick={() => startEditContact(c)}
                            title="Edit Contact"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn--danger btn--sm"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => handleDeleteContact(c.id)}
                            title="Delete Contact"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
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
                <input className="form-input" placeholder="e.g. Chandan Mallik" value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  className="form-input"
                  placeholder="e.g. 7982296878 or +91 79822 96878"
                  value={contactForm.phone}
                  onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                  required
                />
                {contactForm.phone && (
                  <div style={{ fontSize: 11, color: 'var(--clr-primary)', marginTop: 4 }}>
                    Preview: <strong>{normalizeInputPreview(contactForm.phone)}</strong> (+91 auto-applied for 10-digit numbers)
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Assign to Group</label>
                <select className="form-input" value={contactForm.group_id || activeGroup || ''} onChange={e => setContactForm(f => ({ ...f, group_id: e.target.value }))}>
                  <option value="">No group (All Contacts)</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tags (comma separated)</label>
                <input
                  className="form-input"
                  placeholder="e.g. vip, principal, delhi"
                  value={contactForm.tags}
                  onChange={e => setContactForm(f => ({ ...f, tags: e.target.value }))}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowAddContact(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {editingContact && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingContact(null)}>
          <div className="modal-box">
            <div className="modal-title">✏️ Edit Contact</div>
            <form onSubmit={handleUpdateContact} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. Chandan Mallik"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  className="form-input"
                  placeholder="e.g. 7982296878 or +91 79822 96878"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  required
                />
                {editForm.phone && (
                  <div style={{ fontSize: 11, color: 'var(--clr-primary)', marginTop: 4 }}>
                    Preview: <strong>{normalizeInputPreview(editForm.phone)}</strong> (+91 auto-applied)
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Group</label>
                <select className="form-input" value={editForm.group_id} onChange={e => setEditForm(f => ({ ...f, group_id: e.target.value }))}>
                  <option value="">No group (All Contacts)</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tags (comma separated)</label>
                <input
                  className="form-input"
                  placeholder="e.g. vip, lead, delhi"
                  value={editForm.tags}
                  onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-input"
                  value={editForm.opted_out ? 'opted_out' : 'active'}
                  onChange={e => setEditForm(f => ({ ...f, opted_out: e.target.value === 'opted_out' }))}
                >
                  <option value="active">Active (Can receive messages)</option>
                  <option value="opted_out">Opted Out (Do not message)</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setEditingContact(null)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
