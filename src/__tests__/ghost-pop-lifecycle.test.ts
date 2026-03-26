import { describe, it, expect } from 'vitest';
import { useStore } from '@/store/useStore';

describe('ghostPopActive lifecycle', () => {
  it('triggerGhostPop sets active + startTime', () => {
    const store = useStore.getState();
    store.triggerGhostPop();
    const state = useStore.getState();
    expect(state.ghostPopActive).toBe(true);
    expect(state.ghostPopStartTime).toBeGreaterThan(0);
  });

  it('clearGhostPop resets active', () => {
    const store = useStore.getState();
    store.triggerGhostPop();
    store.clearGhostPop();
    const state = useStore.getState();
    expect(state.ghostPopActive).toBe(false);
  });

  it('ghostPreset source accepts all tab values', () => {
    const store = useStore.getState();
    const faces = { top: 'Open' as const, bottom: 'Deck_Wood' as const,
      n: 'Solid_Steel' as const, s: 'Solid_Steel' as const,
      e: 'Solid_Steel' as const, w: 'Solid_Steel' as const };
    for (const src of ['block', 'container', 'walls', 'flooring', 'ceiling'] as const) {
      store.setGhostPreset({ source: src, faces, targetScope: 'voxel' });
      expect(useStore.getState().ghostPreset!.source).toBe(src);
    }
  });
});
