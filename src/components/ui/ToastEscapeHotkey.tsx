'use client';

/**
 * Global Esc-to-dismiss for all ephemeral toasts.
 *
 * When the user presses Esc and any toast is currently visible, all three
 * ephemeral state fields are cleared in one go:
 * - lastDestructiveAction (DestructiveToast)
 * - lastSmartRuleFire (SmartRuleToast)
 * - lastStackedPair (AutoStairsAffordance)
 *
 * Esc on the canvas otherwise has its existing meanings (exit walkthrough,
 * clear selection, etc.) — this hotkey only fires when at least one toast
 * is currently rendered, and it stops propagation so the underlying handler
 * doesn't ALSO fire on the same keystroke.
 */

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

export function ToastEscapeHotkey() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useStore.getState();
      const hasToast =
        !!s.lastDestructiveAction || !!s.lastSmartRuleFire || !!s.lastStackedPair;
      if (!hasToast) return;
      e.stopPropagation();
      e.preventDefault();
      s.setLastDestructiveAction(null);
      s.setLastSmartRuleFire(null);
      s.setLastStackedPair(null);
    };
    // Use capture phase so this fires BEFORE downstream Esc handlers
    // (walkthrough exit, selection clear) when a toast is up.
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  return null;
}
