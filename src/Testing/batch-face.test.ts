import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

describe('Batch face operations', () => {
  let containerId: string;

  beforeEach(() => {
    const initial = useStore.getInitialState();
    useStore.setState(initial, true);
    containerId = useStore.getState().addContainer(ContainerSize.HighCube40);
    useStore.getState().setAllExtensions(containerId, 'all_deck');
  });

  it('stampAreaSmart applies faces to selected voxels', () => {
    const indices = [9, 10, 11, 12, 13, 14];
    const faces = {
      top: 'Solid_Steel' as const, bottom: 'Deck_Wood' as const,
      n: 'Glass_Pane' as const, s: 'Glass_Pane' as const,
      e: 'Glass_Pane' as const, w: 'Glass_Pane' as const,
    };
    useStore.getState().stampAreaSmart(containerId, indices, faces);
    const grid = useStore.getState().containers[containerId]!.voxelGrid!;
    expect(grid[9].faces.bottom).toBe('Deck_Wood');
  });
});
