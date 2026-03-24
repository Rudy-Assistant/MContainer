import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';
import { CONTAINER_LEVEL_PRESETS } from '@/config/containerTabPresets';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
  useStore.setState({ designMode: 'manual' });
}

describe('container-level preset application', () => {
  beforeEach(resetStore);

  it('applies Interior preset to all active body voxels', () => {
    const cid = useStore.getState().addContainer(ContainerSize.HighCube40);
    const interior = CONTAINER_LEVEL_PRESETS.find(p => p.id === 'interior')!;
    const grid = useStore.getState().containers[cid]!.voxelGrid!;
    const activeIndices = grid.map((v, i) => v.active ? i : -1).filter(i => i >= 0);

    for (const idx of activeIndices) {
      useStore.getState().setVoxelFaces(cid, idx, interior.faces);
    }

    const updated = useStore.getState().containers[cid]!.voxelGrid!;
    for (const idx of activeIndices) {
      expect(updated[idx].faces.top).toBe('Solid_Steel');
      expect(updated[idx].faces.bottom).toBe('Deck_Wood');
    }
  });
});
