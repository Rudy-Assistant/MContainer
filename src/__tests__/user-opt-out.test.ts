/**
 * U6: Per-rule contextual Smart opt-out (userOptOut field on Voxel).
 *
 * Plan: docs/plans/2026-05-18-001-feat-building-ux-industry-parity-plan.md
 * Origin: docs/brainstorms/2026-05-18-001-building-ux-requirements.md R6.
 *
 * When a Smart rule fires, the user gets a brief inline affordance to opt
 * THIS specific face out of future auto-fixes. The opt-out lives in
 * voxel.userOptOut[face]=true and is consulted by isVoxelFaceProtected
 * alongside userPaintedFaces + presetProtectedFaces, so the smart-rule
 * cascade respects it identically.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { isVoxelFaceProtected, type Voxel, ContainerSize } from '@/types/container';
import { useStore } from '@/store/useStore';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('U6: userOptOut field + isVoxelFaceProtected integration (R6)', () => {
  beforeEach(() => resetStore());

  it('isVoxelFaceProtected returns true when userOptOut[face] is true', () => {
    const v: Pick<Voxel, 'userPaintedFaces' | 'presetProtectedFaces' | 'userOptOut'> = {
      userOptOut: { s: true },
    };
    expect(isVoxelFaceProtected(v, 's')).toBe(true);
  });

  it('isVoxelFaceProtected returns false when userOptOut is missing entirely', () => {
    const v: Pick<Voxel, 'userPaintedFaces' | 'presetProtectedFaces' | 'userOptOut'> = {};
    expect(isVoxelFaceProtected(v, 's')).toBe(false);
  });

  it('isVoxelFaceProtected respects all three flags with OR-semantics', () => {
    expect(isVoxelFaceProtected({ userPaintedFaces: { n: true } }, 'n')).toBe(true);
    expect(isVoxelFaceProtected({ presetProtectedFaces: { s: true } }, 's')).toBe(true);
    expect(isVoxelFaceProtected({ userOptOut: { e: true } }, 'e')).toBe(true);
    // none → false
    expect(isVoxelFaceProtected({ userPaintedFaces: {}, presetProtectedFaces: {}, userOptOut: {} }, 'w')).toBe(false);
  });

  it('setUserOptOut action sets userOptOut on the target voxel face', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    useStore.getState().setUserOptOut(id, 8, 's', true);
    const v = useStore.getState().containers[id].voxelGrid?.[8];
    expect(v?.userOptOut?.s).toBe(true);
  });

  it('setUserOptOut(false) clears the opt-out', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    useStore.getState().setUserOptOut(id, 8, 's', true);
    useStore.getState().setUserOptOut(id, 8, 's', false);
    const v = useStore.getState().containers[id].voxelGrid?.[8];
    expect(v?.userOptOut?.s).toBeFalsy();
  });
});
