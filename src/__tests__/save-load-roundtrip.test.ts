import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

function fresh() {
  const store = useStore.getState();
  for (const id of Object.keys(store.containers)) store.removeContainer(id);
  const cid = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
  return { cid };
}

describe('Save/load round-trip — design state survives JSON export+import', () => {
  let cid: string;
  beforeEach(() => { ({ cid } = fresh()); });

  it('round-trips a complex design with every overlay type', () => {
    const store = useStore.getState();

    // Build a design that uses every overlay type
    store.setShelfConfig(cid, 10, 's', { template: 'wall_unit_3', skin: 'oak_natural' });
    store.setCabinetConfig(cid, 11, 's', { template: 'tall_pantry', skin: 'walnut_dark', counterTop: 'quartz_white', underCabinetLight: true });
    store.setFixtureConfig(cid, 12, 's', { template: 'fridge_french_door', openAmount: 1 });
    store.setDecorConfig(cid, 13, 's', { template: 'tv_55', palette: 'no_frame', pictureLight: false });
    store.setFloorOverlay(cid, 10, 'bottom', { template: 'rug_persian' });
    store.setCeilingOverlay(cid, 10, 'top', { template: 'fan_modern' });
    store.setDoorConfig(cid, 18, 'n', { template: 'french_double', skin: 'walnut_glazed', state: 'open_swing' });
    store.setWindowConfig(cid, 19, 's', { template: 'casement_double', skin: 'wood_natural', openAmount: 1 });

    // Export
    const json = store.exportState();
    expect(json).toBeTypeOf('string');
    const parsed = JSON.parse(json);
    expect(parsed.containers).toBeDefined();

    // Wipe state
    for (const id of Object.keys(useStore.getState().containers)) useStore.getState().removeContainer(id);
    expect(Object.keys(useStore.getState().containers).length).toBe(0);

    // Import
    useStore.getState().importState(json);

    // Verify
    const imported = useStore.getState().containers[cid];
    expect(imported, 'container survived round-trip').toBeDefined();
    const v10 = imported.voxelGrid?.[10];
    expect(v10?.shelfConfig?.s?.template).toBe('wall_unit_3');
    expect(v10?.floorOverlay?.bottom?.template).toBe('rug_persian');
    expect(v10?.ceilingOverlay?.top?.template).toBe('fan_modern');
    const v11 = imported.voxelGrid?.[11];
    expect(v11?.cabinetConfig?.s?.template).toBe('tall_pantry');
    expect(v11?.cabinetConfig?.s?.counterTop).toBe('quartz_white');
    expect(v11?.cabinetConfig?.s?.underCabinetLight).toBe(true);
    const v12 = imported.voxelGrid?.[12];
    expect(v12?.fixtureConfig?.s?.template).toBe('fridge_french_door');
    expect(v12?.fixtureConfig?.s?.openAmount).toBe(1);
    const v13 = imported.voxelGrid?.[13];
    expect(v13?.decorConfig?.s?.template).toBe('tv_55');
    const v18 = imported.voxelGrid?.[18];
    expect(v18?.doorConfig?.n?.template).toBe('french_double');
    expect(v18?.doorConfig?.n?.state).toBe('open_swing');
    const v19 = imported.voxelGrid?.[19];
    expect(v19?.windowConfig?.s?.template).toBe('casement_double');
    expect(v19?.windowConfig?.s?.openAmount).toBe(1);
  });

  it('round-trips a room preset placement', () => {
    const store = useStore.getState();
    store.applyRoomPreset(cid, 0, 0, 'kitchen_galley');

    const before = useStore.getState().containers[cid];
    const beforeFurnitureCount = before.furniture?.length ?? 0;
    const beforeCabinetCount = (before.voxelGrid ?? []).filter((v) => v?.cabinetConfig).length;

    const json = store.exportState();
    for (const id of Object.keys(useStore.getState().containers)) useStore.getState().removeContainer(id);
    useStore.getState().importState(json);

    const after = useStore.getState().containers[cid];
    expect(after.furniture?.length ?? 0).toBe(beforeFurnitureCount);
    expect((after.voxelGrid ?? []).filter((v) => v?.cabinetConfig).length).toBe(beforeCabinetCount);
  });

  it('cost estimate is identical before and after round-trip', () => {
    const store = useStore.getState();
    store.applyRoomPreset(cid, 0, 0, 'open_plan_klr');
    const beforeTotal = store.getEstimate().breakdown.total;

    const json = store.exportState();
    for (const id of Object.keys(useStore.getState().containers)) useStore.getState().removeContainer(id);
    useStore.getState().importState(json);

    const afterTotal = useStore.getState().getEstimate().breakdown.total;
    expect(afterTotal).toBe(beforeTotal);
  });
});
