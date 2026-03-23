// @ts-nocheck — Test file uses runtime assertions
/**
 * Workflow Improvement Tests — Sprint 19
 *
 * TDD RED tests for 5 workflow improvements identified in Sims/Valheim analysis:
 * 1. Rooftop Deck toggle (generate + remove)
 * 2. Auto-railing at stair deck openings
 * 3. Door smart constraints (slide can't slide into empty, swing can't swing into stairs)
 *
 * Improvements 2 (stairs placement UI) and 3 (door catalog) are UI-only — tested via acceptance gates.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize, VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

function addC(size = ContainerSize.HighCube40, pos = { x: 0, y: 0, z: 0 }) {
  return useStore.getState().addContainer(size, pos);
}

beforeEach(() => resetStore());

// ════════════════════════════════════════════════════════════════
// 1. Rooftop Deck Toggle
// ════════════════════════════════════════════════════════════════
describe('Rooftop Deck toggle', () => {
  it('DECK-1: removeRooftopDeck restores body voxel top faces to Solid_Steel', () => {
    const id = addC();
    const s = useStore.getState();
    s.generateRooftopDeck(id);

    // Verify deck was applied
    const afterGen = useStore.getState().containers[id];
    const bodyIdx = 1 * VOXEL_COLS + 1; // row=1, col=1 (body voxel)
    expect(afterGen.voxelGrid[bodyIdx].faces.top).toBe('Deck_Wood');

    // Remove the deck
    useStore.getState().removeRooftopDeck(id);
    const afterRemove = useStore.getState().containers[id];

    // Body voxel top should be restored to Solid_Steel (default ceiling)
    expect(afterRemove.voxelGrid[bodyIdx].faces.top).toBe('Solid_Steel');
  });

  it('DECK-2: removeRooftopDeck removes perimeter railings', () => {
    const id = addC();
    useStore.getState().generateRooftopDeck(id);

    // row=1 should have Railing_Cable on north face
    const bodyIdx = 1 * VOXEL_COLS + 3; // row=1, col=3
    expect(useStore.getState().containers[id].voxelGrid[bodyIdx].faces.n).toBe('Railing_Cable');

    useStore.getState().removeRooftopDeck(id);
    const after = useStore.getState().containers[id];
    // North face should NOT be Railing_Cable anymore
    expect(after.voxelGrid[bodyIdx].faces.n).not.toBe('Railing_Cable');
  });

  it('DECK-3: removeRooftopDeck deactivates deck extensions after reverse animation', () => {
    const id = addC();
    useStore.getState().generateRooftopDeck(id);

    // Extension voxels should be active after generateRooftopDeck
    const extIdx = 0; // row=0, col=0 (north-east extension)
    expect(useStore.getState().containers[id].voxelGrid[extIdx].active).toBe(true);

    useStore.getState().removeRooftopDeck(id);
    // Voxel stays active during reverse animation
    expect(useStore.getState().containers[id].voxelGrid[extIdx].unpackPhase).toBe('reverse');

    // Simulate animation completion
    const grid = useStore.getState().containers[id].voxelGrid!;
    grid.forEach((v, i) => {
      if (v.unpackPhase === 'reverse') useStore.getState().clearUnpackPhase(id, i);
    });

    // Now extension voxels should be deactivated
    expect(useStore.getState().containers[id].voxelGrid[extIdx].active).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════
// 2. Auto-railing at stair deck openings
// ════════════════════════════════════════════════════════════════
describe('Auto-railing at stair openings', () => {
  it('RAIL-AUTO-1: vertical stairs on deck voxel auto-applies railing to adjacent open faces', () => {
    const id = addC();
    const s = useStore.getState();
    s.generateRooftopDeck(id);

    // Place vertical stairs on a body voxel (row=1, col=3 = center-ish)
    const stairIdx = 1 * VOXEL_COLS + 3;
    s.applyVerticalStairs(id, stairIdx, 's');

    // The stair voxel's adjacent deck voxels should have railing on the face
    // facing the stair opening
    const afterStairs = useStore.getState().containers[id];
    const stairVoxel = afterStairs.voxelGrid[stairIdx];

    // The stair voxel itself should exist
    expect(stairVoxel.voxelType).toBe('stairs');

    // Adjacent voxels facing the stair should get railing
    // East neighbor (col=4) should have railing on face facing stair (col=3)
    // In applySmartRailing: E→col-1, so col=4's 'e' face looks at col=3 (stair)
    const eastNeighborIdx = 1 * VOXEL_COLS + 4;
    const eastNeighbor = afterStairs.voxelGrid[eastNeighborIdx];
    if (eastNeighbor?.active && eastNeighbor.faces.top === 'Deck_Wood') {
      expect(eastNeighbor.faces.e).toBe('Railing_Cable');
    }
  });
});

// ════════════════════════════════════════════════════════════════
// 3. Door smart constraints
// ════════════════════════════════════════════════════════════════
describe('Door smart constraints', () => {
  it('DOOR-SMART-1: swing door auto-config places hinge away from stairs', () => {
    const id = addC();
    const s = useStore.getState();

    // Place stairs next to a voxel
    const stairIdx = 1 * VOXEL_COLS + 2;
    s.applyStairsFromFace(id, stairIdx, 'e', 'e');

    // Paint door on the adjacent voxel's south face
    const doorIdx = 1 * VOXEL_COLS + 3;
    s.setVoxelFace(id, doorIdx, 's', 'Door');

    const doorConfig = useStore.getState().containers[id].voxelGrid[doorIdx].doorConfig?.s;
    expect(doorConfig).toBeDefined();
    expect(doorConfig.type).toBe('swing');
    // Hinge should be on the side AWAY from stairs (east side, since stairs are west)
    expect(doorConfig.hingeEdge).toBe('right');
  });

  it('DOOR-SMART-2: sliding door cannot slide into an inactive/empty voxel', () => {
    const id = addC();
    const s = useStore.getState();

    // Set door on body voxel south face at edge (col=6, east boundary)
    const doorIdx = 1 * VOXEL_COLS + 6;
    s.setVoxelFace(id, doorIdx, 's', 'Door');
    s.setDoorConfig(id, doorIdx, 's', { type: 'slide' });

    const doorConfig = useStore.getState().containers[id].voxelGrid[doorIdx].doorConfig?.s;
    expect(doorConfig).toBeDefined();
    expect(doorConfig.type).toBe('slide');

    // Validate slide direction: should slide toward an active neighbor, not into void
    // East neighbor (col=7) is an extension voxel that may be inactive
    // The slide direction should be 'negative' (toward col=5, which IS active body)
    expect(doorConfig.slideDirection).toBe('negative');
  });
});
