import React, { useState, useEffect } from 'react';
import { listWabaAccounts, connectWaba, updateWaba, activateWaba, deleteWaba } from '../../api/waba.js';

export default function WABAPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ waba_id: '', phone_number_id: '', display_number: '', display_name: '', access_token: '' });
  const [editForm, setEditForm] = useState({ id: '', waba_id: '', phone_number_id: '', display_number: '', display_name: '', access_token: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    try {
      const data = await listWabaAccounts();
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await connectWaba(form);
      setShowModal(false);
      setForm({ waba_id: '', phone_number_id: '', display_number: '', display_name: '', access_token: '' });
      loadAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(acc) {
    setEditingAccount(acc);
    setEditForm({
      id: acc.id,
      waba_id: acc.waba_id || '',
      phone_number_id: acc.phone_number_id || '',
      display_number: acc.display_number || '',
      display_name: acc.display_name || '',
      access_token: '', // Keep blank unless updating
    });
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateWaba(editForm.id, {
        waba_id: editForm.waba_id.trim(),
        phone_number_id: editForm.phone_number_id.trim(),
        display_number: editForm.display_number.trim(),
        display_name: editForm.display_name.trim(),
        access_token: editForm.access_token.trim() || undefined,
      });
      setEditingAccount(null);
      loadAccounts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id) {
    try {
      await activateWaba(id);
      loadAccounts();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this WhatsApp number?')) return;
    try {
      await deleteWaba(id);
      loadAccounts();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>📱 WhatsApp Numbers</h1>
          <p>Connect and manage your WhatsApp Business accounts and phone numbers.</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            + Connect Number
          </button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : accounts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 20px' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>📵</div>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>No Numbers Connected</h2>
          <p style={{ color: 'var(--clr-text-2)', marginBottom: 20 }}>
            Connect a WhatsApp Business Account (WABA) to start sending campaigns.
          </p>
          <button className="btn btn--primary btn--lg" onClick={() => setShowModal(true)}>
            + Connect Your First Number
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Display Name</th>
                <th>Phone Number</th>
                <th>Phone Number ID</th>
                <th>WABA ID</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.id}>
                  <td style={{ fontWeight: 600 }}>{acc.display_name || '—'}</td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {acc.display_number || acc.phone_number_id}
                    </span>
                  </td>
                  <td style={{ color: 'var(--clr-text-3)', fontFamily: 'monospace', fontSize: 12 }}>
                    {acc.phone_number_id}
                  </td>
                  <td style={{ color: 'var(--clr-text-3)', fontFamily: 'monospace', fontSize: 12 }}>
                    {acc.waba_id}
                  </td>
                  <td>
                    {acc.is_active
                      ? <span className="badge badge--green">✓ Active</span>
                      : <span className="badge badge--gray">Inactive</span>
                    }
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        className="btn btn--secondary btn--sm"
                        style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={() => startEdit(acc)}
                        title="Edit WABA Account Details"
                      >
                        ✏️ Edit
                      </button>
                      {!acc.is_active && (
                        <button
                          className="btn btn--primary btn--sm"
                          style={{ padding: '4px 10px', fontSize: 11 }}
                          onClick={() => handleActivate(acc.id)}
                        >
                          Set Active
                        </button>
                      )}
                      <button
                        className="btn btn--danger btn--sm"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => handleDelete(acc.id)}
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

      {/* Connect Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box">
            <div className="modal-title">🔗 Connect WhatsApp Number</div>

            {error && <div className="alert alert--error">{error}</div>}

            <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { name: 'display_name',    label: 'Display Name',      placeholder: 'Healthy Manushya' },
                { name: 'display_number',  label: 'Display Number',    placeholder: '+91 78140 51127' },
                { name: 'phone_number_id', label: 'Phone Number ID',   placeholder: '443930708804530' },
                { name: 'waba_id',         label: 'WABA ID',           placeholder: '469743566216329' },
              ].map(field => (
                <div className="form-group" key={field.name}>
                  <label className="form-label">{field.label}</label>
                  <input
                    className="form-input"
                    type="text"
                    name={field.name}
                    value={form[field.name]}
                    onChange={e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))}
                    placeholder={field.placeholder}
                    required
                  />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Access Token (WhatsApp Cloud API)</label>
                <textarea
                  className="form-input"
                  name="access_token"
                  value={form.access_token}
                  onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))}
                  placeholder="EAANZBQCrNr..."
                  rows={3}
                  required
                  style={{ resize: 'vertical', minHeight: 72 }}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Verifying...</> : '🔗 Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingAccount && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingAccount(null)}>
          <div className="modal-box">
            <div className="modal-title">✏️ Edit WhatsApp Number Details</div>

            {error && <div className="alert alert--error">{error}</div>}

            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  className="form-input"
                  value={editForm.display_name}
                  onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="Healthy Manushya"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Display Number</label>
                <input
                  className="form-input"
                  value={editForm.display_number}
                  onChange={e => setEditForm(f => ({ ...f, display_number: e.target.value }))}
                  placeholder="+91 78140 51127"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number ID</label>
                <input
                  className="form-input"
                  value={editForm.phone_number_id}
                  onChange={e => setEditForm(f => ({ ...f, phone_number_id: e.target.value }))}
                  placeholder="443930708804530"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">WABA ID</label>
                <input
                  className="form-input"
                  value={editForm.waba_id}
                  onChange={e => setEditForm(f => ({ ...f, waba_id: e.target.value }))}
                  placeholder="469743566216329"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Access Token (leave blank to keep current token)</label>
                <textarea
                  className="form-input"
                  value={editForm.access_token}
                  onChange={e => setEditForm(f => ({ ...f, access_token: e.target.value }))}
                  placeholder="Enter new token only if you want to update it..."
                  rows={2}
                  style={{ resize: 'vertical', minHeight: 60 }}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--ghost" onClick={() => setEditingAccount(null)}>Cancel</button>
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
