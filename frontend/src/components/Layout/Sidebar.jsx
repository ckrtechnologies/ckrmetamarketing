import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth.js';
import './Layout.css';

const NAV_ITEMS = [
  { path: '/dashboard',  icon: '📊', label: 'Dashboard' },
  { path: '/campaigns',  icon: '📣', label: 'Campaigns' },
  { path: '/contacts',   icon: '👥', label: 'Contacts' },
  { path: '/chat',       icon: '💬', label: 'Live Chat' },
  { path: '/reports',    icon: '📈', label: 'Reports' },
  { path: '/waba',       icon: '📱', label: 'WhatsApp Numbers' },
  { path: '/settings',   icon: '⚙️',  label: 'Settings' },
];

export default function Sidebar({ user, org }) {
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <span className="sidebar__logo-icon">🟢</span>
        <div>
          <div className="sidebar__logo-brand">CKR Meta</div>
          <div className="sidebar__logo-sub">Marketing</div>
        </div>
      </div>

      {org && (
        <div className="sidebar__org-badge">
          <div className="sidebar__org-name">{org.name}</div>
          <div className="sidebar__org-plan badge badge--green">{org.plan || 'Starter'}</div>
        </div>
      )}

      <nav className="sidebar__nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`}
          >
            <span className="sidebar__nav-icon">{item.icon}</span>
            <span className="sidebar__nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        {user && (
          <div className="sidebar__user">
            <div className="sidebar__user-avatar">{user.name?.[0]?.toUpperCase() || 'U'}</div>
            <div className="sidebar__user-meta">
              <div className="sidebar__user-name">{user.name}</div>
              <div className="sidebar__user-role badge badge--gray">{user.role}</div>
            </div>
          </div>
        )}
        <button onClick={handleLogout} className="sidebar__logout btn btn--ghost btn--sm">
          ↩ Logout
        </button>
      </div>
    </aside>
  );
}
