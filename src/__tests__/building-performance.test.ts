/**
 * Behavioral tests for buildingPerformance utilities — pure functions of
 * design state, so we can call them with constructed Container records
 * directly without spinning up the store.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateHERSScore,
  estimateSolarPV,
  checkIRCCompliance,
} from '@/utils/buildingPerformance';
import { ContainerSize, type Container } from '@/types/container';

const oneHC = (): Record<string, Container> => ({
  c1: {
    id: 'c1',
    size: ContainerSize.HighCube40,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    level: 0,
    voxelGrid: undefined,
    stackedOn: null,
  } as Container,
});

const oneStandard = (): Record<string, Container> => ({
  c1: {
    id: 'c1',
    size: ContainerSize.Standard40,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    level: 0,
    voxelGrid: undefined,
    stackedOn: null,
  } as Container,
});

describe('estimateHERSScore', () => {
  it('returns 0 score for empty design', () => {
    const r = estimateHERSScore({});
    expect(r.score).toBe(0);
    expect(r.ua).toBe(0);
  });

  it('produces a reasonable HERS score for a single 40HC', () => {
    const r = estimateHERSScore(oneHC());
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(150);
    expect(r.ua).toBeGreaterThan(0);
    expect(r.annualHeatingKWh).toBeGreaterThan(0);
  });

  it('uses provided HDD parameter', () => {
    const cold = estimateHERSScore(oneHC(), 8000);
    const mild = estimateHERSScore(oneHC(), 3000);
    expect(cold.annualHeatingKWh).toBeGreaterThan(mild.annualHeatingKWh);
  });
});

describe('estimateSolarPV', () => {
  it('returns finite values for an empty design', () => {
    const r = estimateSolarPV({});
    expect(r.systemKW).toBe(0);
    expect(r.annualKWh).toBe(0);
  });

  it('sizes proportionally to container roof area', () => {
    const r = estimateSolarPV(oneHC());
    expect(r.systemKW).toBeGreaterThan(3); // ~30 sqm * 200 W/sqm * 0.9 * 0.85 = ~4.6 kW
    expect(r.systemKW).toBeLessThan(8);
    expect(r.annualKWh).toBeGreaterThan(5000);
  });

  it('honors custom price + sun-hour overrides', () => {
    const cheap = estimateSolarPV(oneHC(), { pricePerKWh: 0.08 });
    const expensive = estimateSolarPV(oneHC(), { pricePerKWh: 0.32 });
    expect(expensive.annualSavingsUSD).toBeGreaterThan(cheap.annualSavingsUSD);
  });
});

describe('checkIRCCompliance', () => {
  it('warns when standard-height containers are used', () => {
    const rules = checkIRCCompliance(oneStandard());
    const ceiling = rules.find((r) => r.id === 'ceiling_height')!;
    expect(ceiling.status).toBe('warn');
  });

  it('passes ceiling height for High-Cube containers', () => {
    const rules = checkIRCCompliance(oneHC());
    const ceiling = rules.find((r) => r.id === 'ceiling_height')!;
    expect(ceiling.status).toBe('pass');
  });

  it('adds a stairs rule when multiple levels are present', () => {
    const c0 = oneHC();
    const c1 = { ...oneHC().c1, id: 'c2', level: 1 } as Container;
    const rules = checkIRCCompliance({ ...c0, c2: c1 });
    expect(rules.find((r) => r.id === 'stairs')).toBeDefined();
  });

  it('omits the stairs rule for single-level designs', () => {
    const rules = checkIRCCompliance(oneHC());
    expect(rules.find((r) => r.id === 'stairs')).toBeUndefined();
  });

  it('always returns egress + smoke-alarm rules', () => {
    const rules = checkIRCCompliance(oneHC());
    expect(rules.find((r) => r.id === 'egress')).toBeDefined();
    expect(rules.find((r) => r.id === 'smoke_alarms')).toBeDefined();
  });
});
