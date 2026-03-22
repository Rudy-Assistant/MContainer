import { describe, it, expect } from 'vitest';
import { WIZARD_PRESETS, type WizardStep } from '@/config/wizardPresets';

describe('Wizard presets', () => {
  it('has at least 6 presets', () => {
    expect(WIZARD_PRESETS.length).toBeGreaterThanOrEqual(6);
  });

  it('all presets have unique ids', () => {
    const ids = WIZARD_PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all presets have non-empty steps', () => {
    for (const p of WIZARD_PRESETS) {
      expect(p.steps.length).toBeGreaterThan(0);
    }
  });

  it('full_glass_home preset has extensions + paint + open_interior steps', () => {
    const preset = WIZARD_PRESETS.find(p => p.id === 'full_glass_home');
    expect(preset).toBeDefined();
    const actions = preset!.steps.map(s => s.action);
    expect(actions).toContain('extensions');
    expect(actions).toContain('paint_outer_walls');
    expect(actions).toContain('open_interior_walls');
  });

  it('roof_deck_combo preset includes rooftop_deck step', () => {
    const preset = WIZARD_PRESETS.find(p => p.id === 'roof_deck_combo');
    expect(preset).toBeDefined();
    const actions = preset!.steps.map(s => s.action);
    expect(actions).toContain('rooftop_deck');
  });
});
