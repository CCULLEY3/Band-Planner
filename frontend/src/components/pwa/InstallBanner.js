// src/components/pwa/InstallBanner.js
// ─────────────────────────────────────────────────────────────────────────────
//  Two components:
//    <InstallBanner />  — bottom slide-up bar with "Install App" CTA
//    <IOSInstallGuide/> — modal with step-by-step iOS Safari instructions
//
//  Design: stays on-brand with the dark industrial aesthetic.
//  On Android: one tap → native install prompt.
//  On iOS: tapping opens the guide showing Share → Add to Home Screen.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { useInstallPrompt } from '../../hooks/usePWA';
import './InstallBanner.css';

// ── iOS step-by-step guide ─────────────────────────────────────────────────
function IOSInstallGuide({ onClose }) {
  return (
    <div className="ios-overlay" onClick={onClose}>
      <div className="ios-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ios-handle" />

        <div className="ios-header">
          <div className="ios-icon">🎸</div>
          <div>
            <div className="ios-title">Install Band Planner</div>
            <div className="ios-sub">Add to your home screen</div>
          </div>
        </div>

        <div className="ios-steps">
          <div className="ios-step">
            <div className="ios-step-num">1</div>
            <div className="ios-step-body">
              <div className="ios-step-label">Tap the Share button</div>
              <div className="ios-step-hint">
                The <span className="ios-icon-inline">⬆</span> icon in Safari's toolbar
                — at the bottom on iPhone, top on iPad
              </div>
            </div>
          </div>

          <div className="ios-step-divider" />

          <div className="ios-step">
            <div className="ios-step-num">2</div>
            <div className="ios-step-body">
              <div className="ios-step-label">Scroll down and tap</div>
              <div className="ios-step-highlight">
                <span className="ios-icon-inline">＋</span> Add to Home Screen
              </div>
            </div>
          </div>

          <div className="ios-step-divider" />

          <div className="ios-step">
            <div className="ios-step-num">3</div>
            <div className="ios-step-body">
              <div className="ios-step-label">Tap Add</div>
              <div className="ios-step-hint">Band Planner will appear on your home screen like a native app</div>
            </div>
          </div>
        </div>

        <div className="ios-features">
          <div className="ios-feature"><span>⚡</span> Works offline</div>
          <div className="ios-feature"><span>🔔</span> Push notifications</div>
          <div className="ios-feature"><span>📱</span> Full-screen experience</div>
        </div>

        <button className="ios-close-btn" onClick={onClose}>
          Maybe Later
        </button>
      </div>

      {/* Arrow pointing at Safari share button */}
      <div className="ios-arrow-hint">
        <div className="ios-arrow-label">Tap Share here</div>
        <div className="ios-arrow">↓</div>
      </div>
    </div>
  );
}

// ── Install banner ─────────────────────────────────────────────────────────
export default function InstallBanner() {
  const { canInstall, isInstalled, isIOS, showIOSGuide, setShowIOSGuide, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible]     = useState(false);

  // Check if user already dismissed this session
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem('bp-install-dismissed');
    if (!wasDismissed && canInstall) {
      // Small delay so it doesn't pop up immediately on page load
      const t = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(t);
    }
  }, [canInstall]);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem('bp-install-dismissed', '1');
  };

  const handleInstall = () => {
    promptInstall(); // Shows Android prompt or iOS guide
  };

  if (!canInstall || isInstalled || dismissed || !visible) return null;

  return (
    <>
      <div className={`install-banner ${visible ? 'visible' : ''}`}>
        <div className="ib-icon">🎸</div>
        <div className="ib-body">
          <div className="ib-title">Install Band Planner</div>
          <div className="ib-sub">
            {isIOS ? 'Add to Home Screen for offline access' : 'Works offline · Push alerts · No app store'}
          </div>
        </div>
        <button className="ib-install-btn" onClick={handleInstall}>
          {isIOS ? 'How?' : 'Install'}
        </button>
        <button className="ib-dismiss" onClick={handleDismiss} aria-label="Dismiss">
          ✕
        </button>
      </div>

      {showIOSGuide && <IOSInstallGuide onClose={() => setShowIOSGuide(false)} />}
    </>
  );
}
