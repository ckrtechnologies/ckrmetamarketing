import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getMe, isLoggedIn, logout } from './api/auth.js';
import Layout from './components/Layout/Layout.jsx';

import AuthPage      from './components/Auth/AuthPage.jsx';
import Dashboard     from './components/Dashboard/Dashboard.jsx';
import WABAPage      from './components/WhatsApp/WABAPage.jsx';
import ContactsPage  from './components/Contacts/ContactsPage.jsx';
import CampaignList  from './components/Campaign/CampaignList.jsx';
import TemplatesPage from './components/Templates/TemplatesPage.jsx';
import ChatPage      from './components/Chat/ChatPage.jsx';
import ReportsPage   from './components/Reports/ReportsPage.jsx';
import MediaManager  from './components/Media/MediaManager.jsx';

function ProtectedRoute({ user, org, title, children }) {
  if (!isLoggedIn() || !user) return <Navigate to="/login" replace />;
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
        .then(data => {
          if (data?.user) {
            setUser(data.user);
            setOrg(data.org);
          } else {
            logout();
            setUser(null);
            setOrg(null);
          }
        })
        .catch(() => {
          logout();
          setUser(null);
          setOrg(null);
        })
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
        <Route path="/templates" element={
          <ProtectedRoute user={user} org={org} title="Message Templates">
            <TemplatesPage />
          </ProtectedRoute>
        } />
        <Route path="/contacts" element={
          <ProtectedRoute user={user} org={org} title="Contacts">
            <ContactsPage />
          </ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute user={user} org={org} title="Live Chat">
            <ChatPage user={user} org={org} />
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute user={user} org={org} title="Analytics">
            <ReportsPage />
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

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
