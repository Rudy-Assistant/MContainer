/**
 * designValidation.ts — Pure-function validation engine for ModuHome designs.
 *
 * NO React, NO Three.js dependencies. Operates on plain Container records.
 * Each rule function takes a containers record and returns DesignWarning[].
 */

import type { Container, VoxelFaces } from '@/types/container';
import { ContainerSize, VOXEL_COLS, VOXEL_ROWS, VOXEL_LEVELS } from '@/types/container';
import type { DesignWarning, ValidationRule } from '@/types/validation';
import { validateSmartRules, type SmartRuleViolation } from '@/utils/smartRuleValidator';

// ── Helpers ──────────────────────────────────────────────────

const WALL_FACES: ReadonlyArray<keyof Pick<VoxelFaces, 'n' | 's' | 'e' | 'w'>> = ['n', 's', 'e', 'w'];

/** Decode a flat voxel index into (level, row, col). */
function decodeIndex(idx: number): { level: number; row: number; col: number } {
  const perLevel = VOXEL_ROWS * VOXEL_COLS; // 32
  const level = Math.floor(idx / perLevel);
  const remainder = idx % perLevel;
  const row = Math.floor(remainder / VOXEL_COLS);
  const col = remainder % VOXEL_COLS;
  return { level, row, col };
}

/** Get the neighbor voxel index for a given face direction, or -1 if at grid boundary. */
function neighborIndex(idx: number, face: keyof VoxelFaces): number {
  const { level, row, col } = decodeIndex(idx);
  switch (face) {
    case 'n': return row > 0 ? idx - VOXEL_COLS : -1;
    case 's': return row < VOXEL_ROWS - 1 ? idx + VOXEL_COLS : -1;
    case 'e': return col < VOXEL_COLS - 1 ? idx + 1 : -1;
    case 'w': return col > 0 ? idx - 1 : -1;
    case 'top': return level < VOXEL_LEVELS - 1 ? idx + VOXEL_ROWS * VOXEL_COLS : -1;
    case 'bottom': return level > 0 ? idx - VOXEL_ROWS * VOXEL_COLS : -1;
    default: return -1;
  }
}

// ── Rule: Unprotected Edges (SR-04 alias) ─────────────────────

/**
 * checkUnprotectedEdges — Backward-compatible alias for SR-04.
 *
 * The original scanner body migrated into `smartRuleValidator.checkOpenEdgeRailing`
 * to deduplicate two rules that flagged the same defect. This export remains as
 * an alias so existing imports keep compiling; internally it just filters the
 * SR-04 output produced by `checkSmartRules`.
 *
 * Category stays `'safety'` / severity stays `'warning'` for wire-format stability
 * (previously persisted warnings and any downstream consumer dashboards keep
 * working). The newer `checkSmartRules` output uses `'structural'` / `'error'` —
 * that's the modern form; this alias is for legacy parity only.
 */
export const checkUnprotectedEdges: ValidationRule = (containers: Record<string, Container>) => {
  return checkSmartRules(containers, undefined)
    .filter((w) => w.id.includes('SR-04-open-edge-railing'))
    .map((w) => ({
      ...w,
      id: w.id.replace('smart-SR-04-open-edge-railing-', 'safety-unprotected-'),
      category: 'safety',
      severity: 'warning',
      message: w.message.replace(/^\[SR-04-open-edge-railing\]\s*/, ''),
    }));
};

// ── Rule: Stair to Nowhere ───────────────────────────────────

/**
 * checkStairToNowhere — Find voxels with stairPart='upper' in containers
 * where no other container is stacked on top (stackedOn === c.id).
 *
 * Category: 'safety', severity: 'warning'.
 */
export const checkStairToNowhere: ValidationRule = (containers: Record<string, Container>) => {
  const warnings: DesignWarning[] = [];

  // Build set of container IDs that have something stacked on them
  const hasStackedAbove = new Set<string>();
  for (const c of Object.values(containers)) {
    if (c.stackedOn) {
      hasStackedAbove.add(c.stackedOn);
    }
  }

  for (const c of Object.values(containers)) {
    if (!c.voxelGrid) continue;
    // If another container is stacked on this one, stairs lead somewhere
    if (hasStackedAbove.has(c.id)) continue;

    for (let i = 0; i < c.voxelGrid.length; i++) {
      const voxel = c.voxelGrid[i];
      if (!voxel.active) continue;
      if (voxel.stairPart !== 'upper') continue;

      warnings.push({
        id: `safety-stair-nowhere-${c.id}-${i}`,
        category: 'safety',
        severity: 'warning',
        message: `Stair voxel ${i} leads to nowhere — no container stacked above`,
        containerId: c.id,
        voxelIndices: [i],
      });
    }
  }

  return warnings;
};

