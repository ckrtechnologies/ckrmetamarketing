import React, { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import './Layout.css';

export default function Layout({ children, user, org, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        user={user}
        org={org}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="app-main">
        <header className="topbar">
          <div className="topbar__left">
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(prev => !prev)}
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <div className="topbar__breadcrumb">
              <span className="topbar__portal-tag">Meta Marketing</span>
              <span className="topbar__divider">/</span>
              <span className="topbar__title">{title || 'Dashboard'}</span>
            </div>
          </div>
          <div className="topbar__actions">
            <div className="topbar__status-pill badge badge--green" title="Meta Cloud API Connected">
              <span className="status-dot-pulse" />
              <span>Meta API v21.0 Connected</span>
            </div>
          </div>
        </header>

        <main className="app-content fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
