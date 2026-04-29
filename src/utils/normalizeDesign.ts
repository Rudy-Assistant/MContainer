/**
 * normalizeDesign.ts — Unified Smart Rules correctness gate.
 *
 * This is the one public API that bridges Smart Rules into every invocation
 * point that can produce a Container[] record:
 *   1. `applyDesignIntent` / `applyMultiContainerDesignIntent` — LLM output path.
 *   2. `importSharedDesign` — share-URL import.
 *   3. `cleanupDesign` store action — user-initiated "Clean up" button.
 *   4. (interactive) `validateDesign` — ValidationSubscriber still runs scans on
 *       every container mutation; this file's report mode is used there too.
 *
 * Two modes:
 *   - `'report'`  → pure scan, no mutation. Returns warnings.
 *   - `'repair'`  → scan + autofix in dependency order, then re-scan.
 *
 * Invariants:
 *   - Repair is IDEMPOTENT: running twice yields identical output.
 *   - Repair DOES NOT MUTATE the input map (returns a new record).
 *   - Physics-severity violations (SR-01, SR-03, SR-07, SR-09) that remain
 *     *after* repair indicate structurally impossible AI output — the caller
 *     should reject the design.
 *
 * Cascade order (documented in SMART_RULES.md):
 *     SR-07 → SR-01 → SR-05 → SR-06 → SR-09 → SR-04 → SR-10 → SR-03
 *
 *     Why:
 *       SR-07 first  — strip stale rooftop-deck from non-topmost containers;
 *                      later rules read the stacking graph as authoritative.
 *       SR-01 then   — open ceilings above stairs so SR-05/SR-06 scan against
 *                      the final face state.
 *       SR-05, SR-06 — entry wall + lateral railings for each stair.
 *       SR-09        — propagate the floor void across stacked containers.
 *       SR-04, SR-10 — perimeter and fall-hazard railings, with prior fixes
 *                      already applied (avoids re-writing openings the stair
 *                      rules just created).
 *       SR-03 last   — clear any Deck_Wood stranded on non-top levels by any
 *                      upstream repair.
 */

import type { Container } from '@/types/container';
import type { DesignWarning } from '@/types/validation';
import { validateSmartRules, type SmartRuleViolation } from '@/utils/smartRuleValidator';
import {
  repairCrossContainerVoid,
  repairFallHazardGuard,
  repairOpenEdgeRailing,
  repairRooftopLevel,
  repairRooftopTopmost,
  repairStairEntryWall,
  repairStairLateralRailing,
  repairStairVoid,
} from '@/utils/smartRuleRepair';

export type NormalizeMode = 'repair' | 'report';

export interface NormalizeOptions {
  mode: NormalizeMode;
  /** If set, physics violations remaining after repair fail the normalize
   *  (the caller can treat this as a reject signal). Default: true in repair
   *  mode, false in report mode (report mode never rejects). */
  rejectOnResidualPhysics?: boolean;
}

export interface NormalizeResult {
  containers: Record<string, Container>;
  /** All violations from the final scan — same shape as stored warnings. */
  violations: SmartRuleViolation[];
  /** Violation → DesignWarning adapter output for the existing warning pipeline. */
  warnings: DesignWarning[];
  /** True iff any repair pass mutated the containers record. */
  repaired: boolean;
  /** Only set in repair mode when `rejectOnResidualPhysics` triggers. */
  rejected?: boolean;
  /** Human-readable note per applied repair pass. Ordered. */
  notes: string[];
}

const REPAIR_PASSES: Array<{
  rule: string;
  apply: (c: Record<string, Container>) => Record<string, Container>;
}> = [
  { rule: 'SR-07', apply: repairRooftopTopmost },
  { rule: 'SR-01', apply: repairStairVoid },
  { rule: 'SR-05', apply: repairStairEntryWall },
  { rule: 'SR-06', apply: repairStairLateralRailing },
  { rule: 'SR-09', apply: repairCrossContainerVoid },
  { rule: 'SR-04', apply: repairOpenEdgeRailing },
  { rule: 'SR-10', apply: repairFallHazardGuard },
  { rule: 'SR-03', apply: repairRooftopLevel },
];

function violationToDesignWarning(v: SmartRuleViolation): DesignWarning {
  return {
    id: `smart-${v.ruleId}-${v.containerId}-${v.voxelIndex ?? 'x'}`,
    category: 'structural',
    severity: v.severity === 'high' ? 'error' : v.severity === 'medium' ? 'warning' : 'info',
    message: `[${v.ruleId}] ${v.message}`,
    containerId: v.containerId,
    voxelIndices: v.voxelIndex !== undefined ? [v.voxelIndex] : [],
  };
}

/** Physics-tier rule IDs — residuals after repair signal an AI-generated
 *  design that violates real-world geometry. Callers filter on this set to
 *  decide whether to reject or accept a design. Exported so tests and AI
 *  pipeline code have a single source of truth. */
export const PHYSICS_RULE_IDS: ReadonlySet<string> = new Set([
  'SR-01-stair-void',
  'SR-03-rooftop-level',
  'SR-07-rooftop-topmost',
  'SR-09-cross-container-void',
]);

export function isPhysicsViolation(v: SmartRuleViolation): boolean {
  return PHYSICS_RULE_IDS.has(v.ruleId);
}

// Private alias retained for internal brevity.
function isPhysics(v: SmartRuleViolation): boolean {
  return isPhysicsViolation(v);
}

/** Shallow-equal containers map used to detect repair no-ops for idempotency. */
function containersEqual(a: Record<string, Container>, b: Record<string, Container>): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function normalizeDesign(
  containers: Record<string, Container>,
  options: NormalizeOptions,
): NormalizeResult {
  const notes: string[] = [];

  if (options.mode === 'report') {
    const violations = validateSmartRules(containers);
    return {
      containers,
      violations,
      warnings: violations.map(violationToDesignWarning),
      repaired: false,
      notes,
    };
  }

  let current = containers;
  let repaired = false;
  for (const pass of REPAIR_PASSES) {
    const next = pass.apply(current);
    if (!containersEqual(current, next)) {
      repaired = true;
      notes.push(`${pass.rule} repair applied`);
      current = next;
    }
  }

  const violations = validateSmartRules(current);
  const residualPhysics = violations.filter(isPhysics);
  const rejectOn = options.rejectOnResidualPhysics ?? true;
  const rejected = rejectOn && residualPhysics.length > 0;

  return {
    containers: current,
    violations,
    warnings: violations.map(violationToDesignWarning),
    repaired,
    rejected,
    notes,
  };
}
