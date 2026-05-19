'use client';

/**
 * First-launch announcement: tells returning users where the Smart/Manual
 * toggle went and how to surface it.
 *
 * Plan deferred #4 (now in-scope): "Tooltip on first-launch announcing
 * 'Smart mode is now the default'".
 *
 * Implementation: a small dismissible banner at the top-center on the
 * VERY FIRST launch after the Phase 5 building-UX batch lands. Uses
 * localStorage to record dismissal so it never shows again.
 *
 * Suppressed when:
 * - The user has already dismissed it (localStorage flag)
 * - The page hasn't hydrated yet (avoids SSR/hydration mismatch)
 */

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';

const STORAGE_KEY = 'mhome.first-launch-hint.phase5-buildingux.dismissed';

export function FirstLaunchHint() {
  const hasHydrated = useStore((s) => s._hasHydrated);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === '1') return;
      // Defer one tick so the page settles before the banner pops in
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    } catch {
      // localStorage unavailable (private mode, SSR) — don't show
    }
  }, [hasHydrated]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 110,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: 'rgba(37, 99, 235, 0.95)',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 500,
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <span>
        ✨ Smart mode is now the invisible default. The Smart/Manual toggle moved off the toolbar.
        Press <kbd style={{ background: 'rgba(255,255,255,0.18)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>Ctrl+Shift+A</kbd>{' '}
        to surface power-user settings.
      </span>
      <button
        onClick={dismiss}
        style={{
          background: 'rgba(255, 255, 255, 0.20)',
          color: '#fff',
          border: 'none',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Got it
      </button>
    </div>
  );
}
