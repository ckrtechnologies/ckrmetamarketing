import React, { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import ThemeToggle from '../Common/ThemeToggle.jsx';
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(prev => !prev)}
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <span className="topbar__title">{title || 'CKR Meta Marketing'}</span>
          </div>
          <div className="topbar__actions">
            <ThemeToggle />
          </div>
        </header>

        <main className="app-content fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}

