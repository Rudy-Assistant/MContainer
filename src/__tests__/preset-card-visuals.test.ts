import { describe, it, expect } from 'vitest';
import {
  PRESET_CARD_KEYFRAMES,
  getCardImageStyle,
  getCardLabelStyle,
} from '@/components/ui/finishes/PresetCard';

describe('PresetCard visual states', () => {
  it('PRESET_CARD_KEYFRAMES contains selectPop animation', () => {
    expect(PRESET_CARD_KEYFRAMES).toContain('@keyframes selectPop');
    expect(PRESET_CARD_KEYFRAMES).toContain('scale(1.08)');
    expect(PRESET_CARD_KEYFRAMES).toContain('scale(1.0)');
  });

  it('getCardImageStyle returns correct styles per state', () => {
    const defaultStyle = getCardImageStyle(false, false);
    expect(defaultStyle.transform).toBeUndefined();
    expect(defaultStyle.boxShadow).toBeUndefined();

    const hoverStyle = getCardImageStyle(false, true);
    expect(hoverStyle.transform).toBe('scale(1.04)');
    expect(hoverStyle.boxShadow).toContain('12px');

    const selectedStyle = getCardImageStyle(true, false);
    expect(selectedStyle.boxShadow).toContain('99,102,241');
  });

  it('getCardLabelStyle returns correct font weights', () => {
    expect(getCardLabelStyle(false, false).fontWeight).toBe(400);
    expect(getCardLabelStyle(false, true).fontWeight).toBe(600);
    expect(getCardLabelStyle(true, false).fontWeight).toBe(700);
    expect(getCardLabelStyle(true, true).fontWeight).toBe(700);
  });
});
