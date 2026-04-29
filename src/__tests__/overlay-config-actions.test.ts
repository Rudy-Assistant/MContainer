import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';
import { FIXTURE_TEMPLATES, getFixtureTemplate } from '@/config/fixtureTemplates';
import { DECOR_TEMPLATES, DECOR_PALETTES, getDecorTemplate, getDecorPalette } from '@/config/decorTemplates';
import { COUNTER_TOP_MATERIALS, getCounterTopMaterial } from '@/config/counterTopMaterials';
import { CABINET_TEMPLATES } from '@/config/cabinetTemplates';

function freshStoreWithContainer() {
  const store = useStore.getState();
  for (const id of Object.keys(store.containers)) store.removeContainer(id);
  const cid = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
  return { cid };
}

describe('Counter top catalog', () => {
  it('every counter top id resolves', () => {
    for (const m of COUNTER_TOP_MATERIALS) {
      expect(getCounterTopMaterial(m.id).id).toBe(m.id);
    }
  });

  it('base cabinets and vanity flag supportsCounterTop=true', () => {
    const supporting = CABINET_TEMPLATES.filter((t) => t.supportsCounterTop);
    const ids = supporting.map((t) => t.id).sort();
    expect(ids).toEqual(['base_2door', 'base_4drawer', 'base_door_drawer', 'bathroom_vanity']);
  });

  it('counter top round-trips through cabinetConfig', () => {
    const { cid } = freshStoreWithContainer();
    const store = useStore.getState();
    store.setCabinetConfig(cid, 10, 's', { template: 'base_2door', skin: 'shaker_white', counterTop: 'quartz_white' });
    const cfg = useStore.getState().containers[cid].voxelGrid?.[10]?.cabinetConfig?.s;
    expect(cfg?.counterTop).toBe('quartz_white');
  });

  it('counter top can be cleared by passing undefined-only payload (preserved)', () => {
    const { cid } = freshStoreWithContainer();
    const store = useStore.getState();
    store.setCabinetConfig(cid, 10, 's', { template: 'base_2door', skin: 'shaker_white', counterTop: 'quartz_white' });
    // Setting an unrelated field should NOT clobber counterTop
    store.setCabinetConfig(cid, 10, 's', { skin: 'walnut_dark' });
    const cfg = useStore.getState().containers[cid].voxelGrid?.[10]?.cabinetConfig?.s;
    expect(cfg?.counterTop).toBe('quartz_white');
    expect(cfg?.skin).toBe('walnut_dark');
  });
});

describe('Fixture catalog + actions', () => {
  it('every fixture template id resolves', () => {
    for (const t of FIXTURE_TEMPLATES) {
      expect(getFixtureTemplate(t.id).id).toBe(t.id);
    }
  });

  it('appliances declare hasOpeningDoor; bathroom fixtures generally do not', () => {
    const fridge = getFixtureTemplate('fridge_freezer_top');
    const sink = getFixtureTemplate('sink_kitchen_double');
    expect(fridge.hasOpeningDoor).toBe(true);
    expect(sink.hasOpeningDoor).toBeUndefined();
  });

  it('setFixtureConfig writes + merges + removes', () => {
    const { cid } = freshStoreWithContainer();
    const store = useStore.getState();
    store.setFixtureConfig(cid, 10, 's', { template: 'fridge_french_door' });
    expect(useStore.getState().containers[cid].voxelGrid?.[10]?.fixtureConfig?.s?.template).toBe('fridge_french_door');
    store.setFixtureConfig(cid, 10, 's', { openAmount: 1 });
    const cfg = useStore.getState().containers[cid].voxelGrid?.[10]?.fixtureConfig?.s;
    expect(cfg?.openAmount).toBe(1);
    expect(cfg?.template).toBe('fridge_french_door');
    store.setFixtureConfig(cid, 10, 's', null);
    expect(useStore.getState().containers[cid].voxelGrid?.[10]?.fixtureConfig?.s).toBeUndefined();
  });
});

describe('Decor catalog + actions', () => {
  it('every decor template + palette id resolves', () => {
    for (const t of DECOR_TEMPLATES) expect(getDecorTemplate(t.id).id).toBe(t.id);
    for (const p of DECOR_PALETTES) expect(getDecorPalette(p.id).id).toBe(p.id);
  });

  it('setDecorConfig writes + merges + removes', () => {
    const { cid } = freshStoreWithContainer();
    const store = useStore.getState();
    store.setDecorConfig(cid, 10, 's', { template: 'tv_55', palette: 'frame_black' });
    expect(useStore.getState().containers[cid].voxelGrid?.[10]?.decorConfig?.s?.template).toBe('tv_55');
    store.setDecorConfig(cid, 10, 's', { pictureLight: true });
    const cfg = useStore.getState().containers[cid].voxelGrid?.[10]?.decorConfig?.s;
    expect(cfg?.pictureLight).toBe(true);
    expect(cfg?.template).toBe('tv_55');
    store.setDecorConfig(cid, 10, 's', null);
    expect(useStore.getState().containers[cid].voxelGrid?.[10]?.decorConfig?.s).toBeUndefined();
  });
});

describe('All four overlays can coexist on one face', () => {
  it('shelf + cabinet + fixture + decor on the same face all persist', () => {
    const { cid } = freshStoreWithContainer();
    const store = useStore.getState();
    store.setShelfConfig(cid, 10, 's', { template: 'floating_single', skin: 'oak_natural' });
    store.setCabinetConfig(cid, 10, 's', { template: 'wall_2door', skin: 'shaker_white' });
    store.setFixtureConfig(cid, 10, 's', { template: 'sink_kitchen_double' });
    store.setDecorConfig(cid, 10, 's', { template: 'wall_clock_round', palette: 'frame_brass' });
    const v = useStore.getState().containers[cid].voxelGrid?.[10];
    expect(v?.shelfConfig?.s?.template).toBe('floating_single');
    expect(v?.cabinetConfig?.s?.template).toBe('wall_2door');
    expect(v?.fixtureConfig?.s?.template).toBe('sink_kitchen_double');
    expect(v?.decorConfig?.s?.template).toBe('wall_clock_round');
  });
});

describe('Lighting flags', () => {
  it('underCabinetLight round-trips on cabinet', () => {
    const { cid } = freshStoreWithContainer();
    const store = useStore.getState();
    store.setCabinetConfig(cid, 10, 's', { template: 'wall_2door', skin: 'shaker_white' });
    store.setCabinetConfig(cid, 10, 's', { underCabinetLight: true });
    const cfg = useStore.getState().containers[cid].voxelGrid?.[10]?.cabinetConfig?.s;
    expect(cfg?.underCabinetLight).toBe(true);
  });

  it('pictureLight round-trips on decor', () => {
    const { cid } = freshStoreWithContainer();
    const store = useStore.getState();
    store.setDecorConfig(cid, 10, 's', { template: 'framed_picture_landscape', palette: 'frame_walnut' });
    store.setDecorConfig(cid, 10, 's', { pictureLight: true });
    const cfg = useStore.getState().containers[cid].voxelGrid?.[10]?.decorConfig?.s;
    expect(cfg?.pictureLight).toBe(true);
  });
});
