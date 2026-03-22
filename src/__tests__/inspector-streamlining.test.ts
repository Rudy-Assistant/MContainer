import { describe, it, expect } from 'vitest';
import { isFrameTranslucent } from '@/components/three/ContainerMesh';

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
