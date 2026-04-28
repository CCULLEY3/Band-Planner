// frontend/src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AuthContext = createContext(null);

// ─── Config ───────────────────────────────────────────────────────────────────
// On Vercel: API lives on the same domain at /api/*
// Locally:   CRA proxy (in package.json) forwards /api/* → localhost:4000
const API_BASE = '/api';
const TOKEN_KEY       = 'bp_access_token';
const REFRESH_MARGIN  = 60_000; // refresh 60s before expiry

// ─── Token utilities ──────────────────────────────────────────────────────────
const parseJwt = (token) => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch { return null; }
};

const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
const setStoredToken = (t) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

// ─── AuthProvider ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null);   // JWT payload
  const [accessToken,  setAccessToken]  = useState(getStoredToken);
  const [loading,      setLoading]      = useState(true);   // initial bootstrap
  const refreshTimerRef = useRef(null);

  // ── Schedule automatic token refresh ──────────────────────────────────────
  const scheduleRefresh = useCallback((token) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const decoded = parseJwt(token);
    if (!decoded?.exp) return;
    const msUntilRefresh = decoded.exp * 1000 - Date.now() - REFRESH_MARGIN;
    if (msUntilRefresh < 0) return; // already expired
    refreshTimerRef.current = setTimeout(() => doRefresh(), msUntilRefresh);
  }, []); 

  // ── Core refresh logic ────────────────────────────────────────────────────
  const doRefresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method:      'POST',
        credentials: 'include',      // sends httpOnly refresh cookie
      });
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      applyToken(data.accessToken, data.user);
    } catch {
      // Refresh failed — user must log in again
      clearAuth();
    }
  }, []); 

  const applyToken = useCallback((token, userData) => {
    setStoredToken(token);
    setAccessToken(token);
    setUser(userData || parseJwt(token));
    scheduleRefresh(token);
  }, [scheduleRefresh]);

  const clearAuth = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setStoredToken(null);
    setAccessToken(null);
    setUser(null);
  }, []);

  // ── Bootstrap: validate stored token on mount ─────────────────────────────
  useEffect(() => {
    const bootstrap = async () => {
      const stored = getStoredToken();
      if (stored) {
        const decoded = parseJwt(stored);
        const isExpired = !decoded?.exp || decoded.exp * 1000 < Date.now();
        if (!isExpired) {
          setUser(decoded);
          scheduleRefresh(stored);
          setLoading(false);
          return;
        }
      }
      // Try to refresh silently
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST', credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          applyToken(data.accessToken, data.user);
        } else {
          clearAuth();
        }
      } catch { clearAuth(); }
      setLoading(false);
    };
    bootstrap();
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, []); 

  // ── Auth actions ──────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    applyToken(data.accessToken, data.user);
    return data.user;
  };

  const register = async (fields) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(fields),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.errors?.[0]?.msg || data.error || 'Registration failed';
      throw new Error(msg);
    }
    applyToken(data.accessToken, data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch { /* ignore network errors on logout */ }
    clearAuth();
  };

  // ── Authenticated fetch helper ────────────────────────────────────────────
  // Automatically injects Authorization header and handles 401 by refreshing once
  const authFetch = useCallback(async (url, opts = {}) => {
    const token = getStoredToken();
    const doReq = (t) => fetch(url.startsWith('http') ? url : `${API_BASE}${url}`, {
      ...opts,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...opts.headers, Authorization: `Bearer ${t}` },
    });

    let res = await doReq(token);

    // Auto-refresh on 401 TOKEN_EXPIRED and retry once
    if (res.status === 401) {
      const body = await res.clone().json().catch(() => ({}));
      if (body.code === 'TOKEN_EXPIRED') {
        await doRefresh();
        const newToken = getStoredToken();
        if (newToken) res = await doReq(newToken);
      }
    }
    return res;
  }, [doRefresh]);

  // ── Role helpers ──────────────────────────────────────────────────────────
  const activeBand = user?.bands?.[0];  // first band is the "active" one
  const role       = activeBand?.role;
  const bandId     = activeBand?.bandId;

  const isLeader  = role === 'band_leader';
  const isManager = role === 'manager';
  const isMember  = !!role; // any membership

  const hasRole = (...roles) => roles.includes(role);

  const canManageGigs    = hasRole('band_leader', 'manager');
  const canManageTours   = hasRole('band_leader', 'manager');
  const canManageMembers = hasRole('band_leader');
  const canViewFinancials= isMember;
  const canEditFinancials= hasRole('band_leader', 'manager');

  const value = {
    user, accessToken, loading,
    login, logout, register, authFetch,
    role, bandId, activeBand,
    isLeader, isManager, isMember,
    hasRole,
    canManageGigs, canManageTours, canManageMembers,
    canViewFinancials, canEditFinancials,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export default AuthContext;
