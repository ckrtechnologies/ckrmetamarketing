import React from 'react';
import Sidebar from './Sidebar.jsx';
import './Layout.css';

export default function Layout({ children, user, org, title }) {
  return (
    <div className="app-layout">
      <Sidebar user={user} org={org} />
      <div className="app-main">
        {title && (
          <header className="topbar">
            <span className="topbar__title">{title}</span>
            <div className="topbar__actions" />
          </header>
        )}
        <main className="app-content fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
