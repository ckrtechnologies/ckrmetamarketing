import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getMe, isLoggedIn } from './api/auth.js';
import Layout from './components/Layout/Layout.jsx';

// ── Lazy page imports ────────────────────────────────────────────
import AuthPage   from './components/Auth/AuthPage.jsx';
import Dashboard  from './components/Dashboard/Dashboard.jsx';
import WABAPage   from './components/WhatsApp/WABAPage.jsx';

// ── Placeholder pages (to build in later phases) ─────────────────
const Placeholder = ({ name }) => (
  <div className="card fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
    <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
    <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--clr-text)', marginBottom: 8 }}>{name}</h2>
    <p style={{ color: 'var(--clr-text-2)' }}>Coming in the next phase of development.</p>
  </div>
);

function ProtectedRoute({ user, org, title, children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return (
    <Layout user={user} org={org} title={title}>
      {children}
    </Layout>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [org,  setOrg]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoggedIn()) {
      getMe()
        .then(data => { setUser(data.user); setOrg(data.org); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<AuthPage onAuth={(u, o) => { setUser(u); setOrg(o); }} mode="login" />} />
        <Route path="/register" element={<AuthPage onAuth={(u, o) => { setUser(u); setOrg(o); }} mode="register" />} />

        <Route path="/dashboard" element={
          <ProtectedRoute user={user} org={org} title="Dashboard">
            <Dashboard user={user} org={org} />
          </ProtectedRoute>
        } />
        <Route path="/waba" element={
          <ProtectedRoute user={user} org={org} title="WhatsApp Numbers">
            <WABAPage />
          </ProtectedRoute>
        } />
        <Route path="/campaigns" element={
          <ProtectedRoute user={user} org={org} title="Campaigns">
            <Placeholder name="Campaigns — Phase 2" />
          </ProtectedRoute>
        } />
        <Route path="/contacts" element={
          <ProtectedRoute user={user} org={org} title="Contacts">
            <Placeholder name="Contacts — Phase 2" />
          </ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute user={user} org={org} title="Live Chat">
            <Placeholder name="Live Chat — Phase 3" />
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute user={user} org={org} title="Reports">
            <Placeholder name="Reports — Phase 4" />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute user={user} org={org} title="Settings">
            <Placeholder name="Settings — Coming Soon" />
          </ProtectedRoute>
        } />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
