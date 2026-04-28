// src/components/MobileNav.js
// ─────────────────────────────────────────────────────────────────────────────
//  Bottom tab bar — visible only on mobile (≤768px).
//  Sits above the iOS home indicator using env(safe-area-inset-bottom).
//  Active tab has an orange pip and label; inactive tabs show icon only.
//  Haptic feedback on tap (navigator.vibrate — Android only).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Can } from './auth/ProtectedRoute';
import './MobileNav.css';

const TABS = [
  { to: '/gigs',      icon: GigIcon,      label: 'Gigs'     },
  { to: '/calendar',  icon: CalIcon,       label: 'Calendar' },
  { to: '/tours',     icon: MapIcon,       label: 'Tours'    },
  { to: '/analytics', icon: ChartIcon,     label: 'Stats'    },
  { to: '/settings',  icon: SettingsIcon,  label: 'Settings' },
];

function Tab({ to, icon: Icon, label }) {
  const location   = useLocation();
  const isActive   = location.pathname.startsWith(to);

  const handleTap = () => {
    // Brief haptic on Android
    if ('vibrate' in navigator) navigator.vibrate(6);
  };

  return (
    <NavLink
      to={to}
      className={`mobile-tab ${isActive ? 'active' : ''}`}
      onClick={handleTap}
      aria-label={label}
    >
      <div className="mt-icon-wrap">
        <Icon active={isActive} />
        {isActive && <div className="mt-pip" />}
      </div>
      <span className="mt-label">{label}</span>
    </NavLink>
  );
}

export default function MobileNav() {
  return (
    <nav className="mobile-nav" role="navigation" aria-label="Main navigation">
      {TABS.map((tab) => (
        <Tab key={tab.to} {...tab} />
      ))}
    </nav>
  );
}

// ── SVG icons (stroke-based, scale cleanly at any size) ──────────────────────

function GigIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#f0522a' : 'currentColor'} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function CalIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#f0522a' : 'currentColor'} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  );
}

function MapIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#f0522a' : 'currentColor'} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9"  y1="3"  x2="9"  y2="18" />
      <line x1="15" y1="6"  x2="15" y2="21" />
    </svg>
  );
}

function ChartIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#f0522a' : 'currentColor'} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4"  />
      <line x1="6"  y1="20" x2="6"  y2="14" />
      <line x1="2"  y1="20" x2="22" y2="20" />
    </svg>
  );
}

function SettingsIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#f0522a' : 'currentColor'} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
