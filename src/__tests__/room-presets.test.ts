import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';
import { ROOM_PRESETS, getRoomPreset } from '@/config/roomPresets';

function fresh() {
  const store = useStore.getState();
  for (const id of Object.keys(store.containers)) store.removeContainer(id);
  const cid = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
  return { cid };
}

describe('Room preset catalog', () => {
  it('every preset id resolves', () => {
    for (const p of ROOM_PRESETS) {
      expect(getRoomPreset(p.id)?.id).toBe(p.id);
    }
  });

  it('all presets have at least one furniture or overlay item', () => {
    for (const p of ROOM_PRESETS) {
      expect(p.furniture.length + p.overlays.length).toBeGreaterThan(0);
    }
  });

  it('every preset declares a designNote naming a celebrated source', () => {
    // Discipline check: presets should cite their design lineage.
    const sourceKeywords = /(Frankfurt|NKBA|Susanka|Kalkin|Apartment Therapy|wet wall|work triangle|Quik House|conversation triangle|recovery)/i;
    for (const p of ROOM_PRESETS) {
      expect(p.designNote, `preset ${p.id}`).toMatch(sourceKeywords);
    }
  });

  it('footprint sizes are within container body bounds (max 6 cols × 2 rows)', () => {
    for (const p of ROOM_PRESETS) {
      expect(p.cols).toBeGreaterThanOrEqual(1);
      expect(p.cols).toBeLessThanOrEqual(6);
      expect(p.rows).toBeGreaterThanOrEqual(1);
      expect(p.rows).toBeLessThanOrEqual(2);
    }
  });

  it('all overlays reference valid local coords inside the preset footprint', () => {
    for (const p of ROOM_PRESETS) {
      for (const o of p.overlays) {
        expect(o.localCol, `${p.id} overlay`).toBeGreaterThanOrEqual(0);
        expect(o.localCol).toBeLessThan(p.cols);
        expect(o.localRow).toBeGreaterThanOrEqual(0);
        expect(o.localRow).toBeLessThan(p.rows);
      }
      for (const f of p.furniture) {
        expect(f.localCol).toBeGreaterThanOrEqual(0);
        expect(f.localCol).toBeLessThan(p.cols);
        expect(f.localRow).toBeGreaterThanOrEqual(0);
        expect(f.localRow).toBeLessThan(p.rows);
      }
    }
  });
});

describe('applyRoomPreset action', () => {
  let cid: string;
  beforeEach(() => { ({ cid } = fresh()); });

  it('rejects placement that exceeds container bounds', () => {
    const store = useStore.getState();
    // Open plan needs 4 cols; placing at body col 4 would need cols 4,5,6,7 — too far.
    const err = store.applyRoomPreset(cid, 4, 0, 'open_plan_klr');
    expect(err).toMatch(/does not fit/);
  });

  it('places galley kitchen and creates fixtures + cabinets', () => {
    const store = useStore.getState();
    const err = store.applyRoomPreset(cid, 0, 0, 'kitchen_galley');
    expect(err).toBeNull();
    const c = useStore.getState().containers[cid];
    // Galley kitchen has overlays at body voxels (cols 1-2, rows 1-2)
    // Body col 0 row 0 face 'n' = container col 1, row 1, north face. Index = 1*8+1=9.
    const v9 = c.voxelGrid?.[9];
    expect(v9?.cabinetConfig?.n?.template).toBe('base_2door');
    expect(v9?.fixtureConfig?.n?.template).toBe('sink_kitchen_double');
  });

  it('places furniture for the L-kitchen + dining preset', () => {
    const store = useStore.getState();
    const before = useStore.getState().containers[cid].furniture?.length ?? 0;
    const err = store.applyRoomPreset(cid, 0, 0, 'kitchen_l_dining');
    expect(err).toBeNull();
    const after = useStore.getState().containers[cid].furniture?.length ?? 0;
    // L-kitchen has 5 furniture items (1 dining table + 4 chairs)
    expect(after - before).toBe(5);
  });

  it('Susanka bedroom preset places bed against side wall (rotation = PI/2)', () => {
    const store = useStore.getState();
    store.applyRoomPreset(cid, 0, 0, 'bedroom_studio');
    const furn = useStore.getState().containers[cid].furniture ?? [];
    const bed = furn.find((f) => f.type === 'bed');
    expect(bed?.rotation).toBe(Math.PI / 2);
  });

  it('compact bath places vanity + toilet + shower along wet wall', () => {
    const store = useStore.getState();
    const err = store.applyRoomPreset(cid, 0, 0, 'bath_compact_5x8');
    expect(err).toBeNull();
    const c = useStore.getState().containers[cid];
    // bodyCol 0, bodyRow 0 = container col 1 row 1 = idx 9
    expect(c.voxelGrid?.[9]?.cabinetConfig?.e?.template).toBe('bathroom_vanity');
    // bodyCol 0, bodyRow 1 = container col 1 row 2 = idx 17
    expect(c.voxelGrid?.[17]?.fixtureConfig?.e?.template).toBe('toilet_standard');
    expect(c.voxelGrid?.[17]?.fixtureConfig?.s?.template).toBe('shower_stall');
  });

  it('open plan KLR preset places kitchen island + sectional + dining + TV', () => {
    const store = useStore.getState();
    const err = store.applyRoomPreset(cid, 0, 0, 'open_plan_klr');
    expect(err).toBeNull();
    const c = useStore.getState().containers[cid];
    const furn = c.furniture ?? [];
    expect(furn.some((f) => f.type === 'kitchen_island')).toBe(true);
    expect(furn.some((f) => f.type === 'sectional')).toBe(true);
    expect(furn.some((f) => f.type === 'dining_table')).toBe(true);
    // TV at far east end (bodyCol 3, bodyRow 0) = container col 4 row 1 = idx 12
    expect(c.voxelGrid?.[12]?.decorConfig?.n?.template).toBe('tv_75');
  });
});
