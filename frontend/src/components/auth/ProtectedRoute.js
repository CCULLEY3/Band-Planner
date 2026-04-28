// frontend/src/components/auth/ProtectedRoute.js
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ─── ProtectedRoute ────────────────────────────────────────────────────────────
// Redirects unauthenticated users to /login, preserving intended destination.
//
// Usage:
//   <Route path="/gigs" element={<ProtectedRoute><GigsPage /></ProtectedRoute>} />
export function ProtectedRoute({ children, fallback = null }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return fallback || <AuthSpinner />;
  if (!user)   return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// ─── RoleRoute ────────────────────────────────────────────────────────────────
// Extends ProtectedRoute — also checks that the user has one of the required roles.
// Unauthenticated → /login; authenticated but wrong role → /unauthorized (or custom).
//
// Usage:
//   <Route path="/settings"
//     element={
//       <RoleRoute roles={['band_leader']}>
//         <BandSettingsPage />
//       </RoleRoute>
//     }
//   />
export function RoleRoute({ children, roles = [], redirectTo = '/unauthorized' }) {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) return <AuthSpinner />;
  if (!user)   return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles.length && !hasRole(...roles))
    return <Navigate to={redirectTo} replace />;
  return children;
}

// ─── AuthSpinner ──────────────────────────────────────────────────────────────
// Shown while AuthContext is bootstrapping (checking stored token on page load).
export function AuthSpinner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg, #0d0d10)',
    }}>
      <div style={{
        width: 40, height: 40,
        border: '3px solid rgba(255,255,255,0.08)',
        borderTopColor: '#f0522a',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── withRole HOC ─────────────────────────────────────────────────────────────
// Higher-order component version.
// Wraps a component and renders null (or a fallback) if role check fails.
//
// Usage:
//   const LeaderOnlyBtn = withRole(DeleteButton, ['band_leader']);
export function withRole(Component, roles = [], Fallback = null) {
  return function WithRoleWrapper(props) {
    const { hasRole } = useAuth();
    if (!hasRole(...roles)) return Fallback ? <Fallback {...props} /> : null;
    return <Component {...props} />;
  };
}

// ─── Can component ────────────────────────────────────────────────────────────
// Inline conditional rendering based on role.
//
// Usage:
//   <Can roles={['band_leader', 'manager']}>
//     <button onClick={deleteGig}>Delete Gig</button>
//   </Can>
//
//   <Can roles={['band_leader']} fallback={<span>View only</span>}>
//     <EditForm />
//   </Can>
export function Can({ roles = [], fallback = null, children }) {
  const { hasRole, isMember } = useAuth();
  const allowed = roles.length === 0 ? isMember : hasRole(...roles);
  return allowed ? children : fallback;
}

// ─── Unauthorized page ────────────────────────────────────────────────────────
export function UnauthorizedPage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 16,
      background: 'var(--bg, #0d0d10)', color: 'var(--text, #f0f0f4)',
      fontFamily: 'monospace',
    }}>
      <div style={{ fontSize: 64, fontFamily: 'Bebas Neue, monospace', color: '#f0522a' }}>403</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Access Denied</div>
      <div style={{ fontSize: 13, color: '#5a5a72' }}>You don't have permission to view this page.</div>
      <a href="/gigs" style={{ marginTop: 8, color: '#f0522a', fontSize: 13 }}>← Back to Gigs</a>
    </div>
  );
}
