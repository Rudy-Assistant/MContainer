/**
 * Sprint B1+B2 — WelcomeWizard visibility-decision tests.
 *
 * Component-render tests would require @testing-library/react which is
 * not in the project's dep set. The wizard's visibility decision lives
 * in a pure helper (`shouldShowWelcomeWizard`) which is fully testable
 * without a DOM.
 */

import { describe, it, expect } from 'vitest';
import {
  shouldShowWelcomeWizard,
  WELCOME_WIZARD_STORAGE_KEY,
} from '@/components/ui/WelcomeWizard';

describe('shouldShowWelcomeWizard (Sprint B1+B2)', () => {
  it('returns false before hydration', () => {
    expect(shouldShowWelcomeWizard(false, 0, null)).toBe(false);
  });

  it('returns false when localStorage seen flag is set', () => {
    expect(shouldShowWelcomeWizard(true, 0, '1')).toBe(false);
  });

  it('returns false when containers already exist (returning user)', () => {
    expect(shouldShowWelcomeWizard(true, 1, null)).toBe(false);
    expect(shouldShowWelcomeWizard(true, 5, null)).toBe(false);
  });

  it('returns true on first launch with empty canvas + unseen', () => {
    expect(shouldShowWelcomeWizard(true, 0, null)).toBe(true);
    // Empty-string in localStorage is not "1" → still show.
    expect(shouldShowWelcomeWizard(true, 0, '')).toBe(true);
  });

  it('exports a stable storage key', () => {
    expect(WELCOME_WIZARD_STORAGE_KEY).toBe('mhome.welcome-wizard.seen');
  });
});
