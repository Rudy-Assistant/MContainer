import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearWalkthroughCameraPoseOverride,
  consumeWalkthroughCameraPoseOverride,
  installWalkthroughCameraPoseApi,
  normalizeWalkthroughCameraPose,
  registerWalkthroughCameraPoseApplier,
  setWalkthroughCameraPoseOverride,
} from '@/utils/walkthroughCameraPose';

afterEach(() => {
  clearWalkthroughCameraPoseOverride();
  vi.unstubAllGlobals();
});

describe('walkthrough camera pose override', () => {
  it('normalizes object and tuple vectors for the browser API', () => {
    const pose = normalizeWalkthroughCameraPose({
      position: { x: 1, y: 2, z: 3 },
      target: [4, 5, 6],
      yaw: '1.25' as unknown as number,
      floorY: 0.4,
    });

    expect(pose).toEqual({
      position: [1, 2, 3],
      target: [4, 5, 6],
      yaw: 1.25,
      pitch: undefined,
      floorY: 0.4,
    });
  });

  it('queues a pose for WalkthroughControls to consume before default spawn', () => {
    const pose = setWalkthroughCameraPoseOverride({
      position: [7, 1.66, -2],
      yaw: Math.PI / 2,
    });

    expect(consumeWalkthroughCameraPoseOverride()).toEqual(pose);
    expect(consumeWalkthroughCameraPoseOverride()).toBeNull();
  });

  it('applies immediately when walkthrough controls are already mounted', () => {
    let applied = null as ReturnType<typeof setWalkthroughCameraPoseOverride> | null;
    const unregister = registerWalkthroughCameraPoseApplier((pose) => {
      applied = pose;
    });

    const pose = setWalkthroughCameraPoseOverride({
      position: { x: -1, y: 3, z: 9 },
      target: { x: -1, y: 3, z: 4 },
    });

    unregister();

    expect(applied).toEqual(pose);
    expect(consumeWalkthroughCameraPoseOverride()).toBeNull();
  });

  it('installs a window hook for Playwright scripts', () => {
    const fakeWindow = {} as Window;
    vi.stubGlobal('window', fakeWindow);

    const cleanup = installWalkthroughCameraPoseApi();
    const pose = window.__setWalkthroughCameraPose?.({
      position: [2, 2.1, 8],
      pitch: -0.15,
    });

    cleanup();

    expect(pose?.position).toEqual([2, 2.1, 8]);
    expect(consumeWalkthroughCameraPoseOverride()).toEqual(pose);
    expect(window.__setWalkthroughCameraPose).toBeUndefined();
  });

  it('rejects non-finite coordinates', () => {
    expect(() =>
      normalizeWalkthroughCameraPose({
        position: [0, Number.NaN, 0],
      }),
    ).toThrow(/position/);
  });
});
