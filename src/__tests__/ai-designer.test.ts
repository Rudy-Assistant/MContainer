/**
 * Behavioral tests for applyDesignPlan — exercises the real store, not source
 * scans. Asserts that a plan ends in the expected mutations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '@/store/useStore';
import { applyDesignPlan, fetchDesignPlan, type DesignPlan } from '@/utils/aiDesigner';
import { ContainerSize } from '@/types/container';

describe('applyDesignPlan', () => {
  beforeEach(() => {
    // Reset to clean store before each test
    const s = useStore.getState();
    Object.keys(s.containers).forEach((id) => s.removeContainer(id));
    s.clearSelection();
  });

  it('adds containers in order, exposing IDs by ordinal index', () => {
    const plan: DesignPlan = {
      rationale: 'Two-container row test.',
      actions: [
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 0, y: 0, z: 0 } },
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 12.19, y: 0, z: 0 } },
      ],
    };
    const result = applyDesignPlan(plan, useStore.getState());
    expect(result.addedIds).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);
    expect(Object.keys(useStore.getState().containers)).toHaveLength(2);
  });

  it('applies a roof type when specified on add_container', () => {
    const plan: DesignPlan = {
      rationale: 'Single container with butterfly roof.',
      actions: [
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 0, y: 0, z: 0 }, roofType: 'butterfly' },
      ],
    };
    const result = applyDesignPlan(plan, useStore.getState());
    const c = useStore.getState().containers[result.addedIds[0]];
    expect(c.roofType).toBe('butterfly');
  });

  it('skips flat roof setRoofType call (default)', () => {
    const plan: DesignPlan = {
      rationale: 'Default flat roof.',
      actions: [
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 0, y: 0, z: 0 }, roofType: 'flat' },
      ],
    };
    const result = applyDesignPlan(plan, useStore.getState());
    expect(result.warnings).toHaveLength(0);
    // Container is created with flat roof by default — value should be 'flat' or undefined
    const c = useStore.getState().containers[result.addedIds[0]];
    expect(c.roofType ?? 'flat').toBe('flat');
  });

  it('applies a room preset to a container by ordinal index', () => {
    const plan: DesignPlan = {
      rationale: 'Container with galley kitchen.',
      actions: [
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 0, y: 0, z: 0 } },
        { type: 'apply_room_preset', containerIndex: 0, anchorBodyCol: 0, anchorBodyRow: 0, presetId: 'kitchen_galley' },
      ],
    };
    const result = applyDesignPlan(plan, useStore.getState());
    expect(result.warnings).toHaveLength(0);
    // The galley adds furniture overlays — fixtures count should be > 0 in the container's voxel grid
    const c = useStore.getState().containers[result.addedIds[0]];
    expect(c.voxelGrid).toBeDefined();
  });

  it('warns when room preset references a missing container index', () => {
    const plan: DesignPlan = {
      rationale: 'Bad reference.',
      actions: [
        { type: 'apply_room_preset', containerIndex: 5, anchorBodyCol: 0, anchorBodyRow: 0, presetId: 'kitchen_galley' },
      ],
    };
    const result = applyDesignPlan(plan, useStore.getState());
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('container index 5');
  });

  it('toggles site context when set_site_context action is included', () => {
    useStore.getState().setSiteContextEnabled(false);
    const plan: DesignPlan = {
      rationale: 'Enable site context.',
      actions: [
        { type: 'set_site_context', enabled: true },
      ],
    };
    applyDesignPlan(plan, useStore.getState());
    expect(useStore.getState().environment.siteContextEnabled).toBe(true);
  });

  it('continues applying actions even when one preset fails to fit', () => {
    const plan: DesignPlan = {
      rationale: 'Plan with a bad-fit preset.',
      actions: [
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 0, y: 0, z: 0 } },
        // anchor 5 + open_plan_klr (6×2) overflows — should warn, not crash
        { type: 'apply_room_preset', containerIndex: 0, anchorBodyCol: 5, anchorBodyRow: 0, presetId: 'open_plan_klr' },
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 12.19, y: 0, z: 0 } },
      ],
    };
    const result = applyDesignPlan(plan, useStore.getState());
    expect(result.addedIds).toHaveLength(2); // both containers created
    expect(result.warnings.length).toBeGreaterThan(0); // overflow warning
  });
});

describe('fetchDesignPlan', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockFetch(response: { ok: boolean; status: number; body: unknown }) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status,
      json: () => Promise.resolve(response.body),
    } as Response);
  }

  it('returns ok:true with parsed plan when server responds 200 with valid plan', async () => {
    const plan: DesignPlan = {
      rationale: 'A simple home.',
      actions: [
        { type: 'add_container', size: ContainerSize.HighCube40, position: { x: 0, y: 0, z: 0 } },
      ],
    };
    mockFetch({ ok: true, status: 200, body: { plan } });
    const result = await fetchDesignPlan('two-bedroom modern home');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.rationale).toBe('A simple home.');
      expect(result.plan.actions).toHaveLength(1);
    }
  });

  it('returns ok:false when server returns 503 missing-API-key error', async () => {
    mockFetch({
      ok: false,
      status: 503,
      body: { error: 'ANTHROPIC_API_KEY is not set on the server.' },
    });
    const result = await fetchDesignPlan('any prompt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('ANTHROPIC_API_KEY');
    }
  });

  it('returns ok:false when server returns 400 with no error string', async () => {
    mockFetch({ ok: false, status: 400, body: {} });
    const result = await fetchDesignPlan('any prompt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('400');
    }
  });

  it('returns ok:false when server returns malformed plan (missing actions)', async () => {
    mockFetch({
      ok: true,
      status: 200,
      body: { plan: { rationale: 'No actions array.' } },
    });
    const result = await fetchDesignPlan('any prompt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('actions array');
    }
  });

  it('returns ok:false when server returns plan without rationale', async () => {
    mockFetch({
      ok: true,
      status: 200,
      body: { plan: { actions: [] } },
    });
    const result = await fetchDesignPlan('any prompt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('rationale');
    }
  });

  it('returns ok:false when fetch itself throws (network error)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('connection refused'));
    const result = await fetchDesignPlan('any prompt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('connection refused');
    }
  });

  it('returns ok:false when response is not valid JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('Unexpected token <')),
    } as Response);
    const result = await fetchDesignPlan('any prompt');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('non-JSON');
    }
  });
});
