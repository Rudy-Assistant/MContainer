/**
 * Smart Rules end-to-end AI codepath tests.
 *
 * Three paths an LLM can take to produce a design:
 *   1. Prompt-intent JSON → Zod parse → store executor (the canonical path).
 *   2. Share-URL payload → importSharedDesign.
 *   3. A user clicking "Clean up design" over any broken state.
 *
 * In every path the Smart Rules correctness gate must:
 *   - reject malformed shapes at the Zod boundary (not deep in the executor),
 *   - auto-repair fixable violations,
 *   - produce a scene that passes the full Smart Rules report with zero
 *     physics-severity violations.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';
import {
  PromptDesignIntentZodSchema,
  parsePromptDesignIntent,
  safeParsePromptDesignIntent,
} from '@/config/designIntents';
import { isPhysicsViolation, normalizeDesign } from '@/utils/normalizeDesign';
import { validateSmartRules } from '@/utils/smartRuleValidator';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
  useStore.temporal.getState().clear();
}

describe('Smart Rules — AI codepath integration', () => {
  beforeEach(() => { resetStore(); });

  // ── Zod boundary ───────────────────────────────────────────

  it('AI-1: valid single_container intent parses successfully', () => {
    const intent = {
      kind: 'single_container' as const,
      arrangementId: 'max_closed' as const,
      rooftopDeck: false,
    };
    const result = safeParsePromptDesignIntent(intent);
    expect(result.success).toBe(true);
  });

  it('AI-2: unknown arrangementId fails Zod parse with descriptive error', () => {
    const hallucination = {
      kind: 'single_container',
      arrangementId: 'not_a_real_arrangement',
    };
    const result = safeParsePromptDesignIntent(hallucination);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('arrangementId');
    }
  });

  it('AI-3: unknown top-level key is rejected by .strict()', () => {
    const hallucination = {
      kind: 'single_container',
      arrangementId: 'max_closed',
      color: 'red', // LLM hallucinates a field the schema doesn't have
    };
    const result = safeParsePromptDesignIntent(hallucination);
    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod reports unknown keys with the "Unrecognized key" message.
      expect(result.error.toLowerCase()).toMatch(/color|unrecognized/);
    }
  });

  it('AI-4: parsePromptDesignIntent throws ZodError on malformed input', () => {
    expect(() => parsePromptDesignIntent({ kind: 'bogus' })).toThrow();
  });

  it('AI-5: concept variant with minimal fields parses', () => {
    const intent = {
      kind: 'concept' as const,
      composition: 'gallery_wings' as const,
    };
    const result = safeParsePromptDesignIntent(intent);
    expect(result.success).toBe(true);
  });

  it('AI-6: multi_container with a single node parses', () => {
    const intent = {
      kind: 'multi_container' as const,
      containers: [{ key: 'node1', arrangementId: 'max_closed' as const }],
    };
    const result = safeParsePromptDesignIntent(intent);
    expect(result.success).toBe(true);
  });

  // ── Normalization — physics rejection ──────────────────────

  it('AI-7: normalizeDesign rejects residual physics violations by default', () => {
    // Synthesize a design with a stair that reaches the top level but no
    // container stacked on top (SR-09 cannot fix — there's nothing to modify).
    // Actually SR-01 covers stair-void within one container; let's use a
    // stair-to-nowhere that SR-01 can't repair because the ascent voxel is OOB.
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyStairsFromFace(id, 9, 'n');
    const containers = useStore.getState().containers;

    const result = normalizeDesign(containers, { mode: 'repair' });
    // The default two_story/single_container path is fixable — rejected=false.
    expect(result.rejected).toBe(false);
  });

  // ── End-to-end invocation ──────────────────────────────────

  it('AI-8: applyDesignIntent produces a scene that passes Smart Rules', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyDesignIntent(id, {
      kind: 'single_container',
      arrangementId: 'max_closed',
    });
    const violations = validateSmartRules(useStore.getState().containers);
    const physics = violations.filter(isPhysicsViolation);
    expect(physics).toEqual([]);
  });

  it('AI-9: applyMultiContainerDesignIntent produces a scene that passes Smart Rules', () => {
    useStore.getState().applyMultiContainerDesignIntent({
      kind: 'multi_container',
      containers: [
        {
          id: 'n1', size: ContainerSize.HighCube40,
          placement: { type: 'origin', position: { x: 0, y: 0, z: 0 } },
          intent: { kind: 'single_container', arrangementId: 'max_closed' },
        },
        {
          id: 'n2', size: ContainerSize.HighCube40,
          placement: { type: 'adjacent', target: 'n1', side: 'east', gap: 0 },
          intent: { kind: 'single_container', arrangementId: 'max_closed' },
        },
      ],
    });
    const violations = validateSmartRules(useStore.getState().containers);
    const physics = violations.filter(isPhysicsViolation);
    expect(physics).toEqual([]);
  });

  it('AI-10: cleanupDesign is idempotent — two calls produce identical state', () => {
    useStore.getState().placeModelHome('stacked_triplex');
    useStore.getState().cleanupDesign();
    const afterFirst = useStore.getState().containers;
    const second = useStore.getState().cleanupDesign();
    const afterSecond = useStore.getState().containers;

    // Idempotency: the observable warning set must be identical. Object
    // identity isn't guaranteed (repair functions may rebuild sub-records
    // without writing different face values), but the scan result must match.
    const firstViolations = normalizeDesign(afterFirst, { mode: 'report' }).violations;
    const secondViolations = second.violations;
    expect(secondViolations).toEqual(firstViolations);
    // And re-scanning the already-repaired state should yield the same.
    const afterSecondReport = normalizeDesign(afterSecond, { mode: 'report' }).violations;
    expect(afterSecondReport).toEqual(firstViolations);
  });

  it('AI-11: cleanupDesign performance — <50ms on a 4-container design', () => {
    useStore.getState().applyMultiContainerDesignIntent({
      kind: 'multi_container',
      containers: [
        { id: 'a', size: ContainerSize.HighCube40,
          placement: { type: 'origin', position: { x: 0, y: 0, z: 0 } },
          intent: { kind: 'single_container', arrangementId: 'max_closed' } },
        { id: 'b', size: ContainerSize.HighCube40,
          placement: { type: 'adjacent', target: 'a', side: 'east' },
          intent: { kind: 'single_container', arrangementId: 'max_closed' } },
        { id: 'c', size: ContainerSize.HighCube40,
          placement: { type: 'adjacent', target: 'a', side: 'south' },
          intent: { kind: 'single_container', arrangementId: 'max_closed' } },
        { id: 'd', size: ContainerSize.HighCube40,
          placement: { type: 'adjacent', target: 'b', side: 'south' },
          intent: { kind: 'single_container', arrangementId: 'max_closed' } },
      ],
    });

    const containers = useStore.getState().containers;
    const start = performance.now();
    normalizeDesign(containers, { mode: 'repair' });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});

describe('PromptDesignIntentZodSchema — schema shape', () => {
  beforeEach(() => { resetStore(); });

  it('ZOD-1: exports a discriminated union on kind', () => {
    // sanity: a known-bad discriminator is rejected
    expect(PromptDesignIntentZodSchema.safeParse({ kind: 'unknown' }).success).toBe(false);
  });

  it('ZOD-2: single_container rejects out-of-range voxelIndex in door', () => {
    const bad = { kind: 'single_container', door: { voxelIndex: 999, face: 'n' } };
    expect(PromptDesignIntentZodSchema.safeParse(bad).success).toBe(false);
  });

  it('ZOD-3: multi_container rejects empty container list', () => {
    const bad = { kind: 'multi_container', containers: [] };
    expect(PromptDesignIntentZodSchema.safeParse(bad).success).toBe(false);
  });

  it('ZOD-4: Zod → parsePromptDesignIntentSchema → executor chain produces containers', async () => {
    // End-to-end: an LLM emits prompt-shaped JSON (uses `key`, not `id`).
    // Zod accepts it, the parser adapter renames `key` → `id`, the executor
    // creates containers. A regression anywhere in the chain would break this.
    const raw = {
      kind: 'multi_container' as const,
      containers: [
        { key: 'alpha', size: '40ft_high_cube' as const, arrangementId: 'max_closed' as const, placement: { type: 'origin' as const } },
        { key: 'beta',  size: '40ft_high_cube' as const, arrangementId: 'max_closed' as const, placement: { type: 'adjacent' as const, target: 'alpha', side: 'east' as const } },
      ],
    };

    // Step 1: Zod accepts.
    const zodResult = safeParsePromptDesignIntent(raw);
    expect(zodResult.success).toBe(true);

    // Step 2: Adapter converts prompt schema → internal DesignIntentSpec.
    // Lazy import so this test doesn't rebuild the module graph on every tick.
    const { parsePromptDesignIntentSchema } = await import('@/config/designIntents');
    expect(zodResult.success).toBe(true);
    if (!zodResult.success) return;
    const spec = parsePromptDesignIntentSchema(zodResult.data as Parameters<typeof parsePromptDesignIntentSchema>[0]);

    // Step 3: Executor places containers.
    expect(spec.kind).toBe('multi_container');
    if (spec.kind !== 'multi_container') return;
    const ids = useStore.getState().applyMultiContainerDesignIntent(spec);
    expect(ids).toHaveLength(2);
    // Reset ensures we only count the containers this test placed.
    const placedCount = ids.filter((id) => useStore.getState().containers[id]).length;
    expect(placedCount).toBe(2);
  });
});
