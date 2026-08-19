import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getMe, isLoggedIn } from './api/auth.js';
import Layout from './components/Layout/Layout.jsx';

import AuthPage      from './components/Auth/AuthPage.jsx';
import Dashboard     from './components/Dashboard/Dashboard.jsx';
import WABAPage      from './components/WhatsApp/WABAPage.jsx';
import ContactsPage  from './components/Contacts/ContactsPage.jsx';
import CampaignList  from './components/Campaign/CampaignList.jsx';
import ChatPage      from './components/Chat/ChatPage.jsx';
import ReportsPage   from './components/Reports/ReportsPage.jsx';
import AdsPage       from './components/Ads/AdsPage.jsx';
import MediaManager  from './components/Media/MediaManager.jsx';

const Placeholder = ({ name }) => (
  <div className="card fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
    <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
    <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--clr-text)', marginBottom: 8 }}>{name}</h2>
    <p style={{ color: 'var(--clr-text-2)' }}>Coming soon.</p>
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
        <Route path="/campaigns" element={
          <ProtectedRoute user={user} org={org} title="Campaigns">
            <CampaignList />
          </ProtectedRoute>
        } />
        <Route path="/contacts" element={
          <ProtectedRoute user={user} org={org} title="Contacts">
            <ContactsPage />
          </ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute user={user} org={org} title="Live Chat">
            <ChatPage user={user} />
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute user={user} org={org} title="Analytics">
            <ReportsPage />
          </ProtectedRoute>
        } />
        <Route path="/ads" element={
          <ProtectedRoute user={user} org={org} title="Ads Manager">
            <AdsPage />
          </ProtectedRoute>
        } />
        <Route path="/media" element={
          <ProtectedRoute user={user} org={org} title="Media & Documents">
            <MediaManager />
          </ProtectedRoute>
        } />
        <Route path="/waba" element={
          <ProtectedRoute user={user} org={org} title="WhatsApp Numbers">
            <WABAPage />
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
