// src/components/pwa/PWAStatusBars.js
// ─────────────────────────────────────────────────────────────────────────────
//  Three ambient status indicators:
//    <OfflineBanner />   — persistent orange bar when no connection
//    <BackOnlineToast /> — green flash when connectivity restores
//    <UpdateBanner />    — "New version available" with one-tap refresh
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { useOnlineStatus, useServiceWorker } from '../../hooks/usePWA';
import './PWAStatusBars.css';

// ── Offline banner (persistent while offline) ─────────────────────────────
export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <span className="ob-dot" />
      <span className="ob-text">No connection — showing cached data</span>
    </div>
  );
}

// ── Back online toast (fades out after 4s) ────────────────────────────────
export function BackOnlineToast() {
  const { wasOffline } = useOnlineStatus();
  if (!wasOffline) return null;

  return (
    <div className="back-online-toast" role="status" aria-live="polite">
      <span className="bot-icon">✓</span>
      <span>Back online</span>
    </div>
  );
}

// ── Update available banner ────────────────────────────────────────────────
export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useServiceWorker();
  if (!updateAvailable) return null;

  return (
    <div className="update-banner" role="alert">
      <span className="ub-icon">↑</span>
      <span className="ub-text">New version available</span>
      <button className="ub-btn" onClick={applyUpdate}>
        Update now
      </button>
    </div>
  );
}

// ── Composed export for convenience ──────────────────────────────────────────
export function PWAStatusBars() {
  return (
    <>
      <OfflineBanner />
      <BackOnlineToast />
      <UpdateBanner />
    </>
  );
}
