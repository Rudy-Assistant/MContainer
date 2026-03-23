import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyStyleEffects, applyEmberWarmth } from '@/utils/styleEffects';
import type { StyleEffect } from '@/types/sceneObject';

describe('Style Effects', () => {
  it('patina_tint lerps color toward rust orange', () => {
    const mat = new THREE.MeshStandardMaterial({ color: '#888888' });
    const origR = mat.color.r;
    applyStyleEffects(mat, [{ type: 'patina_tint', color: '#b44a1a', intensity: 0.15 }]);
    // Color should shift toward orange (r increases)
    expect(mat.color.r).toBeGreaterThan(origR);
  });

  it('paper_glow sets emissive and transparency', () => {
    const mat = new THREE.MeshStandardMaterial();
    applyStyleEffects(mat, [{ type: 'paper_glow', intensity: 0.3 }]);
    expect(mat.emissiveIntensity).toBeCloseTo(0.3);
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeCloseTo(0.85);
  });

  it('heat_shimmer sets emissive color and intensity', () => {
    const mat = new THREE.MeshStandardMaterial();
    applyStyleEffects(mat, [{ type: 'heat_shimmer', color: '#ff6b00', intensity: 0.2 }]);
    expect(mat.emissiveIntensity).toBeCloseTo(0.2);
    expect(mat.emissive.getHexString()).not.toBe('000000');
  });

  it('reflection_tint boosts envMapIntensity', () => {
    const mat = new THREE.MeshStandardMaterial();
    applyStyleEffects(mat, [{ type: 'reflection_tint' }]);
    expect(mat.envMapIntensity).toBeCloseTo(1.8);
  });

  it('moss_glow sets green emissive', () => {
    const mat = new THREE.MeshStandardMaterial();
    applyStyleEffects(mat, [{ type: 'moss_glow' }]);
    expect(mat.emissiveIntensity).toBeCloseTo(0.15);
    // Green channel should dominate
    const hsl = { h: 0, s: 0, l: 0 };
    mat.emissive.getHSL(hsl);
    expect(hsl.h).toBeGreaterThan(0.2);
    expect(hsl.h).toBeLessThan(0.45);
  });

  it('ember_warmth sets warm emissive on material', () => {
    const mat = new THREE.MeshStandardMaterial();
    applyStyleEffects(mat, [{ type: 'ember_warmth', intensity: 0.1 }]);
    expect(mat.emissiveIntensity).toBeCloseTo(0.1);
  });

  it('gold_gleam reduces roughness and boosts metalness', () => {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.8 });
    applyStyleEffects(mat, [{ type: 'gold_gleam' }]);
    expect(mat.roughness).toBeCloseTo(0.3);
    expect(mat.metalness).toBeCloseTo(0.96);
  });

  it('frost_rim sets icy blue emissive', () => {
    const mat = new THREE.MeshStandardMaterial();
    applyStyleEffects(mat, [{ type: 'frost_rim' }]);
    expect(mat.emissiveIntensity).toBeCloseTo(0.1);
    // Blue channel should be prominent
    expect(mat.emissive.b).toBeGreaterThan(mat.emissive.r);
  });

  it('clay_warmth lerps color and bumps roughness', () => {
    const mat = new THREE.MeshStandardMaterial({ color: '#888888', roughness: 0.5 });
    applyStyleEffects(mat, [{ type: 'clay_warmth', intensity: 0.1 }]);
    expect(mat.roughness).toBeCloseTo(0.6);
  });

  it('matte_absorb crushes specular', () => {
    const mat = new THREE.MeshStandardMaterial();
    applyStyleEffects(mat, [{ type: 'matte_absorb' }]);
    expect(mat.envMapIntensity).toBeCloseTo(0.05);
    expect(mat.roughness).toBeCloseTo(0.95);
  });

  it('color_punch boosts saturation', () => {
    const mat = new THREE.MeshStandardMaterial({ color: '#4488cc' });
    const hsl1 = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(hsl1);
    applyStyleEffects(mat, [{ type: 'color_punch', intensity: 0.15 }]);
    const hsl2 = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(hsl2);
    expect(hsl2.s).toBeGreaterThan(hsl1.s);
  });

  it('layer_lines bumps roughness', () => {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
    applyStyleEffects(mat, [{ type: 'layer_lines' }]);
    expect(mat.roughness).toBeCloseTo(0.65);
  });

  it('deferred effects are no-ops', () => {
    const mat = new THREE.MeshStandardMaterial({ color: '#888888' });
    const origColor = mat.color.clone();
    const origRoughness = mat.roughness;
    applyStyleEffects(mat, [
      { type: 'salt_frost' },
      { type: 'soft_bloom' },
      { type: 'dappled_light' },
      { type: 'edge_glow' },
    ]);
    expect(mat.color.equals(origColor)).toBe(true);
    expect(mat.roughness).toBe(origRoughness);
  });

  it('multiple effects compose sequentially', () => {
    const mat = new THREE.MeshStandardMaterial({ color: '#888888', roughness: 0.5 });
    applyStyleEffects(mat, [
      { type: 'clay_warmth', intensity: 0.1 },
      { type: 'color_punch', intensity: 0.15 },
    ]);
    // roughness should be bumped by clay_warmth
    expect(mat.roughness).toBeCloseTo(0.6);
    // saturation should be boosted by color_punch on the already-clay-tinted color
    const hsl = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(hsl);
    expect(hsl.s).toBeGreaterThan(0);
  });
});

describe('applyEmberWarmth (light helper)', () => {
  it('returns null when no ember_warmth effect', () => {
    const effects: StyleEffect[] = [{ type: 'gold_gleam' }];
    expect(applyEmberWarmth(effects, new THREE.Color('#ffffff'), 4)).toBeNull();
  });

  it('warms color and extends distance', () => {
    const effects: StyleEffect[] = [{ type: 'ember_warmth', intensity: 0.3 }];
    const result = applyEmberWarmth(effects, new THREE.Color('#ffffff'), 4);
    expect(result).not.toBeNull();
    expect(result!.distance).toBeCloseTo(5.2);
    // Color should be shifted toward orange (r stays high, b decreases)
    expect(result!.color.r).toBeGreaterThan(result!.color.b);
  });
});
