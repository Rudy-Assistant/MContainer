import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getMaterialForFace, _themeMats } from '../config/materialCache';
import type { FaceFinish } from '../types/container';

describe('getMaterialForFace', () => {
  it('returns theme steel material when no finish override', () => {
    const mat = getMaterialForFace('Solid_Steel', undefined, 'industrial');
    expect(mat).toBe(_themeMats.industrial.steel);
  });
  it('returns theme glass material for Glass_Pane with no finish', () => {
    const mat = getMaterialForFace('Glass_Pane', undefined, 'industrial');
    expect(mat).toBe(_themeMats.industrial.glass);
  });
  it('returns theme wood material for Deck_Wood with no finish', () => {
    const mat = getMaterialForFace('Deck_Wood', undefined, 'industrial');
    expect(mat).toBe(_themeMats.industrial.wood);
  });
  it('applies paint color override — returns cloned material', () => {
    const mat = getMaterialForFace('Solid_Steel', { paint: '#FF0000' }, 'industrial');
    expect(mat).not.toBe(_themeMats.industrial.steel);
    expect((mat as THREE.MeshStandardMaterial).color.getHexString()).toBe('ff0000');
  });
  it('does NOT mutate singleton when applying paint', () => {
    const originalHex = _themeMats.industrial.steel.color.getHexString();
    getMaterialForFace('Solid_Steel', { paint: '#00FF00' }, 'industrial');
    expect(_themeMats.industrial.steel.color.getHexString()).toBe(originalHex);
  });
  it('caches paint materials — same input returns same instance', () => {
    const a = getMaterialForFace('Solid_Steel', { paint: '#0000FF' }, 'industrial');
    const b = getMaterialForFace('Solid_Steel', { paint: '#0000FF' }, 'industrial');
    expect(a).toBe(b);
  });
  it('applies tint to glass material', () => {
    const mat = getMaterialForFace('Glass_Pane', { tint: '#696969' }, 'industrial');
    expect(mat).not.toBe(_themeMats.industrial.glass);
    expect((mat as THREE.MeshPhysicalMaterial).color.getHexString()).toBe('696969');
  });
  it('resolves material override for wood exterior', () => {
    const mat = getMaterialForFace('Solid_Steel', { material: 'wood' }, 'industrial');
    expect(mat).toBe(_themeMats.industrial.wood);
  });
  it('resolves material override for concrete exterior', () => {
    const mat = getMaterialForFace('Solid_Steel', { material: 'concrete' }, 'industrial');
    expect(mat).toBe(_themeMats.industrial.concrete);
  });
  it('falls back to steel when material id is unknown', () => {
    const mat = getMaterialForFace('Solid_Steel', { material: 'unobtanium' }, 'industrial');
    expect(mat).toBe(_themeMats.industrial.steel);
  });
  it('paint takes precedence over material override', () => {
    const mat = getMaterialForFace('Solid_Steel', { material: 'wood', paint: '#FF0000' }, 'industrial');
    expect((mat as THREE.MeshStandardMaterial).color.getHexString()).toBe('ff0000');
  });
  it('applies frame color for window frames', () => {
    const mat = getMaterialForFace('Window_Standard', { frameColor: '#1A1A1A' }, 'industrial');
    expect(mat).not.toBe(_themeMats.industrial.frame);
    expect((mat as THREE.MeshStandardMaterial).color.getHexString()).toBe('1a1a1a');
  });
});
