/**
 * cantilever-validation.test.ts
 *
 * Tests for checkUnsupportedCantilever:
 *  - Extension voxels with roofing but NO active inward neighbor → flagged
 *  - Extension voxels with roofing AND an active inward body neighbor → NOT flagged
 *  - Extension voxels with Open top → NOT flagged
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';
import { checkUnsupportedCantilever } from '@/utils/designValidation';

// Extension voxel index 3 = level 0, row 0, col 3  (row=0 → extension)
// Body neighbor  index 11 = level 0, row 1, col 3  (row=1 → body)
const EXT_IDX = 3;
const BODY_NEIGHBOR_IDX = 11;

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('checkUnsupportedCantilever', () => {
  beforeEach(() => resetStore());

  it('does NOT flag extension voxel with active body neighbor', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    // Activate extension voxel with a steel roof
    useStore.getState().setVoxelActive(id, EXT_IDX, true);
    useStore.getState().paintFace(id, EXT_IDX, 'top', 'Solid_Steel');
    // Activate the inward body neighbor
    useStore.getState().setVoxelActive(id, BODY_NEIGHBOR_IDX, true);

    const containers = useStore.getState().containers;
    const warnings = checkUnsupportedCantilever(containers);
    expect(warnings.find(w => w.voxelIndices.includes(EXT_IDX))).toBeUndefined();
  });

  it('DOES flag extension voxel with NO active body neighbor', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    // Activate extension voxel with a steel roof, but no active neighbor
    useStore.getState().setVoxelActive(id, EXT_IDX, true);
    useStore.getState().paintFace(id, EXT_IDX, 'top', 'Solid_Steel');
    // Ensure body neighbor is inactive
    useStore.getState().setVoxelActive(id, BODY_NEIGHBOR_IDX, false);

    const containers = useStore.getState().containers;
    const warnings = checkUnsupportedCantilever(containers);
    expect(warnings.find(w => w.voxelIndices.includes(EXT_IDX))).toBeDefined();
  });

  it('does NOT flag extension voxel with Open top', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    // Activate extension voxel but leave top as Open (default)
    useStore.getState().setVoxelActive(id, EXT_IDX, true);
    // Do NOT paint any roof face — top remains 'Open'

    const containers = useStore.getState().containers;
    const warnings = checkUnsupportedCantilever(containers);
    expect(warnings.find(w => w.voxelIndices.includes(EXT_IDX))).toBeUndefined();
  });
});
