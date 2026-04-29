"use client";

/**
 * useExitTransition — Keep a component mounted for `durationMs` after its
 * controlling `open` flag flips false, so an exit animation has time to
 * play before unmount.
 *
 * Returned `state` is suitable for a `data-state` attribute that CSS can
 * key off of: `"open"` while open, `"closing"` during the exit window,
 * `"closed"` once unmounted (the consumer should `return null` then).
 *
 * Pattern:
 *   const { mounted, state } = useExitTransition(open, 200);
 *   if (!mounted) return null;
 *   return <div data-state={state}>…</div>;
 *
 * Without this, modals/dropdowns disappear in a single frame the moment
 * their open flag flips, which reads as a glitch — the eye expects the
 * UI element to retreat the same way it arrived.
 */

import { useEffect, useState } from 'react';

export type ExitTransitionState = 'open' | 'closing' | 'closed';

export function useExitTransition(open: boolean, durationMs = 200): {
  mounted: boolean;
  state: ExitTransitionState;
} {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<ExitTransitionState>(open ? 'open' : 'closed');

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two RAFs ensure the element is in the DOM with state="closed" first,
      // then transitions to state="open" so CSS enter animations fire even
      // when the element didn't exist a moment ago.
      const r1 = requestAnimationFrame(() => {
        const r2 = requestAnimationFrame(() => setState('open'));
        return () => cancelAnimationFrame(r2);
      });
      return () => cancelAnimationFrame(r1);
    }
    if (!mounted) return;
    setState('closing');
    const t = window.setTimeout(() => {
      setMounted(false);
      setState('closed');
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [open, mounted, durationMs]);

  return { mounted, state };
}
