'use client';

/**
 * U8: Destructive-action toast.
 *
 * Renders a brief "<description> — Ctrl+Z to undo" banner near the
 * top-right of the viewport whenever a destructive action fires. Auto-
 * fades after 2.5 seconds. Click to dismiss immediately.
 *
 * Plan: docs/plans/2026-05-18-001-feat-building-ux-industry-parity-plan.md (U8, R8, AE6)
 *
 * Data source: `useStore().lastDestructiveAction` set by destructive store
 * actions (currently removeContainer in containerSlice.ts; future
 * destructive actions hook in the same way).
 */

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';

const TTL_MS = 2500;

export function DestructiveToast() {
  const lda = useStore((s) => s.lastDestructiveAction);
  const setLda = useStore((s) => s.setLastDestructiveAction);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lda) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      // Clear the underlying state shortly after fade so a new identical
      // action retriggers correctly (different `at` timestamp).
      setTimeout(() => setLda(null), 200);
    }, TTL_MS);
    return () => clearTimeout(t);
    // We deliberately key on `at` so repeated actions reset the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lda?.at]);

  if (!lda) return null;

  return (
    <div
      onClick={() => setLda(null)}
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 64,
        right: 16,
        zIndex: 100,
        background: 'rgba(31, 41, 55, 0.92)',
        color: '#fff',
        padding: '10px 14px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-6px)',
        transition: 'opacity 180ms ease-out, transform 180ms ease-out',
        cursor: 'pointer',
        pointerEvents: visible ? 'auto' : 'none',
        userSelect: 'none',
      }}
      title="Click to dismiss"
    >
      {lda.description}
      <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 12 }}>— Ctrl+Z to undo</span>
    </div>
  );
}
