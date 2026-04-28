// src/components/Sidebar.js
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import './Sidebar.css';

const NAV = [
  { to: '/',            label: 'Dashboard',     icon: '◈' },
  { to: '/calendar',   label: 'Calendar',      icon: '▦' },
  { to: '/gigs',       label: 'Gigs',          icon: '♪' },
  { to: '/tours',      label: 'Tours',         icon: '⟳' },
  { to: '/venues',     label: 'Venues',        icon: '◫' },
];

export default function Sidebar() {
  const { user, unreadCount, notifications } = useApp();
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <nav className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">♩</span>
          <div className="brand-text">
            <div className="brand-name">BAND<br/>PLANNER</div>
          </div>
        </div>

        <div className="sidebar-section-label">Navigation</div>
        <ul className="sidebar-nav">
          {NAV.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{icon}</span>
                <span className="nav-label">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="sidebar-divider" />
        <div className="sidebar-section-label">Band</div>
        <div className="sidebar-band">
          <div className="band-avatar">W</div>
          <div className="band-info">
            <div className="band-name">The Static Wolves</div>
            <div className="band-meta">Indie Rock · Austin TX</div>
          </div>
        </div>

        <div className="sidebar-spacer" />

        <button className="notif-btn" onClick={() => setNotifOpen(o => !o)}>
          <span>🔔</span>
          <span>Notifications</span>
          {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
        </button>

        <div className="sidebar-user">
          <div className="user-avatar">{user.name[0]}</div>
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{user.role.replace('_', ' ')}</div>
          </div>
        </div>
      </nav>

      {/* Notification panel */}
      {notifOpen && (
        <NotifPanel
          notifications={notifications}
          onClose={() => setNotifOpen(false)}
        />
      )}
    </>
  );
}

function NotifPanel({ notifications, onClose }) {
  const { markRead } = useApp();
  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <span>Notifications</span>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>
      <div className="notif-list">
        {notifications.length === 0 && (
          <div className="notif-empty">All caught up!</div>
        )}
        {notifications.map(n => (
          <div
            key={n.id}
            className={`notif-item ${n.read ? 'read' : 'unread'}`}
            onClick={() => markRead(n.id)}
          >
            <div className="notif-dot" />
            <div>
              <div className="notif-msg">{n.message}</div>
              <div className="notif-time">{new Date(n.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
