import { describe, it, expect } from 'vitest';
import { formatLength, formatLengthShort } from '@/utils/unitFormat';

// Round-trip targets — these are the canonical container dimensions
// (Standard40 length, Standard width, Standard height) that must read
// cleanly in feet for the imperial-by-default UI.

describe('formatLengthShort', () => {
  it('formats 12.19 m as ~40 ft (Standard40 length)', () => {
    expect(formatLengthShort(12.19, 'imperial')).toBe('40 ft');
  });

  it('formats 2.44 m as ~8 ft (container width)', () => {
    expect(formatLengthShort(2.44, 'imperial')).toBe('8 ft');
  });

  it('formats 0.30 m as ~1 ft', () => {
    expect(formatLengthShort(0.30, 'imperial')).toBe('1 ft');
  });

  it('formats 6.06 m as ~20 ft (Standard20 length)', () => {
    expect(formatLengthShort(6.06, 'imperial')).toBe('20 ft');
  });

  it('formats 2.59 m as ~8 ft (Standard height — short label rounds)', () => {
    expect(formatLengthShort(2.59, 'imperial')).toBe('8 ft');
  });

  it('returns one-decimal meters in metric mode', () => {
    expect(formatLengthShort(12.19, 'metric')).toBe('12.2 m');
    expect(formatLengthShort(2.44, 'metric')).toBe('2.4 m');
    expect(formatLengthShort(0.30, 'metric')).toBe('0.3 m');
  });

  it('uses ASCII unit suffixes only (no prime / double-prime)', () => {
    const out = formatLengthShort(12.19, 'imperial');
    expect(out).not.toMatch(/[′″’”]/);
  });
});

describe('formatLength (long form)', () => {
  it('formats 12.19 m as 40 ft 0 in', () => {
    expect(formatLength(12.19, 'imperial')).toBe('40 ft 0 in');
  });

  it('formats 2.44 m as 8 ft 0 in', () => {
    expect(formatLength(2.44, 'imperial')).toBe('8 ft 0 in');
  });

  it('formats 0.30 m as 1 ft 0 in (just under 12 in rounds up to 1 ft)', () => {
    // 0.30 m = 11.811 in, rounds to 12 in = 1 ft 0 in
    expect(formatLength(0.30, 'imperial')).toBe('1 ft 0 in');
  });

  it('formats 0.05 m as 2 in (well under one foot)', () => {
    expect(formatLength(0.05, 'imperial')).toBe('2 in');
  });

  it('formats 2.59 m as 8 ft 6 in (Standard container height)', () => {
    // 2.59 m = 8.4974 ft = 8 ft 5.969 in -> rounds to 8 ft 6 in
    expect(formatLength(2.59, 'imperial')).toBe('8 ft 6 in');
  });

  it('formats metric with one decimal and m suffix', () => {
    expect(formatLength(12.19, 'metric')).toBe('12.2 m');
    expect(formatLength(0.05, 'metric')).toBe('0.1 m');
  });

  it('uses ASCII suffixes only', () => {
    const out = formatLength(2.59, 'imperial');
    expect(out).not.toMatch(/[′″’”]/);
    expect(out).toMatch(/ft|in/);
  });
});

describe('round trips', () => {
  it('1 ft (~0.3048 m) round-trips through formatLengthShort', () => {
    expect(formatLengthShort(0.3048, 'imperial')).toBe('1 ft');
  });

  it('40 ft (~12.192 m) round-trips through formatLengthShort', () => {
    expect(formatLengthShort(12.192, 'imperial')).toBe('40 ft');
  });

  it('20 ft (~6.096 m) round-trips through formatLengthShort', () => {
    expect(formatLengthShort(6.096, 'imperial')).toBe('20 ft');
  });
});
