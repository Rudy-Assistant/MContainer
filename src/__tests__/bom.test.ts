/**
 * BOM / Pricing Tests (BOM-1 through BOM-6)
 *
 * Real store actions, real state assertions. No source scanning.
 * Mocks: idb-keyval (no IndexedDB in Node).
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('BOM / Pricing', () => {
  beforeEach(() => {
    resetStore();
  });

  it('BOM-1: empty project has zero cost', () => {
    const estimate = useStore.getState().getEstimate();
    expect(estimate.breakdown.total).toBe(0);
    expect(estimate.breakdown.containers).toBe(0);
    expect(estimate.breakdown.modules).toBe(0);
    expect(estimate.breakdown.cuts).toBe(0);
  });

  it('BOM-2: single 40ft HC container has correct base cost', () => {
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const estimate = useStore.getState().getEstimate();
    // Base $5000 + 4 deck corner poles × $150 = $5600
    expect(estimate.breakdown.containers).toBe(5600);
  });

  it('BOM-3: two containers double the base cost', () => {
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 15, y: 0, z: 0 });
    const estimate = useStore.getState().getEstimate();
    // 2 × ($5000 + 4 poles × $150) = $11200
    expect(estimate.breakdown.containers).toBe(11200);
  });

  it('BOM-4: estimate provides low/high range (±15%)', () => {
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const estimate = useStore.getState().getEstimate();
    const total = estimate.breakdown.total;
    expect(estimate.low).toBe(Math.round(total * 0.85));
    expect(estimate.high).toBe(Math.round(total * 1.15));
  });

  it('BOM-5: 20ft standard has lower base cost than 40ft HC', () => {
    useStore.getState().addContainer(ContainerSize.Standard20, { x: 0, y: 0, z: 0 });
    const est20 = useStore.getState().getEstimate();
    resetStore();
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const est40 = useStore.getState().getEstimate();
    expect(est20.breakdown.containers).toBeLessThan(est40.breakdown.containers);
  });

  it('BOM-6: removeContainer reduces cost to zero', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    expect(useStore.getState().getEstimate().breakdown.containers).toBe(5600);
    useStore.getState().removeContainer(id);
    expect(useStore.getState().getEstimate().breakdown.total).toBe(0);
  });
});
