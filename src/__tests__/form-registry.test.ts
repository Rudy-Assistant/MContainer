import { describe, it, expect } from 'vitest';
import { formRegistry, getByCategory, getByStyle, getByCategoryAndStyle } from '@/config/formRegistry';
import { styleRegistry } from '@/config/styleRegistry';
import { materialRegistry } from '@/config/materialRegistry';

describe('Form Registry', () => {
  it('contains exactly 27 forms', () => {
    expect(formRegistry.size).toBe(27);
  });

  it('no duplicate form IDs', () => {
    const ids = [...formRegistry.keys()];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every form has all required fields', () => {
    for (const [id, form] of formRegistry) {
      expect(form.id).toBe(id);
      expect(['door', 'window', 'light', 'electrical']).toContain(form.category);
      expect(form.name.length).toBeGreaterThan(0);
      expect(['face', 'floor', 'ceiling']).toContain(form.anchorType);
      expect([1, 2, 3]).toContain(form.slotWidth);
      expect(form.skinSlots.length).toBeGreaterThan(0);
      expect(form.costEstimate).toBeGreaterThan(0);
    }
  });

  it('every form style references a valid style in styleRegistry', () => {
    for (const [, form] of formRegistry) {
      for (const styleId of form.styles) {
        expect(styleRegistry.has(styleId), `Style '${styleId}' not in styleRegistry (form: ${form.id})`).toBe(true);
      }
    }
  });

  it('every default skin references a valid material in materialRegistry', () => {
    for (const [, form] of formRegistry) {
      for (const [slot, matId] of Object.entries(form.defaultSkin)) {
        expect(materialRegistry.has(matId), `Material '${matId}' not in materialRegistry (form: ${form.id}, slot: ${slot})`).toBe(true);
      }
    }
  });

  it('slotWidth only meaningful for face-anchored forms', () => {
    for (const [, form] of formRegistry) {
      if (form.anchorType !== 'face') {
        expect(form.slotWidth).toBe(1);
      }
    }
  });

  it('getByCategory returns correct counts', () => {
    expect(getByCategory('door').length).toBe(8);
    expect(getByCategory('window').length).toBe(7);
    expect(getByCategory('light').length).toBe(8);
    expect(getByCategory('electrical').length).toBe(4);
  });

  it('getByStyle returns forms matching a style', () => {
    const japanese = getByStyle('japanese');
    expect(japanese.length).toBeGreaterThan(0);
    for (const form of japanese) {
      expect(form.styles).toContain('japanese');
    }
  });

  it('getByCategoryAndStyle intersects correctly', () => {
    const japDoors = getByCategoryAndStyle('door', 'japanese');
    for (const form of japDoors) {
      expect(form.category).toBe('door');
      expect(form.styles).toContain('japanese');
    }
  });
});
