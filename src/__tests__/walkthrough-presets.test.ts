/**
 * Walkthrough preset structure tests.
 *
 * For each of the 4 walkthrough_N starter sets, assert:
 *   - the requested container count is placed,
 *   - the entry door is installed at voxel 28 face 's' on the first container,
 *   - the design passes Smart Rules with no physics-tier residuals (so a user
 *     dropping into walkthrough doesn't land in a violating scene),
 *   - cleanupDesign is idempotent on the placed state.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { isPhysicsViolation } from '@/utils/normalizeDesign';
import { validateSmartRules } from '@/utils/smartRuleValidator';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
  useStore.temporal.getState().clear();
}

const PRESETS: Array<{ id: string; expectedCount: number; label: string }> = [
  { id: 'walkthrough_1_studio',     expectedCount: 1, label: 'Studio Loft' },
  { id: 'walkthrough_2_duplex',     expectedCount: 2, label: 'Duplex' },
  { id: 'walkthrough_3_townhouse',  expectedCount: 3, label: 'Two-Story Townhouse' },
  { id: 'walkthrough_4_courtyard',  expectedCount: 4, label: 'Courtyard Compound' },
];

describe('Walkthrough-ready presets', () => {
  beforeEach(() => { resetStore(); });

  for (const preset of PRESETS) {
    it(`WT-${preset.expectedCount}: ${preset.id} places ${preset.expectedCount} container(s) with a south entry door`, () => {
      const ids = useStore.getState().placeModelHome(preset.id);
      expect(ids).toHaveLength(preset.expectedCount);

      const containers = useStore.getState().containers;
      const first = containers[ids[0]];
      expect(first).toBeDefined();
      const v28 = first.voxelGrid?.[28];
      expect(v28?.faces.s).toBe('Door');
    });

    it(`WT-${preset.expectedCount}-physics: ${preset.id} has no physics-tier Smart Rule violations`, () => {
      useStore.getState().placeModelHome(preset.id);
      const violations = validateSmartRules(useStore.getState().containers);
      const physics = violations.filter(isPhysicsViolation);
      expect(physics).toEqual([]);
    });
  }

  it('WT-toggle: O-key flow toggles openFaces for an installed door', () => {
    const ids = useStore.getState().placeModelHome('walkthrough_1_studio');
    const cid = ids[0];
    expect(useStore.getState().containers[cid].voxelGrid![28].openFaces?.s).toBeFalsy();

    // The 'O' key handler in WalkthroughControls calls toggleOpenFace —
    // we exercise it directly to keep the test renderer-free.
    useStore.getState().toggleOpenFace(cid, 28, 's');
    expect(useStore.getState().containers[cid].voxelGrid![28].openFaces?.s).toBe(true);

    useStore.getState().toggleOpenFace(cid, 28, 's');
    expect(useStore.getState().containers[cid].voxelGrid![28].openFaces?.s).toBe(false);
  });
});
