import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';
import { SHELF_TEMPLATES, getShelfTemplate, DEFAULT_SHELF_TEMPLATE } from '@/config/shelfTemplates';
import { CABINET_TEMPLATES, getCabinetTemplate, DEFAULT_CABINET_TEMPLATE } from '@/config/cabinetTemplates';
import { CABINETRY_SKINS, getCabinetrySkin, DEFAULT_CABINETRY_SKIN } from '@/config/cabinetrySkins';

function freshStoreWithContainer() {
  const store = useStore.getState();
  for (const id of Object.keys(store.containers)) store.removeContainer(id);
  const cid = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
  return { cid };
}

describe('Shelf + Cabinet catalog round-trips', () => {
  it('every shelf template id resolves via getShelfTemplate', () => {
    for (const tmpl of SHELF_TEMPLATES) {
      expect(getShelfTemplate(tmpl.id).id).toBe(tmpl.id);
    }
  });

  it('every cabinet template id resolves via getCabinetTemplate', () => {
    for (const tmpl of CABINET_TEMPLATES) {
      expect(getCabinetTemplate(tmpl.id).id).toBe(tmpl.id);
    }
  });

  it('every cabinetry skin id resolves via getCabinetrySkin', () => {
    for (const skin of CABINETRY_SKINS) {
      expect(getCabinetrySkin(skin.id).id).toBe(skin.id);
    }
  });

  it('default ids exist in their catalogs', () => {
    expect(SHELF_TEMPLATES.find(t => t.id === DEFAULT_SHELF_TEMPLATE)).toBeDefined();
    expect(CABINET_TEMPLATES.find(t => t.id === DEFAULT_CABINET_TEMPLATE)).toBeDefined();
    expect(CABINETRY_SKINS.find(s => s.id === DEFAULT_CABINETRY_SKIN)).toBeDefined();
  });

  it('every cabinet template has at least one part', () => {
    for (const tmpl of CABINET_TEMPLATES) {
      expect(tmpl.parts.length).toBeGreaterThan(0);
    }
  });

  it('every door part declares a hingeEdge', () => {
    for (const tmpl of CABINET_TEMPLATES) {
      for (const part of tmpl.parts) {
        if (part.kind === 'door') {
          expect(part.hingeEdge).toMatch(/^(left|right)$/);
        }
      }
    }
  });

  it('mirror skins flag mirrorDoors=true on the expected ids', () => {
    const mirrored = CABINETRY_SKINS.filter(s => s.mirrorDoors);
    expect(mirrored.map(s => s.id).sort()).toEqual(['bronze_mirror', 'mirror_silver']);
  });
});

describe('setShelfConfig action', () => {
  let cid: string;
  beforeEach(() => {
    ({ cid } = freshStoreWithContainer());
  });

  it('writes a shelf config for a face', () => {
    const store = useStore.getState();
    store.setShelfConfig(cid, 10, 's', { template: 'wall_unit_3', skin: 'oak_natural' });
    const cfg = useStore.getState().containers[cid].voxelGrid?.[10]?.shelfConfig?.s;
    expect(cfg?.template).toBe('wall_unit_3');
    expect(cfg?.skin).toBe('oak_natural');
  });

  it('merges partial updates with existing config', () => {
    const store = useStore.getState();
    store.setShelfConfig(cid, 10, 's', { template: 'wall_unit_3', skin: 'oak_natural' });
    store.setShelfConfig(cid, 10, 's', { skin: 'walnut_dark' });
    const cfg = useStore.getState().containers[cid].voxelGrid?.[10]?.shelfConfig?.s;
    expect(cfg?.template).toBe('wall_unit_3'); // preserved
    expect(cfg?.skin).toBe('walnut_dark');     // updated
  });

  it('removes the shelf when called with null', () => {
    const store = useStore.getState();
    store.setShelfConfig(cid, 10, 's', { template: 'floating_single', skin: 'oak_natural' });
    store.setShelfConfig(cid, 10, 's', null);
    const cfg = useStore.getState().containers[cid].voxelGrid?.[10]?.shelfConfig?.s;
    expect(cfg).toBeUndefined();
  });

  it('two faces of the same voxel hold independent shelves', () => {
    const store = useStore.getState();
    store.setShelfConfig(cid, 10, 'n', { template: 'floating_single', skin: 'oak_natural' });
    store.setShelfConfig(cid, 10, 's', { template: 'wall_unit_5', skin: 'walnut_dark' });
    const map = useStore.getState().containers[cid].voxelGrid?.[10]?.shelfConfig;
    expect(map?.n?.template).toBe('floating_single');
    expect(map?.s?.template).toBe('wall_unit_5');
  });
});

describe('setCabinetConfig action', () => {
  let cid: string;
  beforeEach(() => {
    ({ cid } = freshStoreWithContainer());
  });

  it('writes a cabinet config for a face', () => {
    const store = useStore.getState();
    store.setCabinetConfig(cid, 10, 's', { template: 'tall_pantry', skin: 'shaker_white' });
    const cfg = useStore.getState().containers[cid].voxelGrid?.[10]?.cabinetConfig?.s;
    expect(cfg?.template).toBe('tall_pantry');
    expect(cfg?.skin).toBe('shaker_white');
  });

  it('openAmount round-trips', () => {
    const store = useStore.getState();
    store.setCabinetConfig(cid, 10, 's', { template: 'wall_2door', skin: 'shaker_white' });
    store.setCabinetConfig(cid, 10, 's', { openAmount: 1 });
    const cfg = useStore.getState().containers[cid].voxelGrid?.[10]?.cabinetConfig?.s;
    expect(cfg?.openAmount).toBe(1);
    expect(cfg?.template).toBe('wall_2door'); // not clobbered
  });

  it('removes the cabinet when called with null', () => {
    const store = useStore.getState();
    store.setCabinetConfig(cid, 10, 's', { template: 'wall_2door', skin: 'shaker_white' });
    store.setCabinetConfig(cid, 10, 's', null);
    const cfg = useStore.getState().containers[cid].voxelGrid?.[10]?.cabinetConfig?.s;
    expect(cfg).toBeUndefined();
  });

  it('shelf and cabinet can coexist on the same face', () => {
    const store = useStore.getState();
    store.setShelfConfig(cid, 10, 's', { template: 'floating_single', skin: 'oak_natural' });
    store.setCabinetConfig(cid, 10, 's', { template: 'wall_2door', skin: 'shaker_white' });
    const v = useStore.getState().containers[cid].voxelGrid?.[10];
    expect(v?.shelfConfig?.s?.template).toBe('floating_single');
    expect(v?.cabinetConfig?.s?.template).toBe('wall_2door');
  });
});
