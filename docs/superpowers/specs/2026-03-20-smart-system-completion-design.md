# Smart System Completion: Phases 3–7 + Bug Fixes + Phase 2 Gap-Fill

## Summary

Complete all remaining Smart Architecture phases (3–7) plus Phase 2 gaps and Sprint 17 bug fixes in a single sprint. Organized by system rather than phase number to minimize file thrash and maximize parallelization.

**Scope:** 4 work streams, ~16-18 implementation tasks.

**Phases covered:**
- Phase 2 gaps: View isolation wiring, WI-1 3D wall-side bay hover
- Phase 3 fix: Partial-overlap merge (Bug #2)
- Phase 4: Detail Mode Override (Smart ↔ Detail toggle)
- Phase 5: Design Validation Warnings (inspector + 3D overlay)
- Phase 6: Structural Support / Gravity (advisory rules)
- Phase 7: Collision Mesh gap-fill (stair ramps in walkthrough)
- Sprint 17 bugs: #2 over-merge (the only confirmed-remaining bug; #1, #3, #4 verified as already fixed)

**Dependencies:** Builds on completed Phase 1 (smart staircases), Phase 2 (auto-railing, smart poles, frame mode, bay groups), and existing adjacency merge system.

**Naming note:** The codebase has `designComplexity: 'simple' | 'detailed'` (controls bay grouping vs individual voxels). The new `designMode: 'smart' | 'manual'` is an independent axis controlling whether auto-consequence cascades fire. These are orthogonal — any combination of complexity × mode is valid.

---

## Stream 1: Store & Data Model

### 1a. Detail Mode Toggle (Phase 4)

New fields on `uiSlice` (ephemeral, not persisted):

```typescript
designMode: 'smart' | 'manual'   // default: 'smart'
toggleDesignMode: () => void
setDesignMode: (mode: 'smart' | 'manual') => void
```

**Behavior:**
- `'smart'` (default): All auto-consequence cascades fire normally (auto-railing, entry wall clearing, merge, etc.)
- `'manual'`: All auto-consequence functions become no-ops. User paints faces exactly as specified. Existing state is preserved (no retroactive changes).
- Switching `manual → smart`: Runs a validation pass via the Phase 5 engine and surfaces warnings for anything smart mode *would have* auto-fixed. Does NOT auto-fix — just warns. User decides.

**Relationship to `designComplexity`:** `designComplexity` ('simple'|'detailed') controls granularity of bay grouping in the 2D grid. `designMode` ('smart'|'manual') controls whether auto-consequence cascades fire. These are orthogonal axes — any combination is valid.

**Guard placement:** Every auto-consequence call site (`recomputeSmartRailings` at 5 call sites in `voxelSlice.ts`, stair entry wall clearing, `refreshAdjacency` merge step in `containerSlice.ts`) gets a `if (designMode === 'manual') return` guard. Access via `useStore.getState().designMode` inside store actions (no selector needed — read at call time).

### 1b. Validation Warning State (Phase 5)

New fields on `uiSlice` (ephemeral, not persisted):

```typescript
warnings: DesignWarning[]           // computed, not user-editable
setWarnings: (warnings: DesignWarning[]) => void
hoveredWarning: string | null       // warning ID for 3D highlight
setHoveredWarning: (id: string | null) => void
```

New shared type (in `src/types/validation.ts`):

```typescript
export interface DesignWarning {
  id: string                        // deterministic: "{category}-{containerId}-{voxelIdx}-{face}"
  category: 'safety' | 'accessibility' | 'weather' | 'structural' | 'budget'
  severity: 'error' | 'warning' | 'info'
  message: string                   // human-readable
  containerId: string
  voxelIndices: number[]            // affected voxels (for 3D highlight)
  faces?: string[]                  // affected faces (for edge highlights)
}
```

Warnings are **recomputed** (not accumulated) — every time the validation engine runs, it produces a fresh array. No stale warning tracking.

### 1c. Sprint 17 Bug #2: Partial-Overlap Merge Fix (Phase 3)

Fix the merge step in `refreshAdjacency()` (Step 3, containerSlice.ts ~line 1458):
- Current: `refreshAdjacency` already has per-voxel geometric overlap checking, but may still over-merge in edge cases (e.g., 20ft + 40ft partial overlap)
- Verify: test with mismatched container sizes and partial overlaps
- If the existing overlap check is insufficient, tighten the AABB intersection to require actual face-to-face contact (not just bounding box overlap)
- Uses existing `CONTAINER_DIMENSIONS` + voxel pitch math to compute per-voxel world bounds
- `adjacencyDetection.ts` already has AABB math — extend with per-voxel granularity if needed

### 1d. Sprint 17 Bugs #1, #3, #4: Already Resolved

Spec review confirmed these three bugs are already fixed in the current codebase:

- **Bug #1 (Stack UI):** `ContainerContextMenu.tsx` already has "Stack Container Above" button (lines 58-67, 119-127) with `handleStackAbove` callback. If stacking still fails, the root cause is in `stackContainer` action logic, not missing UI.
- **Bug #3 (Sticky alignment):** `addContainer` already calls `findEdgeSnap()` (line 284 of `containerSlice.ts`). Verify in browser before adding redundant snap logic.
- **Bug #4 (Shift+click camera):** Already fixed via `isShiftHeldRef` in `Scene.tsx` (lines 1106-1126). Uses ref-based approach (more performant than store state — no re-renders). CameraControls disabled when Shift held (line 1114).

**Action:** During implementation, verify these in browser. If any still reproduce, diagnose the actual root cause rather than implementing the stale spec fix.

---

## Stream 2: Validation Engine (Phases 5 + 6)

### 2a. Architecture

New file: `src/utils/designValidation.ts`

Pure-function module with zero React/Three.js dependencies. Takes container state in, returns warnings out.

```typescript
export function validateDesign(
  containers: Record<string, ContainerState>,
  budgetThreshold?: number
): DesignWarning[]
```

Calls individual rule functions internally. Each rule is a pure function:

```typescript
type ValidationRule = (
  containers: Record<string, ContainerState>,
  options?: { budgetThreshold?: number }
) => DesignWarning[]
```

Rules registered in an array — adding new rules requires no engine changes:

```typescript
const RULES: ValidationRule[] = [
  checkUnprotectedEdges,
  checkNoExit,
  checkNoEnvelope,
  checkStairToNowhere,
  checkBudget,
  checkUnsupportedCantilever,
  checkGravity,
];
```

`validateDesign` iterates all rules, concatenates results, deduplicates by `id`.

### 2b. Rule Definitions

**Safety rules (Phase 5):**

| Rule | Trigger | Severity |
|------|---------|----------|
| `checkUnprotectedEdges` | Active voxel, `top === 'Open'`, wall face `Open` or absent, at height ≥ container Y + voxelHeight (not ground floor) | `warning` |
| `checkStairToNowhere` | Stair voxel (`stairPart === 'upper'`), no container stacked above OR no floor above the void | `warning` |

**Accessibility rules:**

| Rule | Trigger | Severity |
|------|---------|----------|
| `checkNoExit` | Container where ALL body voxel exterior wall faces are solid (no Open, no Door on any exterior face) | `warning` |

**Weather rules:**

| Rule | Trigger | Severity |
|------|---------|----------|
| `checkNoEnvelope` | Container where ALL body voxel exterior wall faces are `Open` (completely exposed) | `info` |

**Structural rules (Phase 6):**

| Rule | Trigger | Severity |
|------|---------|----------|
| `checkGravity` | Body voxel at level > 0 with no active voxel directly below in the container below (find via `stackedOn` field + position matching) | `warning` |
| `checkUnsupportedCantilever` | Extension voxel active with `top !== 'Open'` (roofed), extension spans > 1 voxel from body edge without poles beneath | `info` |

**Budget rule:**

| Rule | Trigger | Severity |
|------|---------|----------|
| `checkBudget` | Total BOM cost exceeds `budgetThreshold` (if provided) | `info` |

### 2c. Debounced Recomputation

Rather than instrumenting every store action, use a Zustand v5 `subscribe` with manual change detection:

```typescript
// ValidationSubscriber component (mounted once in app root)
useEffect(() => {
  let timer: ReturnType<typeof setTimeout>;
  let prevContainers = useStore.getState().containers;
  const unsub = useStore.subscribe((state, _prevState) => {
    // Only recompute if containers actually changed (reference check)
    if (state.containers === prevContainers) return;
    prevContainers = state.containers;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const warnings = validateDesign(state.containers, budgetThreshold);
      useStore.getState().setWarnings(warnings);
    }, 300);
  });
  return () => { unsub(); clearTimeout(timer); };
}, [budgetThreshold]);
```

**Note:** Zustand v5 `.subscribe()` takes a single `(state, prevState) => void` listener — NOT the v4 `subscribe(selector, callback, { equalityFn })` pattern. The `subscribeWithSelector` middleware is NOT in our middleware chain.

300ms debounce prevents validation spam during rapid edits (drag, batch paint).

### 2d. Testing Strategy

Each rule gets its own test group — construct minimal container state, call the rule function directly, assert warnings returned. No store dependency, no React, pure input→output.

---

## Stream 3: 2D UI

### 3a. Toast Library

Install `sonner`:
- 4KB, composable, React 19 compatible
- No provider wrapper — mount `<Toaster />` once in root layout
- Position: bottom-right (avoids hotbar at bottom-center)
- Used for transient notifications:
  - "Smart mode: 3 warnings detected" (on detail→smart switch)
  - "Stacked Container 2 on Container 1" (on stack action)
  - "Snapped to adjacent container" (on sticky alignment)

### 3b. Warning Panel

New component: `src/components/ui/WarningPanel.tsx`

Collapsible section at the bottom of the Sidebar (below Inspector content). Shows when `warnings.length > 0`.

Structure:
```
⚠ 3 Warnings
├─ 🔶 Safety: Unprotected edge at L1 voxel 12 (north)
├─ 🔶 Accessibility: No exit on Container 1
└─ ℹ️ Structural: Unsupported cantilever (ext north)
```

**Interactions:**
- Each warning row is hoverable — sets `hoveredWarning` in store, drives 3D overlay highlight
- Click a warning → selects the container and scrolls to the relevant voxel in the 2D grid
- Grouped by category (Safety, Accessibility, Weather, Structural, Budget) with counts
- Categories collapse independently
- Badge count on the section header

### 3c. Smart/Manual Mode Toggle

Segmented toggle in the toolbar alongside existing Floor/Roof/Frame buttons:

```
[Smart] [Manual]
```

When switching manual → smart:
1. Validation runs immediately
2. If warnings exist, sonner toast: "Smart mode active — N design warnings found"
3. Warning panel auto-expands in sidebar

### 3d. Stack Button in Context Menu (Bug #1)

Extend existing `ContainerContextMenu.tsx`:
- New "Stack Container" menu item
- Only shown when a suitable base container exists (position overlap with `findContainerBelow`)
- Calls `stackContainer(selectedId, targetId)`
- Sonner toast on success

---

## Stream 4: 3D Rendering

### 4a. View Isolation Wiring

Connect `getViewOpacity()` from `src/utils/viewIsolation.ts` to actual material rendering.

**ContainerSkin.tsx** — voxel face materials:
- When rendering each face, call `getViewOpacity(elementType, inspectorView, frameMode)` to get target opacity
- `top` faces → `'ceiling-face'`, `bottom` faces → `'floor-face'`, wall faces → inherit from active inspectorView
- Faded geometry gets `raycast={() => {}}` — only full-opacity geometry is interactive
- Material caching: extend existing `materialCache` pattern with opacity variants. Use `getMaterial(surfaceType, opacity)` that returns a cached clone with adjusted opacity. Do NOT create new materials per frame.

**ContainerFrame** (posts + rails):
- Frame elements use `getViewOpacity('frame', inspectorView, frameMode)` for opacity
- Already partially working via frameHoverMat/frameSelectMat — add the background opacity path

### 4b. Warning Overlays in 3D

New component: `src/components/three/WarningOverlay.tsx`

Reuses the `DebugOverlay.tsx` pattern — separate `<group>` mounted conditionally.

**Rendering:**
- Orange wireframe boxes around affected voxels (safety warnings)
- Red wireframe for structural warnings
- Yellow wireframe for info-level warnings
- Pulsing opacity (0.3–0.6 range via `useFrame` + `Math.sin`)

**Materials:** Three shared `LineBasicMaterial` singletons, same pattern as DebugOverlay's module-level materials. `depthTest: false` for always-visible.

**Hover from Warning Panel:** When `hoveredWarning` is set, the corresponding 3D wireframe increases opacity to 0.8. Uses store subscription.

**Performance:**
- Only mounted when `warnings.length > 0`
- Reuses `getEdges()` cache from DebugOverlay (move to shared utility if needed)
- `raycast={() => {}}` on all warning meshes
- `invalidate()` on warning hover changes (demand-mode rendering)

### 4c. WI-1: Bay Group Wall Hover in 3D

Complete the missing 3D side of wall-side bay group hover:

In `HoverHighlight.tsx` or `ContainerMesh.tsx`:
- When `hoveredBayGroup` is set AND `hoveredVoxelEdge` has a wall face direction
- Compute merged AABB of all bay group voxels along the hovered side
- Render a single wall-face overlay at that AABB's face (amber highlight)
- Replaces single-voxel wall highlight with bay-width highlight in Simple mode
- Uses existing highlight color constants from `highlightColors.ts`

### 4d. Phase 7: Stair Collision Ramps (WalkthroughControls)

**Current state:** WalkthroughControls.tsx already handles surface-aware collisions:
- `Open` → passable (no collision box) ✅
- `Door` → conditional on `openFaces` ✅
- `Railing_Cable`/`Railing_Glass` → 1.0m height collision ✅
- Windows → solid wall (default behavior) ✅

**Gap: Stair slope ramps.** Currently stair voxels produce flat collision boxes.

**Fix:** In the wallBoxes generation loop (lines 400-481):
- Detect `stairPart === 'lower'` or `'upper'` on the voxel
- Instead of a flat floor surface, emit a stepped approximation:
  - Lower stair voxel: floor at 0.0m (entry) stepping up to 0.5m (midpoint)
  - Upper stair voxel: floor at 0.5m (midpoint) stepping up to full voxel height
- Use the stair ascending direction (derive from `stairPart` on adjacent voxels + `_smartStairChanges.changedFaces` keys which encode the face direction) to orient steps
- The existing `maxStepUp = 1.0` already supports walking up 1m steps
- Two-step approximation per voxel pair = 4 total steps over the staircase

**Note:** Extends WalkthroughControls.tsx (does NOT rewrite). Modifying only the collision mesh generation section within the existing `useMemo` that computes `wallBoxes`/`floorSurfaces`.

**Deferred to next session:** Smooth continuous ramp collision (requires more complex geometry than Box3 AABB). The stepped approach is functional and compatible with the existing maxStepUp constraint. Document this in the spec for the next chat context.

---

## Implementation Order & Dependencies

```
Stream 1: Store & Data Model ──────────────────────────┐
  ├─ 1a. Manual mode toggle (uiSlice)                   │
  ├─ 1b. Warning state + DesignWarning type             │
  ├─ 1c. Bug #2: Partial-overlap merge fix              │
  └─ 1d. Verify bugs #1,#3,#4 (already fixed)          │
                                                        │
Stream 2: Validation Engine ────────────────────────────┤
  ├─ 2a. validateDesign() + rule array                  │
  ├─ 2b. 7 rule functions (pure, no React)              │
  ├─ 2c. Debounced subscriber wiring                    │
  └─ 2d. Tests for each rule                            │
                                                        │
Stream 3: 2D UI ────────────────────────────────────────┤
  ├─ 3a. Install sonner + mount <Toaster />             │
  ├─ 3b. WarningPanel.tsx (sidebar)                     │
  └─ 3c. Smart/Manual toggle (toolbar)                  │
                                                        │
Stream 4: 3D Rendering ────────────────────────────────┘
  ├─ 4a. View isolation wiring (getViewOpacity)
  ├─ 4b. WarningOverlay.tsx (3D wireframes)
  ├─ 4c. WI-1: Bay group wall hover highlight
  └─ 4d. Stair collision ramp (WalkthroughControls)
```

**Dependency chain:**
- Stream 1 has no dependencies — starts first
- Stream 2 depends on `DesignWarning` type from Stream 1 (1b)
- Stream 3 depends on Stream 1 (state) and Stream 2 (warnings data)
- Stream 4 depends on Stream 1 (view isolation state) and Stream 2 (warning data)

**Parallelization opportunities:**
- Streams 1 and 2 can run in parallel once `DesignWarning` interface is defined first
- Within Stream 1: items 1a-1d are independent of each other
- Within Stream 2: individual rules are independent
- Stream 3 and Stream 4 can parallelize once dependencies land

---

## File Impact Summary

### New Files

| File | Responsibility |
|------|---------------|
| `src/types/validation.ts` | `DesignWarning` interface, `ValidationRule` type |
| `src/utils/designValidation.ts` | `validateDesign()` + 7 rule functions |
| `src/components/ui/WarningPanel.tsx` | Collapsible warning list in sidebar |
| `src/components/three/WarningOverlay.tsx` | 3D wireframe overlays for warnings |
| `src/__tests__/design-validation.test.ts` | Tests for each validation rule |
| `src/__tests__/manual-mode.test.ts` | Tests for Smart/Manual toggle behavior |
| `src/__tests__/merge-overlap.test.ts` | Tests for partial-overlap merge fix (Bug #2) |

### Modified Files

| File | Changes |
|------|---------|
| `src/store/slices/uiSlice.ts` | `designMode`, `warnings`, `hoveredWarning` state + actions |
| `src/store/slices/containerSlice.ts` | `refreshAdjacency` Step 3 partial-overlap merge fix |
| `src/store/slices/voxelSlice.ts` | `designMode` guard on `recomputeSmartRailings` (5 call sites), stair entry wall clearing |
| `src/components/ui/TopToolbar.tsx` | Smart/Manual toggle buttons |
| `src/components/ui/Sidebar.tsx` | Mount WarningPanel section |
| `src/components/objects/ContainerSkin.tsx` | View isolation opacity wiring |
| `src/components/three/ContainerMesh.tsx` | Bay group wall hover highlight |
| `src/components/three/WalkthroughControls.tsx` | Stair collision ramp generation (extend only, not rewrite) |
| `src/components/three/Scene.tsx` | Mount WarningOverlay, ValidationSubscriber; already has Shift handling |
| `package.json` | Add `sonner` dependency |
| `src/app/layout.tsx` (or root) | Mount `<Toaster />` |

### Existing Files Reused (Not Modified)

| File | Reused For |
|------|-----------|
| `src/utils/viewIsolation.ts` | `getViewOpacity()` — already written and tested |
| `src/utils/adjacencyDetection.ts` | AABB math for per-voxel overlap (Bug #2) |
| `src/config/highlightColors.ts` | Warning overlay colors |
| `src/components/three/DebugOverlay.tsx` | Pattern reference for WarningOverlay |
| `src/utils/smartPoles.ts` | Used by cantilever check (pole positions) |
| `src/config/bayGroups.ts` | Bay group data for WI-1 wall hover |

---

## Persistence & Undo

| Field | Persisted | Temporal (undo) | Notes |
|-------|-----------|-----------------|-------|
| `designMode` | No (ephemeral) | No | UI preference, resets to 'smart' on reload |
| `warnings` | No (ephemeral) | No | Recomputed from container state |
| `hoveredWarning` | No (ephemeral) | No | Transient hover state |

No new persisted fields. All new state is ephemeral UI state.

**Selector stability note:** `warnings: DesignWarning[]` produces a new array reference on every recomputation. Consumers must use `useShallow()` or compare by content to avoid infinite re-render loops (per MEMORY.md selector-stability rules).

**Demand-mode invalidation:** `designMode` and `hoveredWarning` changes affect 3D appearance and need `invalidate()`. Wire these into the existing `StoreInvalidator` pattern in `Scene.tsx`.

---

## Scope Exclusions

- Smooth continuous ramp collision for stairs (deferred — stepped approximation ships first)
- Auto-fix on manual→smart switch (warns only, does not auto-modify)
- Multi-select of frame elements (deferred from Phase 2)
- Budget threshold UI (budget rule exists but threshold is passed programmatically, no UI input)
- Cross-container gravity validation (Phase 6 checks within stacked pairs only, not arbitrary arrangements)
- Walkthrough collision for furniture/module meshes (furniture collision deferred entirely)

---

## Phase 7 Documentation (For Next Session)

Phase 7 (Surface-Aware Walkthrough Collisions) is **~95% already implemented** in `WalkthroughControls.tsx`:

| Surface | Collision Behavior | Status |
|---------|-------------------|--------|
| `Open` | No collision (passable) | ✅ Done |
| `Door` | Conditional on `openFaces` toggle | ✅ Done |
| `Railing_Cable` | 1.0m height collision | ✅ Done |
| `Railing_Glass` | 1.0m height collision | ✅ Done |
| `Solid_Steel` | Full-height collision | ✅ Done |
| All other solids | Full-height collision | ✅ Done |
| Windows | Solid wall (correct) | ✅ Done |
| Stair voxels | Stepped approximation (2 steps/voxel) | 🔧 This sprint |
| Stair voxels | Smooth continuous ramp | ❌ Deferred |

**Deferred work for next session:**
- Replace 2-step approximation with smooth ramp geometry (requires custom geometry, not Box3)
- Furniture collision meshes (GLB bounding boxes as walkthrough obstacles)
- Dynamic door open/close during walkthrough (currently only checks initial state)
