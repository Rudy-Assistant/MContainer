/**
 * Sidebar Discoverability — DISC-1
 *
 * Regression guard for a discoverability bug where the Sidebar's
 * Structure / Interior / Saved tabs were gated to non-Realistic3D view modes,
 * making MODEL_HOMES (e.g. "Glass Atrium Showcase") unreachable from the
 * default app state without first switching to Blueprint or Walkthrough.
 *
 * State-level assertions live here. The UI gate is exercised end-to-end by
 * scripts/probe-deep-userstories.mjs S1, which clicks the Saved tab and the
 * showcase card from the default state with no view-mode change.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize, ViewMode } from '@/types/container';
import { MODEL_HOMES } from '@/config/modelHomes';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
  useStore.temporal.getState().clear();
}

describe('Sidebar Discoverability', () => {
  beforeEach(() => resetStore());

  it('DISC-1: Glass Atrium Showcase is reachable from the default app state', { timeout: 10000 }, () => {
    // Default viewMode is Realistic3D — the mode in which the bug hid the tabs.
    expect(useStore.getState().viewMode).toBe(ViewMode.Realistic3D);

    // The Saved tab renders MODEL_HOMES. The showcase must exist there.
    const showcase = MODEL_HOMES.find((m) => m.id === 'glass_atrium_showcase');
    expect(showcase, 'Glass Atrium Showcase must exist in MODEL_HOMES').toBeDefined();

    // The store action that the Saved-tab card click triggers
    // (UserLibrary.replaceWithModelHome → placeModelHome) succeeds from the
    // default state, placing all eight containers.
    const ids = useStore.getState().placeModelHome('glass_atrium_showcase');
    expect(ids.length).toBe(showcase!.containers.length);
  });

  it('DISC-2: addPoolContainer produces a subterranean HighCube40 from the default state', () => {
    // Inverse of DISC-1: the Pool Container affordance was previously locked
    // inside DesignModePanel (Realistic3D-only). The Library Structure tab now
    // exposes a Pool card that calls addPoolContainer() so the action is
    // reachable in every view mode. Test the store contract from the default
    // state — the UI gate is exercised end-to-end by the browse probe.
    expect(useStore.getState().viewMode).toBe(ViewMode.Realistic3D);

    const id = useStore.getState().addPoolContainer();
    const c = useStore.getState().containers[id];
    expect(c, 'addPoolContainer must place a container').toBeDefined();
    expect(c.size).toBe(ContainerSize.HighCube40);
    expect(c.subterranean).toBe(true);
    expect(c.name).toBe('Pool Container');
    expect(c.position.y).toBeLessThan(0); // below ground
  });
});
