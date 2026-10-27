import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from '../../api/auth.js';
import { getUnreadCount } from '../../api/chat.js';
import './Layout.css';

const NAV_ITEMS = [
  { path: '/dashboard',  icon: '📊', label: 'Dashboard',  color: '#4f46e5', bg: '#eef2ff' },
  { path: '/campaigns',  icon: '📣', label: 'Campaigns',  color: '#059669', bg: '#ecfdf5' },
  { path: '/templates',  icon: '📑', label: 'Templates',  color: '#10b981', bg: '#ecfdf5' },
  { path: '/contacts',   icon: '👥', label: 'Contacts',   color: '#2563eb', bg: '#eff6ff' },
  { path: '/chat',       icon: '💬', label: 'Live Chat',  color: '#00a884', bg: '#e6f7f3', badge: true },
  { path: '/media',      icon: '📁', label: 'Documents',  color: '#7c3aed', bg: '#f5f3ff' },
  { path: '/reports',    icon: '📈', label: 'Reports',    color: '#d97706', bg: '#fffbeb' },
  { path: '/waba',       icon: '📱', label: 'WA Numbers', color: '#0d9488', bg: '#f0fdfa' },
];

export default function Sidebar({ user, isOpen, onClose }) {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // Fetch unread count once on mount — no continuous polling
    getUnreadCount()
      .then(d => setUnread(d.unread || 0))
      .catch(() => {});
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
      <div className="sidebar__logo">
        <span className="sidebar__logo-icon">🟢</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sidebar__logo-brand">CKR Meta</div>
          <div className="sidebar__logo-sub">Marketing Panel</div>
        </div>
        {onClose && (
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">✕</button>
        )}
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => onClose && onClose()}
            className={({ isActive }) => `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`}
          >
            <span
              className="sidebar-icon-tile"
              style={{ background: item.bg, color: item.color }}
            >
              {item.icon}
            </span>
            <span className="sidebar__nav-label">{item.label}</span>
            {item.badge && unread > 0 && (
              <span className="sidebar__nav-badge">{unread > 99 ? '99+' : unread}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        {user && (
          <div className="sidebar__user">
            <div className="sidebar__user-avatar">{user.name?.[0]?.toUpperCase() || 'U'}</div>
            <div className="sidebar__user-meta">
              <div className="sidebar__user-name" title={user.name}>{user.name}</div>
              <div className="sidebar__user-role badge badge--gray">{user.role || 'Admin'}</div>
            </div>
          </div>
        )}
        <button onClick={handleLogout} className="sidebar__logout btn btn--ghost btn--sm">
          <span>🚪</span> Logout
        </button>
      </div>
    </aside>
  );
}
