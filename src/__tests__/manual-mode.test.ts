/**
 * Manual Mode Tests
 *
 * Tests for Smart/Manual design mode toggle and guard behavior.
 * Real store actions, real state assertions. No source scanning.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('Manual Mode Toggle', () => {
  beforeEach(() => resetStore());

  it('MM-1: designMode defaults to smart', () => {
    expect(useStore.getState().designMode).toBe('smart');
  });

  it('MM-2: setDesignMode switches to manual', () => {
    useStore.getState().setDesignMode('manual');
    expect(useStore.getState().designMode).toBe('manual');
  });

  it('MM-3: toggleDesignMode toggles between smart and manual', () => {
    useStore.getState().toggleDesignMode();
    expect(useStore.getState().designMode).toBe('manual');
    useStore.getState().toggleDesignMode();
    expect(useStore.getState().designMode).toBe('smart');
  });

  it('MM-4: warnings defaults to empty array', () => {
    expect(useStore.getState().warnings).toEqual([]);
  });

  it('MM-5: setWarnings replaces the warnings array', () => {
    const w = [{ id: 'test-1', category: 'safety' as const, severity: 'warning' as const, message: 'Test', containerId: 'c1', voxelIndices: [0] }];
    useStore.getState().setWarnings(w);
    expect(useStore.getState().warnings).toEqual(w);
  });

  it('MM-6: hoveredWarning defaults to null', () => {
    expect(useStore.getState().hoveredWarning).toBe(null);
  });

  it('MM-7: setHoveredWarning sets the hovered warning ID', () => {
    useStore.getState().setHoveredWarning('test-1');
    expect(useStore.getState().hoveredWarning).toBe('test-1');
  });
});

describe('Manual Mode Guards', () => {
  beforeEach(() => resetStore());

  it('MM-8: in manual mode, setVoxelActive does not auto-add railings', () => {
    useStore.getState().setDesignMode('manual');
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    // Activate a deck voxel (row 0, col 2) — in smart mode this would trigger auto-railing
    useStore.getState().setVoxelActive(id, 2, true);
    const voxel = useStore.getState().containers[id].voxelGrid![2];
    // In manual mode, no auto-railing should be applied
    const wallFaces = ['n', 's', 'e', 'w'] as const;
    const hasAutoRailing = wallFaces.some(f => voxel.faces[f] === 'Railing_Cable');
    expect(hasAutoRailing).toBe(false);
  });

  it('MM-9: in smart mode, setVoxelActive triggers auto-railings on exposed edges', () => {
    // Default is smart mode
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setVoxelActive(id, 2, true);
    // Set top to Open (deck) to make it an open-air platform
    useStore.getState().setVoxelFace(id, 2, 'top', 'Open');
    const voxel = useStore.getState().containers[id].voxelGrid![2];
    // In smart mode, exposed edges should get auto-railings
    const wallFaces = ['n', 's', 'e', 'w'] as const;
    const hasAutoRailing = wallFaces.some(f => voxel.faces[f] === 'Railing_Cable');
    expect(hasAutoRailing).toBe(true);
  });
});
