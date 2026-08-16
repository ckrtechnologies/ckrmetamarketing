import React, { useState, useEffect } from 'react';
import { listWabaAccounts, connectWaba, activateWaba, deleteWaba } from '../../api/waba.js';

export default function WABAPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ waba_id: '', phone_number_id: '', display_number: '', display_name: '', access_token: '' });
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
                <th>WABA ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.id}>
                  <td style={{ fontWeight: 600 }}>{acc.display_name || '—'}</td>
                  <td>{acc.display_number || acc.phone_number_id}</td>
                  <td style={{ color: 'var(--clr-text-3)', fontFamily: 'monospace', fontSize: 12 }}>{acc.waba_id}</td>
                  <td>
                    {acc.is_active
                      ? <span className="badge badge--green">✓ Active</span>
                      : <span className="badge badge--gray">Inactive</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!acc.is_active && (
                        <button className="btn btn--secondary btn--sm" onClick={() => handleActivate(acc.id)}>
                          Set Active
                        </button>
                      )}
                      <button className="btn btn--danger btn--sm" onClick={() => handleDelete(acc.id)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box">
            <div className="modal-title">🔗 Connect WhatsApp Number</div>

            {error && <div className="alert alert--error">{error}</div>}

            <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { name: 'waba_id',         label: 'WABA ID',           placeholder: '469743566216329' },
                { name: 'phone_number_id', label: 'Phone Number ID',   placeholder: '443930708804530' },
                { name: 'display_number',  label: 'Display Number',    placeholder: '+91 78140 51127' },
                { name: 'display_name',    label: 'Display Name',      placeholder: 'Dr. Vineet Chadha' },
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
                  placeholder="EAAxxxxxxx..."
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
    </div>
  );
}
