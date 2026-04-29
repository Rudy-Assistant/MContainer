"use client";

/**
 * ServiceWorkerRegistrar — Mounts in the root layout to register `/sw.js`
 * in production. Skipped in development to avoid the well-known Next.js
 * "stale chunk after edit" trap where the SW pins old JS while HMR ships
 * new code.
 */

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Defer registration past first paint — SW install fights initial-load
    // priorities for asset bandwidth.
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[sw] registration failed:', err);
      });
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
