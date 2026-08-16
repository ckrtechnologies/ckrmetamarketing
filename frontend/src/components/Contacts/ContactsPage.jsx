import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listGroups, createGroup, updateGroup, deleteGroup,
  listContacts, listTags, createContact, updateContact, deleteContact,
  bulkDeleteContacts, bulkUpdateGroup, bulkUpdateStatus, importCSV
} from '../../api/contacts.js';
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
  const navigate = useNavigate();

  const [groups,        setGroups]        = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [contacts,      setContacts]      = useState([]);
  const [total,         setTotal]         = useState(0);
  const [activeGroup,   setActiveGroup]   = useState(null);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [tagFilter,     setTagFilter]     = useState('');
  const [loading,       setLoading]       = useState(true);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [showAddGroup,     setShowAddGroup]     = useState(false);
  const [editingGroup,     setEditingGroup]     = useState(null);
  const [showAddContact,   setShowAddContact]   = useState(false);
  const [editingContact,   setEditingContact]   = useState(null);
  const [showBulkGroupModal, setShowBulkGroupModal] = useState(false);
  const [bulkTargetGroup,  setBulkTargetGroup]  = useState('');

  // Forms
  const [groupForm,   setGroupForm]   = useState({ name: '', vertical: '' });
  const [contactForm, setContactForm] = useState({ name: '', phone: '', group_id: '', tags: '', city: '' });
  const [editForm,    setEditForm]    = useState({ id: '', name: '', phone: '', group_id: '', tags: '', opted_out: false, city: '' });

  // Import / Export
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error,        setError]        = useState('');
  const [saving,       setSaving]       = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    loadGroups();
    loadTags();
  }, []);

  useEffect(() => {
    loadContacts();
    setSelectedIds([]);
  }, [activeGroup, search, statusFilter, tagFilter]);

  async function loadGroups() {
    try {
      const data = await listGroups();
      setGroups(data.groups || []);
    } catch (e) { setError(e.message); }
  }

  async function loadTags() {
    try {
      const data = await listTags();
      setAvailableTags(data.tags || []);
    } catch (e) {}
  }

  async function loadContacts() {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (activeGroup) params.group_id = activeGroup;
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (tagFilter) params.tag = tagFilter;

      const data = await listContacts(params);
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  // ── Group Actions ───────────────────────────────────────────
  async function handleCreateGroup(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createGroup(groupForm);
      setShowAddGroup(false);
      setGroupForm({ name: '', vertical: '' });
      loadGroups();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  function startEditGroup(g) {
    setEditingGroup(g);
    setGroupForm({ name: g.name || '', vertical: g.vertical || '' });
  }

  async function handleUpdateGroup(e) {
    e.preventDefault();
    if (!editingGroup) return;
    setSaving(true);
    try {
      await updateGroup(editingGroup.id, groupForm);
      setEditingGroup(null);
      setGroupForm({ name: '', vertical: '' });
      loadGroups();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDeleteGroup(id) {
    if (!confirm('Delete this group? (Contacts inside will NOT be deleted, only unassigned)')) return;
    try {
      await deleteGroup(id);
      loadGroups();
      if (activeGroup === id) setActiveGroup(null);
      loadContacts();
    } catch (e) { alert(e.message); }
  }

  // ── Contact Single Actions ──────────────────────────────────
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
        metadata: contactForm.city.trim() ? { city: contactForm.city.trim() } : undefined,
      });
      setShowAddContact(false);
      setContactForm({ name: '', phone: '', group_id: '', tags: '', city: '' });
      loadContacts();
      loadGroups();
      loadTags();
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
      city: c.metadata?.city || '',
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
        metadata: editForm.city.trim() ? { city: editForm.city.trim() } : null,
      });
      setEditingContact(null);
      loadContacts();
      loadGroups();
      loadTags();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDeleteContact(id) {
    if (!confirm('Delete this contact?')) return;
    try {
      await deleteContact(id);
      loadContacts();
      loadGroups();
    } catch (e) { alert(e.message); }
  }

  // ── Multi-select Bulk Actions ───────────────────────────────
  function toggleSelectAll() {
    if (selectedIds.length === contacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map(c => c.id));
    }
  }

  function toggleSelectContact(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleBulkDelete() {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected contacts?`)) return;
    try {
      await bulkDeleteContacts(selectedIds);
      setSelectedIds([]);
      loadContacts();
      loadGroups();
    } catch (e) { alert(e.message); }
  }

  async function handleBulkMoveGroup(e) {
    e.preventDefault();
    try {
      await bulkUpdateGroup(selectedIds, bulkTargetGroup || null);
      setShowBulkGroupModal(false);
      setSelectedIds([]);
      loadContacts();
      loadGroups();
    } catch (e) { alert(e.message); }
  }

  async function handleBulkStatus(opted_out) {
    try {
      await bulkUpdateStatus(selectedIds, opted_out);
      setSelectedIds([]);
      loadContacts();
    } catch (e) { alert(e.message); }
  }

  // ── Import / Export CSV ─────────────────────────────────────
  function downloadSampleCSV() {
    const csvContent = "name,phone,tags,city\nRahul Sharma,919876543210,\"vip,lead\",Delhi\nPriya Patel,7982296878,\"customer,ecomm\",Mumbai\nDr. Amit Verma,+919811122233,\"clinic,doctor\",Bangalore\nSneha Gupta,9822334455,school,Pune\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contacts_sample_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportContactsToCSV() {
    const targetContacts = selectedIds.length > 0
      ? contacts.filter(c => selectedIds.includes(c.id))
      : contacts;

    if (targetContacts.length === 0) {
      alert('No contacts to export.');
      return;
    }

    const headers = ['Name', 'Phone', 'Group', 'Tags', 'City', 'Status', 'Created At'];
    const rows = targetContacts.map(c => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${c.phone || ''}"`,
      `"${(c.contact_groups?.name || '').replace(/"/g, '""')}"`,
      `"${(Array.isArray(c.tags) ? c.tags.join(', ') : '').replace(/"/g, '""')}"`,
      `"${(c.metadata?.city || '').replace(/"/g, '""')}"`,
      `"${c.opted_out ? 'Opted Out' : 'Active'}"`,
      `"${c.created_at || ''}"`,
    ]);

    const csvData = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contacts_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleFileImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null); setError('');
    try {
      const result = await importCSV(file, activeGroup);
      setImportResult(result);
      loadContacts();
      loadGroups();
      loadTags();
    } catch (e) { setError(e.message); }
    finally { setImporting(false); e.target.value = ''; }
  }

  return (
    <div className="contacts-page fade-in">
      <div className="page-header">
        <div>
          <h1>👥 Contact Management</h1>
          <p>{total.toLocaleString()} total contacts in CRM</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--ghost btn--sm" onClick={downloadSampleCSV} title="Download ready-to-use CSV template">
            📥 Sample CSV
          </button>
          <button className="btn btn--ghost btn--sm" onClick={exportContactsToCSV} title="Export contacts to CSV">
            📤 Export CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileImport} />
          <button className="btn btn--secondary btn--sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? '⏳ Importing...' : '📥 Import CSV'}
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
          <div className="contacts-groups__header">
            <span>Groups</span>
            <button
              className="btn btn--ghost btn--sm"
              style={{ padding: '2px 6px', fontSize: 11, color: 'var(--clr-primary)' }}
              onClick={() => setShowAddGroup(true)}
            >
              + Add
            </button>
          </div>
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
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.name}
                </div>
                {g.vertical && <div style={{ fontSize: 10, color: 'var(--clr-text-3)', textTransform: 'capitalize' }}>{g.vertical}</div>}
              </div>

              <span className="badge badge--gray" style={{ fontSize: 10 }}>
                {g.contact_count ?? 0}
              </span>

              <div className="contacts-groups__actions">
                <button
                  className="contacts-groups__btn"
                  title="Edit Group"
                  onClick={e => { e.stopPropagation(); startEditGroup(g); }}
                >
                  ✏️
                </button>
                <button
                  className="contacts-groups__btn contacts-groups__btn--del"
                  title="Delete Group"
                  onClick={e => { e.stopPropagation(); handleDeleteGroup(g.id); }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </aside>

        {/* Main Contacts Area */}
        <div className="contacts-main">
          {/* Advanced Filter Bar */}
          <div className="contacts-filter-bar">
            <input
              className="form-input contacts-search-input"
              type="text"
              placeholder="🔍 Search by name, phone number, city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            {/* Status Filter */}
            <select
              className="form-input contacts-filter-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="opted_out">Opted Out</option>
            </select>

            {/* Tag Filter */}
            {availableTags.length > 0 && (
              <select
                className="form-input contacts-filter-select"
                value={tagFilter}
                onChange={e => setTagFilter(e.target.value)}
              >
                <option value="">All Tags</option>
                {availableTags.map(t => (
                  <option key={t} value={t}>🏷️ {t}</option>
                ))}
              </select>
            )}

            {(search || statusFilter || tagFilter) && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => { setSearch(''); setStatusFilter(''); setTagFilter(''); }}
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Bulk Actions Toolbar (Visible when 1+ selected) */}
          {selectedIds.length > 0 && (
            <div className="contacts-bulk-bar">
              <div className="contacts-bulk-count">
                <span>☑️</span>
                <span>{selectedIds.length} contact{selectedIds.length > 1 ? 's' : ''} selected</span>
              </div>
              <div className="contacts-bulk-actions">
                <button className="btn btn--secondary btn--sm" onClick={() => setShowBulkGroupModal(true)}>
                  📁 Move to Group
                </button>
                <button className="btn btn--secondary btn--sm" onClick={() => handleBulkStatus(false)}>
                  ✅ Mark Active
                </button>
                <button className="btn btn--secondary btn--sm" onClick={() => handleBulkStatus(true)}>
                  🚫 Mark Opt-Out
                </button>
                <button className="btn btn--secondary btn--sm" onClick={exportContactsToCSV}>
                  📤 Export ({selectedIds.length})
                </button>
                <button className="btn btn--danger btn--sm" onClick={handleBulkDelete}>
                  🗑️ Delete Selected
                </button>
              </div>
            </div>
          )}

          {/* Contacts Table */}
          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : contacts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '56px 20px' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>📭</div>
              <h3 style={{ marginBottom: 8, fontSize: 16 }}>No contacts found</h3>
              <p style={{ color: 'var(--clr-text-2)', marginBottom: 16 }}>
                {search || statusFilter || tagFilter
                  ? 'No contacts match the current search or filters.'
                  : 'Import a CSV list or add your first contact manually.'
                }
              </p>
              <button className="btn btn--primary" onClick={() => setShowAddContact(true)}>
                + Add Contact
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        className="contact-checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === contacts.length}
                        onChange={toggleSelectAll}
                        title="Select All"
                      />
                    </th>
                    <th>Contact</th>
                    <th>Phone Number</th>
                    <th>Group</th>
                    <th>Tags</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => {
                    const isSelected = selectedIds.includes(c.id);
                    const initial = (c.name || 'U').charAt(0).toUpperCase();

                    return (
                      <tr key={c.id} style={{ background: isSelected ? 'rgba(37,211,102,0.06)' : undefined }}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            className="contact-checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectContact(c.id)}
                          />
                        </td>
                        <td>
                          <div className="contact-cell-name">
                            <div className="contact-avatar">{initial}</div>
                            <div>
                              <div className="contact-name-text">
                                {c.name || <span style={{ color: 'var(--clr-text-3)' }}>Unnamed</span>}
                              </div>
                              {c.metadata?.city && (
                                <div className="contact-city-sub">📍 {c.metadata.city}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--clr-text)' }}>
                            {formatPhoneDisplay(c.phone)}
                          </span>
                        </td>
                        <td>
                          {c.contact_groups?.name ? (
                            <span className="badge badge--blue" style={{ fontSize: 11 }}>
                              📁 {c.contact_groups.name}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--clr-text-3)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td>
                          {(c.tags && c.tags.length > 0)
                            ? c.tags.map(t => (
                                <span key={t} className="badge badge--gray" style={{ marginRight: 4, fontSize: 10 }}>
                                  🏷️ {t}
                                </span>
                              ))
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
                              style={{ padding: '3px 8px', fontSize: 11 }}
                              onClick={() => navigate('/chat')}
                              title="Send WhatsApp Message"
                            >
                              💬 Chat
                            </button>
                            <button
                              className="btn btn--secondary btn--sm"
                              style={{ padding: '3px 9px', fontSize: 11 }}
                              onClick={() => startEditContact(c)}
                              title="Edit Contact Details"
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
                    );
                  })}
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
            <div className="modal-title">➕ New Contact Group</div>
            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Group Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. School Principals Delhi / VIP Customers"
                  value={groupForm.name}
                  onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Target Industry / Vertical</label>
                <select
                  className="form-input"
                  value={groupForm.vertical}
                  onChange={e => setGroupForm(f => ({ ...f, vertical: e.target.value }))}
                >
                  <option value="">Select industry vertical...</option>
                  {VERTICALS.map(v => (
                    <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowAddGroup(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {editingGroup && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingGroup(null)}>
          <div className="modal-box">
            <div className="modal-title">✏️ Edit Group Details</div>
            <form onSubmit={handleUpdateGroup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Group Name *</label>
                <input
                  className="form-input"
                  value={groupForm.name}
                  onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Vertical</label>
                <select
                  className="form-input"
                  value={groupForm.vertical}
                  onChange={e => setGroupForm(f => ({ ...f, vertical: e.target.value }))}
                >
                  <option value="">Select industry vertical...</option>
                  {VERTICALS.map(v => (
                    <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setEditingGroup(null)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Group'}
                </button>
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
                <input
                  className="form-input"
                  placeholder="e.g. Rahul Sharma"
                  value={contactForm.name}
                  onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                />
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
                    Preview: <strong>{normalizeInputPreview(contactForm.phone)}</strong> (+91 auto-applied)
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Assign to Group</label>
                <select
                  className="form-input"
                  value={contactForm.group_id || activeGroup || ''}
                  onChange={e => setContactForm(f => ({ ...f, group_id: e.target.value }))}
                >
                  <option value="">No group (All Contacts)</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">City / Location</label>
                <input
                  className="form-input"
                  placeholder="e.g. Delhi / Mumbai"
                  value={contactForm.city}
                  onChange={e => setContactForm(f => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tags (comma separated)</label>
                <input
                  className="form-input"
                  placeholder="e.g. vip, lead, customer"
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
                  placeholder="e.g. Rahul Sharma"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  className="form-input"
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
                <select
                  className="form-input"
                  value={editForm.group_id}
                  onChange={e => setEditForm(f => ({ ...f, group_id: e.target.value }))}
                >
                  <option value="">No group (All Contacts)</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">City / Location</label>
                <input
                  className="form-input"
                  placeholder="e.g. Delhi / Mumbai"
                  value={editForm.city}
                  onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tags (comma separated)</label>
                <input
                  className="form-input"
                  placeholder="e.g. vip, lead, customer"
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
                  <option value="active">Active (Can receive WhatsApp messages)</option>
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

      {/* Bulk Move Group Modal */}
      {showBulkGroupModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBulkGroupModal(false)}>
          <div className="modal-box">
            <div className="modal-title">📁 Move {selectedIds.length} Contacts to Group</div>
            <form onSubmit={handleBulkMoveGroup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Select Destination Group</label>
                <select
                  className="form-input"
                  value={bulkTargetGroup}
                  onChange={e => setBulkTargetGroup(e.target.value)}
                >
                  <option value="">No Group (Unassign from current groups)</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowBulkGroupModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary">
                  Move Contacts
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
