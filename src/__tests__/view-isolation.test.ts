import { describe, it, expect } from 'vitest';
import { getViewOpacity } from '@/utils/viewIsolation';

describe('View Isolation: getViewOpacity', () => {
  it('VI-1: floor+noFrame → floor faces full, ceiling faces faded, frame background', () => {
    expect(getViewOpacity('floor-face', 'floor', false)).toBe(1.0);
    expect(getViewOpacity('ceiling-face', 'floor', false)).toBeCloseTo(0.15);
    expect(getViewOpacity('frame', 'floor', false)).toBeCloseTo(0.3);
  });

  it('VI-2: ceiling+noFrame → ceiling faces full, floor faces faded, frame background', () => {
    expect(getViewOpacity('floor-face', 'ceiling', false)).toBeCloseTo(0.15);
    expect(getViewOpacity('ceiling-face', 'ceiling', false)).toBe(1.0);
    expect(getViewOpacity('frame', 'ceiling', false)).toBeCloseTo(0.3);
  });

  it('VI-3: floor+frame → floor faces reduced, frame full', () => {
    expect(getViewOpacity('floor-face', 'floor', true)).toBeCloseTo(0.4);
    expect(getViewOpacity('ceiling-face', 'floor', true)).toBeCloseTo(0.1);
    expect(getViewOpacity('frame', 'floor', true)).toBe(1.0);
  });

  it('VI-4: ceiling+frame → ceiling faces reduced, frame full', () => {
    expect(getViewOpacity('floor-face', 'ceiling', true)).toBeCloseTo(0.1);
    expect(getViewOpacity('ceiling-face', 'ceiling', true)).toBeCloseTo(0.4);
    expect(getViewOpacity('frame', 'ceiling', true)).toBe(1.0);
  });
});
