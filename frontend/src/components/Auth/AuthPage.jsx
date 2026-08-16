import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, register } from '../../api/auth.js';
import './AuthPage.css';

export default function AuthPage({ onAuth, mode }) {
  const navigate = useNavigate();
  const isRegister = mode === 'register';

  const [form, setForm]   = useState({ org_name: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      if (isRegister) {
        data = await register(form);
      } else {
        data = await login({ email: form.email, password: form.password });
      }
      onAuth(data.user, data.org);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow--1" />
      <div className="auth-glow auth-glow--2" />

      <div className="auth-box fade-in">
        <div className="auth-logo">
          <span>🟢</span>
          <div>
            <div className="auth-logo-brand">CKR Meta Marketing</div>
            <div className="auth-logo-tagline">WhatsApp Campaign Platform</div>
          </div>
        </div>

        <h1 className="auth-title">
          {isRegister ? 'Create your organization' : 'Welcome back'}
        </h1>
        <p className="auth-subtitle">
          {isRegister
            ? 'Set up your team and WhatsApp Business account.'
            : 'Sign in to manage your WhatsApp campaigns.'}
        </p>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <>
              <div className="form-group">
                <label className="form-label">Organization Name</label>
                <input
                  className="form-input"
                  type="text"
                  name="org_name"
                  value={form.org_name}
                  onChange={handleChange}
                  placeholder="e.g. CKR Technologies"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Your Full Name</label>
                <input
                  className="form-input"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Chandan Mallik"
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder={isRegister ? 'Min. 8 characters' : 'Your password'}
              required
            />
          </div>

          <button type="submit" className="btn btn--primary btn--lg auth-submit" disabled={loading}>
            {loading
              ? <><span className="spinner" style={{ width: 18, height: 18 }} /> Loading...</>
              : isRegister ? '🚀 Create Organization' : '→ Sign In'
            }
          </button>
        </form>

        <div className="auth-switch">
          {isRegister
            ? <span>Already have an account? <Link to="/login">Sign in</Link></span>
            : <span>No account yet? <Link to="/register">Create one free</Link></span>
          }
        </div>
      </div>
    </div>
  );
}
