import { describe, it, expect } from 'vitest';
import { styleRegistry, getStyle, getQuickSkins } from '@/config/styleRegistry';
import { materialRegistry } from '@/config/materialRegistry';
import type { StyleId } from '@/types/sceneObject';

describe('Style Registry', () => {
  it('contains exactly 17 styles', () => {
    expect(styleRegistry.size).toBe(17);
  });

  it('every style has defaultMaterials for common slots (frame, glass)', () => {
    for (const [, style] of styleRegistry) {
      expect(style.defaultMaterials).toHaveProperty('frame');
      expect(style.defaultMaterials).toHaveProperty('glass');
    }
  });

  it('every defaultMaterial references a valid material in materialRegistry', () => {
    for (const [, style] of styleRegistry) {
      for (const [, matId] of Object.entries(style.defaultMaterials)) {
        expect(materialRegistry.has(matId), `Material '${matId}' not found in materialRegistry (style: ${style.id})`).toBe(true);
      }
    }
  });

  it('every effect has a valid StyleEffectType', () => {
    const validTypes = new Set([
      'patina_tint', 'paper_glow', 'heat_shimmer', 'salt_frost',
      'reflection_tint', 'moss_glow', 'ember_warmth', 'soft_bloom',
      'dappled_light', 'edge_glow', 'layer_lines', 'gold_gleam',
      'frost_rim', 'clay_warmth', 'color_punch', 'matte_absorb',
    ]);
    for (const [, style] of styleRegistry) {
      for (const effect of style.effects) {
        expect(validTypes.has(effect.type)).toBe(true);
      }
    }
  });

  it('getStyle returns undefined for unknown ID', () => {
    expect(getStyle('nonexistent' as StyleId)).toBeUndefined();
  });

  it('getQuickSkins returns 5 presets per style for industrial', () => {
    const skins = getQuickSkins('industrial');
    expect(skins.length).toBe(5);
    for (const skin of skins) {
      expect(skin.styleId).toBe('industrial');
    }
  });
});
