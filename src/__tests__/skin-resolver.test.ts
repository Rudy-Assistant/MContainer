import { describe, it, expect } from 'vitest';
import { resolveSkin } from '@/utils/skinResolver';

describe('Skin Resolver', () => {
  it('returns form defaults when no overrides and no style', () => {
    const resolved = resolveSkin(
      { frame: 'raw_steel', glass: 'clear_glass' },
      {},
      undefined,
    );
    expect(resolved).toEqual({ frame: 'raw_steel', glass: 'clear_glass' });
  });

  it('style defaults override form defaults', () => {
    const resolved = resolveSkin(
      { frame: 'raw_steel', glass: 'clear_glass' },
      {},
      { frame: 'matte_black', glass: 'smoked_glass' },
    );
    expect(resolved).toEqual({ frame: 'matte_black', glass: 'smoked_glass' });
  });

  it('user overrides take highest priority', () => {
    const resolved = resolveSkin(
      { frame: 'raw_steel', glass: 'clear_glass' },
      { frame: 'polished_chrome' },
      { frame: 'matte_black', glass: 'smoked_glass' },
    );
    expect(resolved.frame).toBe('polished_chrome');
    expect(resolved.glass).toBe('smoked_glass');
  });

  it('extra form default slots not in style still appear', () => {
    const resolved = resolveSkin(
      { frame: 'raw_steel', glass: 'clear_glass', handle: 'wrought_iron' },
      {},
      { frame: 'matte_black' },
    );
    expect(resolved.handle).toBe('wrought_iron');
  });
});
