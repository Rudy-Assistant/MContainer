import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

function fresh() {
  const store = useStore.getState();
  for (const id of Object.keys(store.containers)) store.removeContainer(id);
  const cid = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
  return { cid };
}

describe('Cost calculator includes wall-feature overlays', () => {
  let cid: string;
  beforeEach(() => { ({ cid } = fresh()); });

  it('overlays line item appears in breakdown', () => {
    const store = useStore.getState();
    const before = store.getEstimate().breakdown.overlays ?? 0;
    store.setShelfConfig(cid, 10, 's', { template: 'wall_unit_3', skin: 'oak_natural' });
    const after = useStore.getState().getEstimate().breakdown.overlays ?? 0;
    expect(after).toBeGreaterThan(before);
  });

  it('cabinet adds template costUSD to overlays', () => {
    const store = useStore.getState();
    store.setCabinetConfig(cid, 10, 's', { template: 'tall_pantry', skin: 'shaker_white' });
    const overlays = useStore.getState().getEstimate().breakdown.overlays ?? 0;
    // Tall pantry is $1450
    expect(overlays).toBe(1450);
  });

  it('mirror skin adds 30% upcharge to cabinet body', () => {
    const store = useStore.getState();
    store.setCabinetConfig(cid, 10, 's', { template: 'wall_2door', skin: 'shaker_white' });
    const baseline = useStore.getState().getEstimate().breakdown.overlays ?? 0;
    store.setCabinetConfig(cid, 11, 's', { template: 'wall_2door', skin: 'mirror_silver' });
    const withMirror = (useStore.getState().getEstimate().breakdown.overlays ?? 0) - baseline;
    // Wall 2-door is $480; +30% = $624
    expect(withMirror).toBe(Math.round(480 * 1.3));
  });

  it('counter top adds its slab cost on top of cabinet cost', () => {
    const store = useStore.getState();
    store.setCabinetConfig(cid, 10, 's', { template: 'base_2door', skin: 'shaker_white', counterTop: 'quartz_white' });
    const overlays = useStore.getState().getEstimate().breakdown.overlays ?? 0;
    // base_2door $620 + quartz_white $480 = $1100
    expect(overlays).toBe(620 + 480);
  });

  it('fixture adds its costUSD', () => {
    const store = useStore.getState();
    store.setFixtureConfig(cid, 10, 's', { template: 'fridge_french_door' });
    const overlays = useStore.getState().getEstimate().breakdown.overlays ?? 0;
    // french door fridge $2400
    expect(overlays).toBe(2400);
  });

  it('decor + picture light bills the light surcharge', () => {
    const store = useStore.getState();
    store.setDecorConfig(cid, 10, 's', { template: 'framed_picture_landscape', palette: 'frame_walnut', pictureLight: true });
    const overlays = useStore.getState().getEstimate().breakdown.overlays ?? 0;
    // landscape frame $120 + picture light $80 = $200
    expect(overlays).toBe(200);
  });

  it('under-cabinet light bills the LED surcharge', () => {
    const store = useStore.getState();
    store.setCabinetConfig(cid, 10, 's', { template: 'wall_2door', skin: 'shaker_white', underCabinetLight: true });
    const overlays = useStore.getState().getEstimate().breakdown.overlays ?? 0;
    // wall_2door $480 + under-cabinet light $60 = $540
    expect(overlays).toBe(540);
  });

  it('total includes overlays', () => {
    const store = useStore.getState();
    const beforeTotal = store.getEstimate().breakdown.total;
    store.setCabinetConfig(cid, 10, 's', { template: 'tall_pantry', skin: 'shaker_white' });
    const afterTotal = useStore.getState().getEstimate().breakdown.total;
    expect(afterTotal - beforeTotal).toBe(1450);
  });
});
