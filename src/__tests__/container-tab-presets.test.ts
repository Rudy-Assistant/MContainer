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

  it('applies Max Box arrangement to full footprint with roof and floor surfaces', () => {
    const cid = useStore.getState().addContainer(ContainerSize.HighCube40);
    expect(CONTAINER_LEVEL_PRESETS.find(p => p.id === 'max_closed')).toBeDefined();
    useStore.getState().applyContainerArrangement(cid, 'max_closed');

    const updated = useStore.getState().containers[cid]!.voxelGrid!;
    expect(updated.filter(v => v.active)).toHaveLength(64);
    expect(updated[0].faces.n).toBe('Solid_Steel');
    expect(updated[9].faces.n).toBe('Open');
    expect(updated[9].faces.bottom).toBe('Deck_Wood');
    expect(updated[41].faces.top).toBe('Solid_Steel');
  });
});