// ── Rule: No Exit ───────────────────────────────────────────

/** Find containers where no body voxel has a passable wall (Open, Door, Sliding_Glass). */
export const checkNoExit: ValidationRule = (containers: Record<string, Container>) => {
  const warnings: DesignWarning[] = [];
  const PASSABLE = ['Open', 'Door', 'Sliding_Glass'];

  for (const c of Object.values(containers)) {
    if (!c.voxelGrid) continue;
    let hasExit = false;
    for (let i = 0; i < c.voxelGrid.length; i++) {
      const v = c.voxelGrid[i];
      if (!v.active) continue;
      const { level, row, col } = decodeIndex(i);
      // Only check level 0 body voxels (rows 1-2, cols 1-6)
      if (level !== 0) continue;
      if (row <= 0 || row >= VOXEL_ROWS - 1 || col <= 0 || col >= VOXEL_COLS - 1) continue;
      for (const face of WALL_FACES) {
        if (PASSABLE.includes(v.faces[face])) { hasExit = true; break; }
      }
      if (hasExit) break;
    }
    if (!hasExit) {
      warnings.push({
        id: `accessibility-noexit-${c.id}`,
        category: 'accessibility',
        severity: 'warning',
        message: 'No exit — all walls are solid',
        containerId: c.id,
        voxelIndices: [],
      });
    }
  }
  return warnings;
};

// ── Rule: No Weather Envelope ───────────────────────────────

/** Find containers where ALL active voxel wall faces are Open. */
export const checkNoEnvelope: ValidationRule = (containers: Record<string, Container>) => {
  const warnings: DesignWarning[] = [];
  for (const c of Object.values(containers)) {
    if (!c.voxelGrid) continue;
    let hasSolid = false;
    for (let i = 0; i < c.voxelGrid.length; i++) {
      const v = c.voxelGrid[i];
      if (!v.active) continue;
      for (const face of WALL_FACES) {
        if (v.faces[face] !== 'Open') { hasSolid = true; break; }
      }
      if (hasSolid) break;
    }
    if (!hasSolid) {
      warnings.push({
        id: `weather-noenvelope-${c.id}`,
        category: 'weather',
        severity: 'info',
        message: 'No weather envelope — all walls are open',
        containerId: c.id,
        voxelIndices: [],
      });
    }
  }
  return warnings;
};

// ── Rule: Gravity ───────────────────────────────────────────

/** Find stacked containers where the base container has been removed. */
export const checkGravity: ValidationRule = (containers: Record<string, Container>) => {
  const warnings: DesignWarning[] = [];
  for (const c of Object.values(containers)) {
    if (!c.stackedOn) continue;
    if (!containers[c.stackedOn]) {
      warnings.push({
        id: `structural-gravity-${c.id}`,
        category: 'structural',
        severity: 'error',
        message: 'Floating container — base container missing',
        containerId: c.id,
        voxelIndices: [],
      });
    }
  }
  return warnings;
};

// ── Rule: Unsupported Cantilever ────────────────────────────

