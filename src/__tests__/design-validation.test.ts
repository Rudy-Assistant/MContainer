/**
 * Design Validation Tests (VAL-1 through VAL-12)
 *
 * Tests for all 7 validation rules plus the validateDesign entry point.
 * Real store actions, real state assertions. No source scanning.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';
import {
  checkUnprotectedEdges, checkStairToNowhere, checkNoExit,
  checkNoEnvelope, checkGravity, checkUnsupportedCantilever,
  checkBudget, validateDesign,
} from '@/utils/designValidation';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('Validation: checkUnprotectedEdges', () => {
  beforeEach(() => resetStore());

  it('VAL-1: Ground-level open-air voxel does NOT trigger unprotected edge warning', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const containers = useStore.getState().containers;
    const warnings = checkUnprotectedEdges(containers);
    const containerWarnings = warnings.filter(w => w.containerId === id);
    expect(containerWarnings).toHaveLength(0);
  });

  it('VAL-2: Elevated container with open top + open wall triggers warning', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 2.9, z: 0 });
    const voxelIndex = 9; // level 0, row 1, col 1
    useStore.getState().paintFace(id, voxelIndex, 'top', 'Open');
    useStore.getState().paintFace(id, voxelIndex, 'n', 'Open');

    const containers = useStore.getState().containers;
    expect(containers[id].position.y).toBeGreaterThan(0.1);

    const warnings = checkUnprotectedEdges(containers);
    const myWarnings = warnings.filter(w => w.containerId === id);
    expect(myWarnings.length).toBeGreaterThan(0);
    expect(myWarnings[0].category).toBe('safety');
    expect(myWarnings[0].severity).toBe('warning');
  });

  it('VAL-5: Default container produces no unprotected edge warnings', () => {
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const containers = useStore.getState().containers;
    const warnings = checkUnprotectedEdges(containers);
    expect(warnings).toHaveLength(0);
  });
});

describe('Validation: checkStairToNowhere', () => {
  beforeEach(() => resetStore());

  it('VAL-3: Stair with no upper container triggers stair-to-nowhere warning', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const containers = useStore.getState().containers;
    const c = containers[id];
    const voxelIndex = 41; // level 1, row 1, col 1
    const newGrid = c.voxelGrid!.map((v, i) =>
      i === voxelIndex ? { ...v, stairPart: 'upper' as const, active: true } : v
    );
    useStore.setState({
      containers: { ...containers, [id]: { ...c, voxelGrid: newGrid } },
    });

    const warnings = checkStairToNowhere(useStore.getState().containers);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].category).toBe('safety');
    expect(warnings[0].containerId).toBe(id);
  });
});

describe('Validation: validateDesign', () => {
  beforeEach(() => resetStore());

  it('VAL-4: validateDesign returns array', () => {
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const containers = useStore.getState().containers;
    const result = validateDesign(containers);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('Validation: checkNoExit', () => {
  beforeEach(() => resetStore());

  it('VAL-6: container with all level-0 body walls sealed triggers no-exit warning', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    // Default container has Open walls at level 1 (roof level)
    // Seal ALL wall faces on ALL active voxels to create a truly sealed box
    const grid = useStore.getState().containers[id].voxelGrid!;
    for (let i = 0; i < grid.length; i++) {
      if (!grid[i].active) continue;
      for (const face of ['n', 's', 'e', 'w'] as const) {
        if (grid[i].faces[face] === 'Open') {
          useStore.getState().paintFace(id, i, face, 'Solid_Steel');
        }
      }
    }
    const containers = useStore.getState().containers;
    const warnings = checkNoExit(containers);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].category).toBe('accessibility');
  });

  it('VAL-7: container with one Open wall face does NOT trigger no-exit', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().paintFace(id, 9, 's', 'Open');
    const containers = useStore.getState().containers;
    const warnings = checkNoExit(containers);
    expect(warnings.filter(w => w.containerId === id && w.category === 'accessibility')).toHaveLength(0);
  });
});

describe('Validation: checkNoEnvelope', () => {
  beforeEach(() => resetStore());

  it('VAL-8: container with all Open walls triggers no-envelope info', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const grid = useStore.getState().containers[id].voxelGrid!;
    for (let i = 0; i < grid.length; i++) {
      if (!grid[i].active) continue;
      for (const face of ['n', 's', 'e', 'w'] as const) {
        useStore.getState().paintFace(id, i, face, 'Open');
      }
    }
    const containers = useStore.getState().containers;
    const warnings = checkNoEnvelope(containers);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].category).toBe('weather');
    expect(warnings[0].severity).toBe('info');
  });
});

describe('Validation: checkGravity', () => {
  beforeEach(() => resetStore());

  it('VAL-9: stacked container with valid base has no gravity warning', () => {
    const id1 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const id2 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().stackContainer(id2, id1);
    const containers = useStore.getState().containers;
    const warnings = checkGravity(containers);
    expect(warnings.filter((w: { category: string }) => w.category === 'structural')).toHaveLength(0);
  });
});

describe('Validation: checkUnsupportedCantilever', () => {
  beforeEach(() => resetStore());

  it('VAL-10: extension voxel with roof triggers cantilever info', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setVoxelActive(id, 2, true);
    useStore.getState().paintFace(id, 2, 'top', 'Solid_Steel');
    const containers = useStore.getState().containers;
    const warnings = checkUnsupportedCantilever(containers);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings.some(w => w.voxelIndices.includes(2))).toBe(true);
  });
});

describe('Validation: checkBudget', () => {
  beforeEach(() => resetStore());

  it('VAL-11: budget exceeded triggers info warning', () => {
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const containers = useStore.getState().containers;
    const warnings = checkBudget(containers, { budgetThreshold: 1000 });
    expect(warnings.length).toBe(1);
    expect(warnings[0].category).toBe('budget');
  });

  it('VAL-12: budget not exceeded returns empty', () => {
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const containers = useStore.getState().containers;
    const warnings = checkBudget(containers, { budgetThreshold: 100000 });
    expect(warnings).toHaveLength(0);
  });
});
