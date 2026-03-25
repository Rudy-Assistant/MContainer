import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import type { SurfaceType } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('ghostPreset store', () => {
  beforeEach(resetStore);

  it('starts null', () => {
    expect(useStore.getState().ghostPreset).toBeNull();
  });

  it('setGhostPreset stores preset', () => {
    const preset = {
      source: 'block' as const,
      faces: { top: 'Open' as const, bottom: 'Deck_Wood' as const, n: 'Open' as const, s: 'Open' as const, e: 'Open' as const, w: 'Open' as const },
      targetScope: 'voxel' as const,
    };
    useStore.getState().setGhostPreset(preset);
    expect(useStore.getState().ghostPreset).toEqual(preset);
  });

  it('clearGhostPreset sets null', () => {
    useStore.getState().setGhostPreset({
      source: 'block',
      faces: { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' },
      targetScope: 'voxel',
    });
    useStore.getState().clearGhostPreset();
    expect(useStore.getState().ghostPreset).toBeNull();
  });
});

describe('stampPreview state', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState(), true));

  it('starts null', () => {
    expect(useStore.getState().stampPreview).toBeNull();
  });

  it('setStampPreview stores preview data', () => {
    const preview = { surfaceType: 'Glass_Pane' as SurfaceType, containerId: 'c1', voxelIndex: 10 };
    useStore.getState().setStampPreview(preview);
    expect(useStore.getState().stampPreview).toEqual(preview);
  });

  it('clearStampPreview resets to null', () => {
    useStore.getState().setStampPreview({ surfaceType: 'Glass_Pane' as SurfaceType, containerId: 'c1', voxelIndex: 10 });
    useStore.getState().clearStampPreview();
    expect(useStore.getState().stampPreview).toBeNull();
  });
});
