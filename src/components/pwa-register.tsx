'use client';

import { useEffect } from 'react';

/**
 * Registers the Field PWA service worker (install-to-home-screen + offline shell).
 * Rendered once from the root layout; no-ops when unsupported (desktop SSR, dev
 * still registers — Chrome ignores SW on http://localhost which is fine).
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Avoid clashing with Next dev HMR websocket churn in some setups.
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline support is progressive enhancement — never break the app */
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
