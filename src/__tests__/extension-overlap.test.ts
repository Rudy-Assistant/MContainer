/**
 * Extension Overlap Prevention Tests (OVR-1..5)
 *
 * Tests that getFullFootprint accounts for extensions and
 * overlap checks prevent extension collisions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('idb-keyval', () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve(); }),
    del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  };
});

import { useStore } from '@/store/useStore';
import { ContainerSize, CONTAINER_DIMENSIONS } from '@/types/container';
import { getFootprint, getFullFootprint, getActiveExtensions, checkOverlap, getFootprintAt } from '@/store/spatialEngine';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
  const t = useStore.temporal.getState();
  t.clear();
}

describe('Extension Overlap Prevention', () => {
  beforeEach(() => { resetStore(); });

  it('OVR-1: getFullFootprint returns body AABB when no extensions active', () => {
    const id = useStore.getState().addContainer(ContainerSize.Standard40);
    const c = useStore.getState().containers[id];
    const body = getFootprint(c);
    const full = getFullFootprint(c);
    expect(full.minX).toBeCloseTo(body.minX);
    expect(full.maxX).toBeCloseTo(body.maxX);
    expect(full.minZ).toBeCloseTo(body.minZ);
    expect(full.maxZ).toBeCloseTo(body.maxZ);
  });

  it('OVR-2: getFullFootprint expands when extensions are activated', () => {
    const id = useStore.getState().addContainer(ContainerSize.Standard40);
    const bodyBefore = getFootprint(useStore.getState().containers[id]);

    // Activate all deck extensions
    useStore.getState().setAllExtensions(id, 'all_deck');

    const c = useStore.getState().containers[id];
    const full = getFullFootprint(c);
    const dims = CONTAINER_DIMENSIONS[ContainerSize.Standard40];
    const haloExt = dims.height; // ~2.59m

    // Full footprint should be larger than body in all directions
    expect(full.minX).toBeLessThan(bodyBefore.minX);
    expect(full.maxX).toBeGreaterThan(bodyBefore.maxX);
    expect(full.minZ).toBeLessThan(bodyBefore.minZ);
    expect(full.maxZ).toBeGreaterThan(bodyBefore.maxZ);
  });

  it('OVR-3: checkOverlap detects overlap between body and active extension', () => {
    const id1 = useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: 0 });

    // Activate south deck on container 1 (expands in +Z direction)
    useStore.getState().setAllExtensions(id1, 'south_deck');

    const containers = useStore.getState().containers;
    const dims = CONTAINER_DIMENSIONS[ContainerSize.Standard40];

    // Try to place a new container right at the body edge in +Z
    // Without extension awareness this would succeed; with it, should fail
    const testFoot = getFootprintAt(0, dims.width + 0.01, ContainerSize.Standard40);
    const overlaps = checkOverlap(containers, null, testFoot);
    expect(overlaps).toBe(true);
  });

  it('OVR-4: smart placement offsets account for extensions', () => {
    const id1 = useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id1, 'all_deck');

    // Add another container at same position — smart placement should offset it
    const id2 = useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: 0 });
    const c1 = useStore.getState().containers[id1];
    const c2 = useStore.getState().containers[id2];

    // c2 should have been moved away from c1
    const dist = Math.sqrt(
      Math.pow(c1.position.x - c2.position.x, 2) +
      Math.pow(c1.position.z - c2.position.z, 2)
    );
    expect(dist).toBeGreaterThan(1); // Should be significantly offset

    // Full footprints should NOT overlap
    const f1 = getFullFootprint(useStore.getState().containers[id1]);
    const f2 = getFullFootprint(useStore.getState().containers[id2]);
    const overlapX = Math.max(0, Math.min(f1.maxX, f2.maxX) - Math.max(f1.minX, f2.minX));
    const overlapZ = Math.max(0, Math.min(f1.maxZ, f2.maxZ) - Math.max(f1.minZ, f2.minZ));
    // Allow small tolerance for edge-touching
    expect(overlapX * overlapZ).toBeLessThan(0.1);
  });

  it('OVR-5: activating extensions that would overlap is blocked', () => {
    // Place two containers side by side in Z
    const id1 = useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: 0 });
    const dims = CONTAINER_DIMENSIONS[ContainerSize.Standard40];
    const id2 = useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: dims.width });

    // Try to activate south deck on container 1 (would extend into container 2's body)
    const gridBefore = useStore.getState().containers[id1].voxelGrid;
    useStore.getState().setAllExtensions(id1, 'south_deck');
    const gridAfter = useStore.getState().containers[id1].voxelGrid;

    // Extension should be blocked — grid should not have changed
    // Check that row 3 voxels are still inactive
    const ext = getActiveExtensions(useStore.getState().containers[id1]);
    expect(ext.south).toBe(false);
  });

  it('OVR-6: getActiveExtensions detects north extension only', () => {
    const id = useStore.getState().addContainer(ContainerSize.Standard40);
    useStore.getState().setAllExtensions(id, 'north_deck');
    const ext = getActiveExtensions(useStore.getState().containers[id]);
    expect(ext.north).toBe(true);
    expect(ext.south).toBe(false);
    // East/west may also be true since row 0 includes corners (col 0, col 7)
  });

  it('OVR-7: deactivating extensions (none) always succeeds', () => {
    const id = useStore.getState().addContainer(ContainerSize.Standard40);
    useStore.getState().setAllExtensions(id, 'all_deck');
    const extBefore = getActiveExtensions(useStore.getState().containers[id]);
    expect(extBefore.north || extBefore.south || extBefore.east || extBefore.west).toBe(true);

    // Deactivation should always work regardless of neighbors
    useStore.getState().setAllExtensions(id, 'none');
    const extAfter = getActiveExtensions(useStore.getState().containers[id]);
    expect(extAfter.north).toBe(false);
    expect(extAfter.south).toBe(false);
    expect(extAfter.east).toBe(false);
    expect(extAfter.west).toBe(false);
  });
});
