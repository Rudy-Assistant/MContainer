import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createGhostMaterial } from '@/utils/ghostMaterial';

describe('createGhostMaterial', () => {
  it('returns transparent clone with 0.30 opacity', () => {
    const base = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const ghost = createGhostMaterial(base);
    expect(ghost).not.toBe(base);
    expect(ghost.transparent).toBe(true);
    expect(ghost.opacity).toBeCloseTo(0.30);
    expect(ghost.depthWrite).toBe(false);
  });

  it('caches — same base returns same clone', () => {
    const base = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const ghost1 = createGhostMaterial(base);
    const ghost2 = createGhostMaterial(base);
    expect(ghost1).toBe(ghost2);
  });

  it('different base materials return different clones', () => {
    const base1 = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const base2 = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    const ghost1 = createGhostMaterial(base1);
    const ghost2 = createGhostMaterial(base2);
    expect(ghost1).not.toBe(ghost2);
  });

  it('handles MeshPhysicalMaterial (glass)', () => {
    const base = new THREE.MeshPhysicalMaterial({ transmission: 0.9 });
    const ghost = createGhostMaterial(base);
    expect(ghost.transparent).toBe(true);
    expect(ghost.opacity).toBeCloseTo(0.30);
  });
});
