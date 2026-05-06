/**
 * addStackedContainer — Behavioral tests.
 *
 * The helper is a one-step wrapper around addContainer + stackContainer that
 * also cleans up the orphan if stacking is rejected. It mirrors the production
 * right-click "Stack Container Above" flow in ContainerContextMenu.tsx.
 *
 * Real store actions, real state assertions. No source scanning.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import {
  ContainerSize,
  CONTAINER_DIMENSIONS,
  MAX_STACK_LEVEL,
} from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('addStackedContainer', () => {
  beforeEach(() => {
    resetStore();
  });

  it('basic stack: returns new id and sets level/stackedOn/y correctly', () => {
    const bottomId = useStore
      .getState()
      .addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    const newId = useStore.getState().addStackedContainer(bottomId);

    expect(newId).not.toBeNull();
    expect(typeof newId).toBe('string');

    const top = useStore.getState().containers[newId as string];
    const bottom = useStore.getState().containers[bottomId];
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];

    expect(top.level).toBe(1);
    expect(top.stackedOn).toBe(bottomId);
    expect(top.position.x).toBeCloseTo(bottom.position.x, 5);
    expect(top.position.z).toBeCloseTo(bottom.position.z, 5);
    expect(top.position.y).toBeCloseTo(dims.height, 2);
    expect(bottom.supporting).toContain(newId);
  });

  it('level cap rejection: returns null when bottom is at MAX_STACK_LEVEL', () => {
    // Build a tower up to MAX_STACK_LEVEL via the helper itself.
    let prevId = useStore
      .getState()
      .addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    for (let lvl = 1; lvl <= MAX_STACK_LEVEL; lvl++) {
      const next = useStore.getState().addStackedContainer(prevId);
      expect(next).not.toBeNull();
      prevId = next as string;
    }

    // Top of the tower is at MAX_STACK_LEVEL — one more should be rejected.
    const top = useStore.getState().containers[prevId];
    expect(top.level).toBe(MAX_STACK_LEVEL);

    const countBefore = Object.keys(useStore.getState().containers).length;
    const overflow = useStore.getState().addStackedContainer(prevId);
    const countAfter = Object.keys(useStore.getState().containers).length;

    expect(overflow).toBeNull();
    // No orphan left behind on rejection.
    expect(countAfter).toBe(countBefore);
  });

  it('missing bottom rejection: returns null when bottomId is unknown', () => {
    const countBefore = Object.keys(useStore.getState().containers).length;
    const result = useStore
      .getState()
      .addStackedContainer('does-not-exist');
    const countAfter = Object.keys(useStore.getState().containers).length;

    expect(result).toBeNull();
    expect(countAfter).toBe(countBefore);
  });

  it('returns null cleanly on stack failure (no orphan left in store)', () => {
    // Force stackContainer to reject by pre-stacking the bottom container so
    // its level is already at MAX_STACK_LEVEL. addStackedContainer's preflight
    // catches this case and returns null without ever calling addContainer,
    // so the container map size must be unchanged.
    let prevId = useStore
      .getState()
      .addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    for (let lvl = 1; lvl <= MAX_STACK_LEVEL; lvl++) {
      const next = useStore.getState().addStackedContainer(prevId);
      expect(next).not.toBeNull();
      prevId = next as string;
    }

    const before = Object.keys(useStore.getState().containers);
    const result = useStore.getState().addStackedContainer(prevId);
    const after = Object.keys(useStore.getState().containers);

    expect(result).toBeNull();
    expect(after.sort()).toEqual(before.sort());
  });

  it('size override: respects size argument when provided', () => {
    const bottomId = useStore
      .getState()
      .addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    const newId = useStore
      .getState()
      .addStackedContainer(bottomId, ContainerSize.Standard20);

    expect(newId).not.toBeNull();
    const top = useStore.getState().containers[newId as string];
    expect(top.size).toBe(ContainerSize.Standard20);
  });

  it('size default: inherits bottom size when size argument is omitted', () => {
    const bottomId = useStore
      .getState()
      .addContainer(ContainerSize.Standard20, { x: 5, y: 0, z: 7 });

    const newId = useStore.getState().addStackedContainer(bottomId);

    expect(newId).not.toBeNull();
    const top = useStore.getState().containers[newId as string];
    expect(top.size).toBe(ContainerSize.Standard20);
  });
});
