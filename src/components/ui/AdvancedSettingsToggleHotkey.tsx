'use client';

/**
 * U5 second half: Surfaces the showAdvancedSettings flag without DevTools.
 *
 * Registers a global keyboard shortcut `Ctrl+Shift+A` (`Cmd+Shift+A` on Mac)
 * that toggles `useStore().showAdvancedSettings`. A brief toast announces
 * the new state.
 *
 * Plan: docs/plans/2026-05-18-001-feat-building-ux-industry-parity-plan.md (U5)
 * Origin: docs/brainstorms/2026-05-18-001-building-ux-requirements.md R5 / R6.
 *
 * Why a keyboard shortcut instead of an Inspector tab:
 * - Lower-risk integration (no surgery on the existing Inspector internals).
 * - Discoverable by power users; ignored by casual users (who don't even
 *   know the Smart/Manual pill is hidden — that's the whole point).
 * - Symmetric with industry-leader patterns (Figma `Ctrl+Shift+P` for
 *   command palette, Photoshop `Ctrl+K` for preferences).
 *
 * The toggle reuses the existing DestructiveToast layer to announce the
 * state change ("Advanced settings: ON" / "Advanced settings: OFF").
 */

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

export function AdvancedSettingsToggleHotkey() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Match Ctrl+Shift+A (or Cmd+Shift+A on Mac). Avoid clobbering
      // platform shortcuts (Ctrl+A select-all is Ctrl+A, not Shift+A).
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        const s = useStore.getState();
        s.toggleAdvancedSettings();
        const nowOn = useStore.getState().showAdvancedSettings;
        s.setLastDestructiveAction({
          description: `Advanced settings: ${nowOn ? 'ON' : 'OFF'}`,
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return null;
}
