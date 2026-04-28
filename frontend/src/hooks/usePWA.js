// src/hooks/usePWA.js
// ─────────────────────────────────────────────────────────────────────────────
//  Manages everything PWA-related in one hook:
//    • Service worker registration
//    • Install prompt (Android "Add to Home Screen")
//    • iOS install instructions detection
//    • Online / offline status
//    • SW update detection
//    • Background sync queue for offline writes
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Service worker registration ───────────────────────────────────────────────
export function useServiceWorker() {
  const [registration, setRegistration] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none', // Always check network for SW updates
        });
        setRegistration(reg);

        // Check for an already-waiting update
        if (reg.waiting) setUpdateAvailable(true);

        // Listen for a new SW reaching "waiting" state
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });

        // Poll for updates every 30 minutes
        setInterval(() => reg.update(), 30 * 60 * 1000);

        console.log('[SW] Registered:', reg.scope);
      } catch (err) {
        console.error('[SW] Registration failed:', err);
      }
    };

    register();

    // Listen for messages from the SW (e.g. SYNC_COMPLETE)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        console.log(`[SW] Synced ${event.data.synced} queued request(s)`);
        window.dispatchEvent(new CustomEvent('bp:sync-complete', { detail: event.data }));
      }
    });
  }, []);

  // Apply the waiting SW update and reload
  const applyUpdate = useCallback(() => {
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }, [registration]);

  return { registration, updateAvailable, applyUpdate };
}

// ── Install prompt ─────────────────────────────────────────────────────────────
// Android: browser fires `beforeinstallprompt` — we capture and defer it
// iOS: browser never fires it — we detect and show manual instructions instead
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled,    setIsInstalled]    = useState(false);
  const [isIOS,          setIsIOS]          = useState(false);
  const [showIOSGuide,   setShowIOSGuide]   = useState(false);

  useEffect(() => {
    // Already running as installed PWA
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true; // iOS Safari
    if (standalone) { setIsInstalled(true); return; }

    // Detect iOS (Safari, Chrome for iOS, Firefox for iOS)
    const iosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iosDevice);

    // Android / Chrome: capture the install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Detect successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Trigger the Android install prompt
  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  }, [deferredPrompt, isIOS]);

  const canInstall = !isInstalled && (!!deferredPrompt || isIOS);

  return {
    canInstall,
    isInstalled,
    isIOS,
    showIOSGuide,
    setShowIOSGuide,
    promptInstall,
  };
}

// ── Online / offline status ────────────────────────────────────────────────────
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false); // true once after reconnect

  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  setWasOffline(true);  };
    const goOffline = () => { setIsOnline(false); setWasOffline(false); };

    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Auto-clear "back online" banner after 4 seconds
  useEffect(() => {
    if (!wasOffline) return;
    const t = setTimeout(() => setWasOffline(false), 4000);
    return () => clearTimeout(t);
  }, [wasOffline]);

  return { isOnline, wasOffline };
}

// ── Background sync queue ──────────────────────────────────────────────────────
// Queues a failed POST/PUT/DELETE into IndexedDB for retry when online.
// The SW reads this queue via the 'bp-sync-writes' sync tag.
export function useSyncQueue() {
  const enqueue = useCallback(async (url, method, headers, body) => {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
      // Background sync not supported — just retry immediately if online
      if (navigator.onLine) {
        return fetch(url, { method, headers, body });
      }
      return null;
    }

    const db    = await openIDB();
    const queue = (await getFromIDB(db, 'bp-sync-queue')) || [];
    queue.push({ url, method, headers, body, ts: Date.now() });
    await setInIDB(db, 'bp-sync-queue', queue);

    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('bp-sync-writes');
  }, []);

  return { enqueue };
}

// Tiny IndexedDB wrapper (same structure as in sw.js)
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('band-planner-sw', 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore('kv');
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

function getFromIDB(db, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction('kv', 'readonly').objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function setInIDB(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}
