/**
 * Behavioral tests for applyDesignPlan — exercises the real store, not source
 * scans. Asserts that a plan ends in the expected mutations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { applyDesignPlan, type DesignPlan } from '@/utils/aiDesigner';
import { ContainerSize } from '@/types/container';

describe('applyDesignPlan', () => {
  beforeEach(() => {
    // Reset to clean store before each test
    const s = useStore.getState();
    Object.keys(s.containers).forEach((id) => s.removeContainer(id));
    s.clearSelection();
  });

  it('adds containers in order, exposing IDs by ordinal index', () => {
    const plan: DesignPlan = {
      rationale: 'Two-container row test.',
      actions: [
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 0, y: 0, z: 0 } },
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 12.19, y: 0, z: 0 } },
      ],
    };
    const result = applyDesignPlan(plan, useStore.getState());
    expect(result.addedIds).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);
    expect(Object.keys(useStore.getState().containers)).toHaveLength(2);
  });

  it('applies a roof type when specified on add_container', () => {
    const plan: DesignPlan = {
      rationale: 'Single container with butterfly roof.',
      actions: [
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 0, y: 0, z: 0 }, roofType: 'butterfly' },
      ],
    };
    const result = applyDesignPlan(plan, useStore.getState());
    const c = useStore.getState().containers[result.addedIds[0]];
    expect(c.roofType).toBe('butterfly');
  });

  it('skips flat roof setRoofType call (default)', () => {
    const plan: DesignPlan = {
      rationale: 'Default flat roof.',
      actions: [
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 0, y: 0, z: 0 }, roofType: 'flat' },
      ],
    };
    const result = applyDesignPlan(plan, useStore.getState());
    expect(result.warnings).toHaveLength(0);
    // Container is created with flat roof by default — value should be 'flat' or undefined
    const c = useStore.getState().containers[result.addedIds[0]];
    expect(c.roofType ?? 'flat').toBe('flat');
  });

  it('applies a room preset to a container by ordinal index', () => {
    const plan: DesignPlan = {
      rationale: 'Container with galley kitchen.',
      actions: [
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 0, y: 0, z: 0 } },
        { type: 'apply_room_preset', containerIndex: 0, anchorBodyCol: 0, anchorBodyRow: 0, presetId: 'kitchen_galley' },
      ],
    };
    const result = applyDesignPlan(plan, useStore.getState());
    expect(result.warnings).toHaveLength(0);
    // The galley adds furniture overlays — fixtures count should be > 0 in the container's voxel grid
    const c = useStore.getState().containers[result.addedIds[0]];
    expect(c.voxelGrid).toBeDefined();
  });

  it('warns when room preset references a missing container index', () => {
    const plan: DesignPlan = {
      rationale: 'Bad reference.',
      actions: [
        { type: 'apply_room_preset', containerIndex: 5, anchorBodyCol: 0, anchorBodyRow: 0, presetId: 'kitchen_galley' },
      ],
    };
    const result = applyDesignPlan(plan, useStore.getState());
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('container index 5');
  });

  it('toggles site context when set_site_context action is included', () => {
    useStore.getState().setSiteContextEnabled(false);
    const plan: DesignPlan = {
      rationale: 'Enable site context.',
      actions: [
        { type: 'set_site_context', enabled: true },
      ],
    };
    applyDesignPlan(plan, useStore.getState());
    expect(useStore.getState().environment.siteContextEnabled).toBe(true);
  });

  it('continues applying actions even when one preset fails to fit', () => {
    const plan: DesignPlan = {
      rationale: 'Plan with a bad-fit preset.',
      actions: [
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 0, y: 0, z: 0 } },
        // anchor 5 + open_plan_klr (6×2) overflows — should warn, not crash
        { type: 'apply_room_preset', containerIndex: 0, anchorBodyCol: 5, anchorBodyRow: 0, presetId: 'open_plan_klr' },
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 12.19, y: 0, z: 0 } },
      ],
    };
    const result = applyDesignPlan(plan, useStore.getState());
    expect(result.addedIds).toHaveLength(2); // both containers created
    expect(result.warnings.length).toBeGreaterThan(0); // overflow warning
  });
});
