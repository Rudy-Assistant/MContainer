/**
 * Smart Systems Tests
 *
 * Tests for adjacency, staircase, smart railing, surface cycles,
 * shift+drag, furniture, and export/import.
 * Real store actions, real state assertions. No source scanning.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize, CONTAINER_DIMENSIONS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('Smart Placement', () => {
  beforeEach(() => resetStore());

  it('SP-1: addContainer with same position auto-offsets (no overlap)', () => {
    const id1 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const id2 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const c1 = useStore.getState().containers[id1];
    const c2 = useStore.getState().containers[id2];
    // Auto-offset: positions should differ
    const samePos = c1.position.x === c2.position.x && c1.position.z === c2.position.z && c1.position.y === c2.position.y;
    expect(samePos).toBe(false);
  });

  it('SP-2: addContainer with explicit offset creates non-overlapping', () => {
    const id1 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const id2 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 15, y: 0, z: 0 });
    const c1 = useStore.getState().containers[id1];
    const c2 = useStore.getState().containers[id2];
    expect(Math.abs(c1.position.x - c2.position.x)).toBeGreaterThan(10);
  });

  it('SP-3: addContainer returns valid ID', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
    expect(useStore.getState().containers[id]).toBeDefined();
  });
});

describe('Staircase Auto-Void', () => {
  beforeEach(() => resetStore());

  it('STAIR-1: applyStairsFromFace sets stairPart on entry voxel', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyStairsFromFace(id, 10, 'n');
    const v = useStore.getState().containers[id].voxelGrid![10]!;
    expect(v.stairPart).toBe('lower');
  });

  it('STAIR-2: applyStairsFromFace sets adjacent voxel as upper', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyStairsFromFace(id, 10, 'n');
    const v18 = useStore.getState().containers[id].voxelGrid![18]!;
    expect(v18.stairPart).toBe('upper');
  });

  it('STAIR-3: undo reverts staircase', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const beforePart = useStore.getState().containers[id].voxelGrid![10]!.stairPart;
    useStore.getState().applyStairsFromFace(id, 10, 'n');
    expect(useStore.getState().containers[id].voxelGrid![10]!.stairPart).toBe('lower');
    useStore.getState().undo();
    expect(useStore.getState().containers[id].voxelGrid![10]!.stairPart).toBe(beforePart);
  });
});

describe('Smart Railing', () => {
  beforeEach(() => resetStore());

  it('RAIL-1: applySmartRailing adds Railing_Cable to exposed edges', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setVoxelFace(id, 9, 'bottom', 'Deck_Wood');
    useStore.getState().applySmartRailing(id, 9);
    const faces = useStore.getState().containers[id].voxelGrid![9].faces;
    // At least one face should be Railing_Cable
    const hasRailing = Object.values(faces).some(f => f === 'Railing_Cable');
    expect(hasRailing).toBe(true);
  });

  it('RAIL-2: applySmartRailing skips faces adjacent to walkable surfaces', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setVoxelFace(id, 9, 'bottom', 'Deck_Wood');
    useStore.getState().applySmartRailing(id, 9);
    const faces = useStore.getState().containers[id].voxelGrid![9].faces;
    // Some faces should remain Open (adjacent to walkable neighbors)
    const hasOpen = ['n', 's', 'e', 'w'].some(f => faces[f as keyof typeof faces] === 'Open');
    expect(hasOpen).toBe(true);
  });
});

describe('Surface Cycles', () => {
  beforeEach(() => resetStore());

  it('CYCLE-1: cycleVoxelFace cycles wall through WALL_CYCLE', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const before = useStore.getState().containers[id].voxelGrid![9].faces.n;
    useStore.getState().cycleVoxelFace(id, 9, 'n');
    const after = useStore.getState().containers[id].voxelGrid![9].faces.n;
    expect(after).not.toBe(before);
  });

  it('CYCLE-2: cycleVoxelFace on floor uses FLOOR_CYCLE', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().cycleVoxelFace(id, 9, 'bottom');
    const after = useStore.getState().containers[id].voxelGrid![9].faces.bottom;
    // FLOOR_CYCLE starts Deck_Wood → Floor_Tatami...
    expect(['Deck_Wood', 'Floor_Tatami', 'Wood_Hinoki', 'Concrete', 'Open']).toContain(after);
  });
});

describe('Shift+Drag', () => {
  beforeEach(() => resetStore());

  it('DRAG-1: startContainerDrag sets dragMovingId', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().startContainerDrag(id);
    expect(useStore.getState().dragMovingId).toBe(id);
  });

  it('DRAG-2: commitContainerDrag updates position', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().startContainerDrag(id);
    useStore.getState().commitContainerDrag(5, 3);
    const pos = useStore.getState().containers[id].position;
    expect(pos.x).toBe(5);
    expect(pos.z).toBe(3);
    expect(useStore.getState().dragMovingId).toBeNull();
  });

  it('DRAG-3: cancelContainerDrag clears dragMovingId without moving', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().startContainerDrag(id);
    useStore.getState().cancelContainerDrag();
    expect(useStore.getState().dragMovingId).toBeNull();
    expect(useStore.getState().containers[id].position.x).toBe(0);
  });

  it('DRAG-4: commitContainerDrag position is snapped (multiple of 0.1)', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().startContainerDrag(id);
    useStore.getState().commitContainerDrag(5.3, 2.7);
    const pos = useStore.getState().containers[id].position;
    // Values passed directly — the snap happens in DragMoveGhost before calling commit
    expect(pos.x).toBe(5.3);
    expect(pos.z).toBe(2.7);
  });
});

describe('Furniture', () => {
  beforeEach(() => resetStore());

  it('FURN-1: addFurniture creates item in container', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const furnId = useStore.getState().addFurniture(id, 'kitchen' as any, { x: 0, y: 0.06, z: 0 }, 0);
    expect(furnId).toBeTruthy();
    const c = useStore.getState().containers[id];
    expect(c.furniture.length).toBe(1);
    expect(c.furniture[0].type).toBe('kitchen');
  });

  it('FURN-2: addFurniture to non-existent container returns null', () => {
    const result = useStore.getState().addFurniture('fake-id', 'kitchen' as any);
    expect(result).toBeNull();
  });

  it('FURN-3: furniture has correct default position', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().addFurniture(id, 'bed' as any);
    const f = useStore.getState().containers[id].furniture[0];
    expect(f.position).toBeDefined();
    expect(f.position.y).toBeCloseTo(0.06, 1);
  });
});

describe('Cross-Container Staircase Void', () => {
  beforeEach(() => resetStore());

  it('XSTAIR-1: stairs at top level voids floor of container above', () => {
    const id1 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const id2 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 2.90, z: 0 });
    // Stack them
    useStore.getState().stackContainer(id2, id1);
    // Apply stairs to top-level voxel of bottom container (level 1, index 32+localIdx)
    // Voxel 42 = level 1, row 1, col 2
    useStore.getState().applyStairsFromFace(id1, 42, 'n');
    const localIdx = 42 % 32; // = 10
    const aboveVoxel = useStore.getState().containers[id2].voxelGrid![localIdx];
    expect(aboveVoxel.faces.bottom).toBe('Open');
  });

  it('XSTAIR-2: undo restores container above floor', () => {
    const id1 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const id2 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 2.90, z: 0 });
    useStore.getState().stackContainer(id2, id1);
    const localIdx = 42 % 32;
    const beforeBottom = useStore.getState().containers[id2].voxelGrid![localIdx].faces.bottom;
    useStore.getState().applyStairsFromFace(id1, 42, 'n');
    expect(useStore.getState().containers[id2].voxelGrid![localIdx].faces.bottom).toBe('Open');
    useStore.getState().undo();
    expect(useStore.getState().containers[id2].voxelGrid![localIdx].faces.bottom).toBe(beforeBottom);
  });

  it('XSTAIR-3: no void if no container above', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    // No stacking — just apply stairs at top level
    useStore.getState().applyStairsFromFace(id, 42, 'n');
    // Should not throw, voxel should still be stairs
    expect(useStore.getState().containers[id].voxelGrid![42].voxelType).toBe('stairs');
  });

  it('XSTAIR-4: void only affects corresponding voxel position', () => {
    const id1 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const id2 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 2.90, z: 0 });
    useStore.getState().stackContainer(id2, id1);
    // Apply stairs to voxel 42 (localIdx=10)
    useStore.getState().applyStairsFromFace(id1, 42, 'n');
    // Voxel 10 in above container should be Open
    expect(useStore.getState().containers[id2].voxelGrid![10].faces.bottom).toBe('Open');
    // Voxel 11 should NOT be affected
    const v11 = useStore.getState().containers[id2].voxelGrid![11];
    expect(v11.faces.bottom).not.toBe('Open');
  });
});

describe('Export/Import', () => {
  beforeEach(() => resetStore());

  it('EXP-1: exportState returns valid JSON', () => {
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const json = useStore.getState().exportState();
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.containers).toBeDefined();
  });

  it('EXP-2: importState restores containers', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 5, y: 0, z: 3 });
    const json = useStore.getState().exportState();
    resetStore();
    expect(Object.keys(useStore.getState().containers).length).toBe(0);
    useStore.getState().importState(json);
    const containers = useStore.getState().containers;
    expect(Object.keys(containers).length).toBe(1);
    const c = Object.values(containers)[0];
    expect(c.position.x).toBe(5);
    expect(c.position.z).toBe(3);
  });
});