/** Find extension voxels with roofing but no structural support. */
export const checkUnsupportedCantilever: ValidationRule = (containers: Record<string, Container>) => {
  const warnings: DesignWarning[] = [];
  for (const c of Object.values(containers)) {
    if (!c.voxelGrid) continue;
    for (let i = 0; i < c.voxelGrid.length; i++) {
      const v = c.voxelGrid[i];
      if (!v.active) continue;
      const { level, row, col } = decodeIndex(i);
      const isExtension = row === 0 || row === VOXEL_ROWS - 1 || col === 0 || col === VOXEL_COLS - 1;
      if (!isExtension || v.faces.top === 'Open') continue;

      // Check if any inward neighbor (toward body zone) is active
      const perLevel = VOXEL_ROWS * VOXEL_COLS;
      const encode = (r: number, cc: number) => level * perLevel + r * VOXEL_COLS + cc;

      const inwardNeighbors: number[] = [];
      if (row === 0 && row + 1 < VOXEL_ROWS) inwardNeighbors.push(encode(row + 1, col));
      if (row === VOXEL_ROWS - 1 && row - 1 >= 0) inwardNeighbors.push(encode(row - 1, col));
      if (col === 0 && col + 1 < VOXEL_COLS) inwardNeighbors.push(encode(row, col + 1));
      if (col === VOXEL_COLS - 1 && col - 1 >= 0) inwardNeighbors.push(encode(row, col - 1));

      const hasSupport = inwardNeighbors.some(ni => {
        const nv = c.voxelGrid![ni];
        return nv && nv.active;
      });

      if (!hasSupport) {
        warnings.push({
          id: `structural-cantilever-${c.id}-${i}`,
          category: 'structural',
          severity: 'info',
          message: `Extension voxel ${i} has roofing without structural support`,
          containerId: c.id,
          voxelIndices: [i],
        });
      }
    }
  }
  return warnings;
};

// ── Rule: Budget ────────────────────────────────────────────

/** Check if total estimated cost exceeds budget threshold. */
export const checkBudget: ValidationRule = (containers: Record<string, Container>, options) => {
  if (!options?.budgetThreshold) return [];
  let totalCost = 0;
  for (const c of Object.values(containers)) {
    totalCost += c.size === ContainerSize.Standard20 ? 2500 : 5600;
  }
  if (totalCost > options.budgetThreshold) {
    return [{
      id: 'budget-total',
      category: 'budget',
      severity: 'info',
      message: `Total cost $${totalCost.toLocaleString()} exceeds budget $${options.budgetThreshold.toLocaleString()}`,
      containerId: Object.keys(containers)[0] ?? '',
      voxelIndices: [],
    }];
  }
  return [];
};

// ── Rules Registry ───────────────────────────────────────────

/** Smart-rule violations flow through the same warning pipeline so users see
 *  them in the toolbar's Warning Badge. Violations with severity 'high' map to
 *  'error', 'medium' to 'warning', anything else to 'info'. */
export const checkSmartRules: ValidationRule = (containers: Record<string, Container>) => {
  const out: DesignWarning[] = [];
  const violations = validateSmartRules(containers);
  for (const v of violations) {
    out.push({
      id: `smart-${v.ruleId}-${v.containerId}-${v.voxelIndex ?? 'x'}`,
      category: 'structural',
      severity: v.severity === 'high' ? 'error' : v.severity === 'medium' ? 'warning' : 'info',
      message: `[${v.ruleId}] ${v.message}`,
      containerId: v.containerId,
      voxelIndices: v.voxelIndex !== undefined ? [v.voxelIndex] : [],
    });
  }
  return out;
};

// `checkUnprotectedEdges` is intentionally NOT in this list — it's exported
// above as a backward-compat alias that re-derives SR-04 warnings, but the
// canonical path is `checkSmartRules`, which emits the same defects in the
// modern format. Keeping both in RULES would cause every elevated-edge
// defect to surface twice (different IDs, different categories).
const RULES: ValidationRule[] = [
  checkStairToNowhere,
  checkNoExit,
  checkNoEnvelope,
  checkGravity,
  checkUnsupportedCantilever,
  checkBudget,
  checkSmartRules,
];

// ── Main Entry Point ─────────────────────────────────────────

/**
 * validateDesign — Runs all registered validation rules against the design.
 * Deduplicates warnings by ID.
 *
 * @param containers - Record of all containers in the design
 * @param budgetThreshold - Optional budget threshold for budget rules
 * @returns Array of deduplicated DesignWarning objects
 */
export function validateDesign(
  containers: Record<string, Container>,
  budgetThreshold?: number,
): DesignWarning[] {
  const seen = new Set<string>();
  const warnings: DesignWarning[] = [];

  for (const rule of RULES) {
    const results = rule(containers, { budgetThreshold });
    for (const w of results) {
      if (!seen.has(w.id)) {
        seen.add(w.id);
        warnings.push(w);
      }
    }
  }

  return warnings;
}
