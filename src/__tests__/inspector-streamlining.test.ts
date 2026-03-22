import { describe, it, expect, beforeEach } from 'vitest';
import { isFrameTranslucent } from '@/components/three/ContainerMesh';
import { useStore } from '@/store/useStore';

const resetStore = () => useStore.setState(useStore.getInitialState(), true);

describe('isFrameTranslucent', () => {
  it('full mode → opaque', () => {
    expect(isFrameTranslucent('full', 1.0)).toBe(false);
  });

  it('half mode → translucent', () => {
    expect(isFrameTranslucent('half', 1.0)).toBe(true);
  });

  it('down mode → translucent', () => {
    expect(isFrameTranslucent('down', 1.0)).toBe(true);
  });

  it('custom with wallCutHeight=1.0 → opaque', () => {
    expect(isFrameTranslucent('custom', 1.0)).toBe(false);
  });

  it('custom with wallCutHeight=0.5 → translucent', () => {
    expect(isFrameTranslucent('custom', 0.5)).toBe(true);
  });
});

describe('Global hideRoof / hideSkin store', () => {
  beforeEach(resetStore);

  it('hideRoof defaults to false', () => {
    expect(useStore.getState().hideRoof).toBe(false);
  });

  it('hideSkin defaults to false', () => {
    expect(useStore.getState().hideSkin).toBe(false);
  });

  it('toggleHideRoof flips the value', () => {
    useStore.getState().toggleHideRoof();
    expect(useStore.getState().hideRoof).toBe(true);
    useStore.getState().toggleHideRoof();
    expect(useStore.getState().hideRoof).toBe(false);
  });

  it('toggleHideSkin flips the value', () => {
    useStore.getState().toggleHideSkin();
    expect(useStore.getState().hideSkin).toBe(true);
    useStore.getState().toggleHideSkin();
    expect(useStore.getState().hideSkin).toBe(false);
  });
});
