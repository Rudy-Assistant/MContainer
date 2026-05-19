/**
 * Brainstorm-deferred #1: Component-snap prefab modules.
 *
 * Save a selection as a named prefab, spawn fresh copies anywhere on the
 * canvas with relative-position preservation. Containers in the spawned
 * prefab are NEW instances (different ids), not refs back to the source.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('Prefab modules (brainstorm deferred — component-snap)', () => {
  beforeEach(() => resetStore());

  it('savePrefabFromSelection returns null when selection is empty', () => {
    expect(useStore.getState().savePrefabFromSelection('Test')).toBeNull();
    expect(useStore.getState().prefabModules).toEqual({});
  });

  it('savePrefabFromSelection captures container specs with relative positions', () => {
    const a = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 5, y: 0, z: 5 }, 0, true);
    const b = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 17, y: 0, z: 5 }, 0, true);
    useStore.setState({ selection: [a, b] });
    const prefabId = useStore.getState().savePrefabFromSelection('North Wing');
    expect(prefabId).not.toBeNull();
    const prefab = useStore.getState().prefabModules[prefabId!];
    expect(prefab.label).toBe('North Wing');
    expect(prefab.containers).toHaveLength(2);
    // First container is the origin → relativePosition (0,0,0)
    expect(prefab.containers[0].relativePosition.x).toBeCloseTo(0, 5);
    expect(prefab.containers[0].relativePosition.y).toBeCloseTo(0, 5);
    expect(prefab.containers[0].relativePosition.z).toBeCloseTo(0, 5);
    // Second is offset along x — exact value depends on whether smart-snap
    // adjusted the placement; assert relative offset is non-zero and on x axis.
    expect(prefab.containers[1].relativePosition.x).toBeGreaterThan(10);
    expect(prefab.containers[1].relativePosition.z).toBeCloseTo(0, 1);
  });

  it('spawnPrefab creates NEW containers at the drop origin + relative positions', () => {
    const a = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    const b = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 12, y: 0, z: 0 }, 0, true);
    useStore.setState({ selection: [a, b] });
    const prefabId = useStore.getState().savePrefabFromSelection('Pair')!;
    const beforeCount = Object.keys(useStore.getState().containers).length;
    const newIds = useStore.getState().spawnPrefab(prefabId, [50, 0, 50]);
    expect(newIds).toHaveLength(2);
    // None of the new ids should match the source ids
    expect(newIds).not.toContain(a);
    expect(newIds).not.toContain(b);
    const containers = useStore.getState().containers;
    expect(Object.keys(containers).length).toBe(beforeCount + 2);
    expect(containers[newIds[0]].position.x).toBeCloseTo(50, 1);
    expect(containers[newIds[0]].position.z).toBeCloseTo(50, 1);
    expect(containers[newIds[1]].position.x).toBeGreaterThan(60);
    expect(containers[newIds[1]].position.z).toBeCloseTo(50, 1);
  });

  it('spawnPrefab returns [] for unknown prefab id', () => {
    expect(useStore.getState().spawnPrefab('nonexistent', [0, 0, 0])).toEqual([]);
  });

  it('removePrefab deletes the prefab from the registry', () => {
    const a = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    useStore.setState({ selection: [a] });
    const prefabId = useStore.getState().savePrefabFromSelection('X')!;
    useStore.getState().removePrefab(prefabId);
    expect(useStore.getState().prefabModules[prefabId]).toBeUndefined();
  });

  it('renamePrefab updates label without touching containers', () => {
    const a = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    useStore.setState({ selection: [a] });
    const prefabId = useStore.getState().savePrefabFromSelection('Old')!;
    useStore.getState().renamePrefab(prefabId, 'New Name');
    expect(useStore.getState().prefabModules[prefabId].label).toBe('New Name');
    expect(useStore.getState().prefabModules[prefabId].containers).toHaveLength(1);
  });

  it('spawnPrefab announces via destructive-toast layer', () => {
    const a = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    useStore.setState({ selection: [a] });
    const prefabId = useStore.getState().savePrefabFromSelection('Solo')!;
    useStore.getState().spawnPrefab(prefabId, [100, 0, 100]);
    const lda = useStore.getState().lastDestructiveAction;
    expect(lda?.description).toMatch(/Spawned prefab/);
  });
});
