// frontend/src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ProtectedRoute, RoleRoute, UnauthorizedPage } from './components/auth/ProtectedRoute';

// Pages
import AuthPage           from './pages/AuthPage';
import GigsPage           from './pages/GigsPage';
import CalendarPage       from './pages/CalendarPage';
import VenuesPage         from './pages/VenuesPage';
import TourMapPage        from './pages/TourMapPage';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import NotificationsPage  from './pages/NotificationsPage';
import ExportDemoPage     from './pages/ExportDemoPage';
import BandSettingsPage   from './pages/BandSettingsPage';

// ── Nav items ─────────────────────────────────────────────────────────────────
// icon: SVG path data (inline, no icon library dependency)
const NAV = [
  { to: '/gigs',          label: 'Gigs',          icon: 'M9 19V6l12-3v13M9 19c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-3c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z' },
  { to: '/calendar',      label: 'Calendar',       icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { to: '/tours',         label: 'Tours',          icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { to: '/venues',        label: 'Venues',         icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
  { to: '/analytics',     label: 'Analytics',      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { to: '/export',        label: 'Export',         icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
  { to: '/notifications', label: 'Notifications',  icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { to: '/settings',      label: 'Settings',       icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

// ── PWA install banner ─────────────────────────────────────────────────────────
function InstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e); setVisible(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="install-banner">
      <span className="ib-icon">📲</span>
      <span className="ib-text">Install Band Planner on your device</span>
      <button className="ib-btn" onClick={install}>Install</button>
      <button className="ib-close" onClick={() => setVisible(false)}>✕</button>
    </div>
  );
}

// ── Mobile bottom tab bar ──────────────────────────────────────────────────────
function BottomNav() {
  // Only show the 5 most important tabs on mobile
  const mobileNav = NAV.slice(0, 5);
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      {mobileNav.map(({ to, label, icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `bn-item ${isActive ? 'active' : ''}`}>
          <svg className="bn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
          <span className="bn-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

// ── Desktop sidebar ────────────────────────────────────────────────────────────
function Sidebar({ onClose }) {
  const { user, logout, role } = useAuth();
  const ROLE_COLOR = { band_leader: '#f0522a', manager: '#4a8cff', band_member: '#29cc6a', guest: '#5a5a72' };
  const initials = (user?.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sb-logo">🎸</span>
        <span className="sb-name">BAND<strong>PLANNER</strong></span>
        {onClose && (
          <button className="sb-close" onClick={onClose} aria-label="Close menu">✕</button>
        )}
      </div>

      <nav className="sidebar-nav">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to} to={to} onClick={onClose}
            className={({ isActive }) => `sn-item ${isActive ? 'active' : ''}`}
          >
            <svg className="sn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={icon} />
            </svg>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="su-avatar" style={{ background: ROLE_COLOR[role] || '#f0522a' }}>{initials}</div>
        <div className="su-info">
          <div className="su-name">{user?.name}</div>
          <div className="su-role" style={{ color: ROLE_COLOR[role] }}>
            {role?.replace('_', ' ') || 'member'}
          </div>
        </div>
        <button className="su-logout" onClick={logout} title="Sign out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}

// ── App shell: sidebar + mobile drawer + content ───────────────────────────────
function AppShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close drawer on navigation
  useEffect(() => setDrawerOpen(false), [location]);

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <div className="shell-sidebar">
        <Sidebar />
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="drawer-panel" onClick={e => e.stopPropagation()}>
            <Sidebar onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="shell-main">
        {/* Mobile header */}
        <header className="mobile-header">
          <button className="mh-menu" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <span className="mh-title">BAND<strong>PLANNER</strong></span>
          <div style={{ width: 40 }} />
        </header>

        <main className="shell-content" id="main-content">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomNav />
    </div>
  );
}

// ── Router ─────────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"        element={<AuthPage defaultMode="login"    />} />
      <Route path="/register"     element={<AuthPage defaultMode="register" />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected — any authenticated user */}
      <Route path="/gigs"      element={<ProtectedRoute><AppShell><GigsPage /></AppShell></ProtectedRoute>} />
      <Route path="/calendar"  element={<ProtectedRoute><AppShell><CalendarPage /></AppShell></ProtectedRoute>} />
      <Route path="/tours"     element={<ProtectedRoute><AppShell><TourMapPage /></AppShell></ProtectedRoute>} />
      <Route path="/venues"    element={<ProtectedRoute><AppShell><VenuesPage /></AppShell></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AppShell><AnalyticsDashboard /></AppShell></ProtectedRoute>} />
      <Route path="/export"    element={<ProtectedRoute><AppShell><ExportDemoPage /></AppShell></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><AppShell><NotificationsPage /></AppShell></ProtectedRoute>} />
      <Route path="/settings"  element={<ProtectedRoute><AppShell><BandSettingsPage /></AppShell></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="/"  element={<Navigate to="/gigs" replace />} />
      <Route path="*"  element={<Navigate to="/gigs" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider><AppProvider>
        <InstallBanner />
        <AppRoutes />
      </AppProvider></AuthProvider>
    </BrowserRouter>
  );
}
