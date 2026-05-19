/**
 * U5: Hide Smart/Manual toolbar toggle — advanced-settings preference.
 *
 * Plan: docs/plans/2026-05-18-001-feat-building-ux-industry-parity-plan.md
 * Origin: docs/brainstorms/2026-05-18-001-building-ux-requirements.md (R5, R6).
 *
 * The global Smart/Manual toolbar pill is hidden by default for casual
 * users (A1). Power users (A2) flip showAdvancedSettings=true to surface
 * it. This file tests the store-level preference contract; the conditional
 * render lives in TopToolbar.tsx and is visually verified.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('U5: showAdvancedSettings preference (R5, R6)', () => {
  beforeEach(() => resetStore());

  it('defaults to false (Smart/Manual pill hidden for new users)', () => {
    expect(useStore.getState().showAdvancedSettings).toBe(false);
  });

  it('setShowAdvancedSettings(true) opts power user in', () => {
    useStore.getState().setShowAdvancedSettings(true);
    expect(useStore.getState().showAdvancedSettings).toBe(true);
  });

  it('toggleAdvancedSettings flips the value', () => {
    useStore.getState().toggleAdvancedSettings();
    expect(useStore.getState().showAdvancedSettings).toBe(true);
    useStore.getState().toggleAdvancedSettings();
    expect(useStore.getState().showAdvancedSettings).toBe(false);
  });

  it('hiding the pill does NOT affect designMode behavior — Smart remains the invisible default', () => {
    // Acceptance: even with advanced settings off (pill hidden), the
    // underlying designMode still defaults to 'smart' and smart-rule
    // cascade runs normally. The pill is a UI surface, not a data toggle.
    expect(useStore.getState().showAdvancedSettings).toBe(false);
    expect(useStore.getState().designMode).toBe('smart');

    // designMode can still be set programmatically (power users use
    // setDesignMode via the Inspector → Advanced pane in a future unit;
    // for now keyboard/console access remains).
    useStore.getState().setDesignMode('manual');
    expect(useStore.getState().designMode).toBe('manual');
  });
});
