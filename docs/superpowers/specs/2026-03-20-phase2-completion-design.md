# Phase 2 Completion: View Toggles, Frame Mode, Bay Grid

## Summary

Complete the remaining Phase 2 Smart Architecture work by adding a Frame Mode view toggle, frame element customization (poles and rails), view isolation rendering, 2D bay mode for Simple complexity, and adjacent railing merge verification.

**Scope:** 7 work items across 3 systems (view toggles, frame interaction, bay grid).

**Dependencies:** Builds on completed Phase 2 work — smart pole algorithm (`smartPoles.ts`), auto-railing (`recomputeSmartRailings`), stair lateral railings, and existing bay group logic (`bayGroups.ts`).

**Relationship to Phase 2 spec:** This spec supersedes Work Items 1, 2, and 6 from the original Phase 2 spec (`2026-03-20-smart-architecture-phase2-design.md`). Work Items 3, 4, and 5 are already implemented. This spec consolidates the remaining items and adds the Frame Mode system (view toggles, frame interaction, frame inspector) that was not in the original Phase 2 scope.

---

## Section 1: View Toggle System

### Current State

`inspectorView: 'floor' | 'ceiling'` is a mutually exclusive pair in uiSlice. No independent Frame toggle exists. No view isolation rendering (V2 had this, V1 does not).

### New State Model

```typescript
// UI slice (ephemeral, not persisted)
inspectorView: 'floor' | 'ceiling'   // mutually exclusive pair (unchanged)
frameMode: boolean                    // independent toggle, default false
```

### Toolbar Buttons

Three buttons in the top-right area (near existing Floor/Ceiling):

- **Floor** / **Ceiling** — segmented toggle pair. One always active. Unchanged from current behavior.
- **Frame** — independent toggle button (on/off). Visually distinct from the pair (e.g., outline style when off, filled when on).

Floor/Ceiling cannot both be off — one is always active. Frame is independent of this pair.

### Effects

- `inspectorView` controls which grid level is shown in 2D and which voxel surfaces are prioritized in 3D.
- `frameMode` controls whether frame elements (posts, rails, poles) are interactive and whether voxel faces fade.
- Both are independent — any combination of `inspectorView` + `frameMode` is valid.

---

## Section 2: Frame Data Model

### Migration from Phase 2 Fields

The original Phase 2 spec defined `poleDefaults` and `poleOverrides` on `ContainerState`. These are already in `container.ts`:

```typescript
// Existing (line 190-192):
poleDefaults?: { material: string; shape: string };
poleOverrides?: Record<string, PoleConfig>;  // keyed by "l{level}r{row}c{col}_{corner}"
```

This spec **replaces** `poleDefaults` with the broader `frameDefaults` (which covers both poles and rails). The existing `poleOverrides` field is **kept** with its current key format `"l{level}r{row}c{col}_{corner}"`. A new `railOverrides` field is added alongside it.

### Container-Level Defaults

```typescript
// Replaces poleDefaults on ContainerState
frameDefaults?: {
  poleMaterial?: string;   // e.g. 'Steel', 'Wood', 'Concrete'
  poleShape?: string;      // e.g. 'Round', 'Square', 'I-Beam'
  railMaterial?: string;
  railShape?: string;
}
```

Falls back to theme defaults if unset. The existing `poleDefaults` field is removed; its `material` and `shape` migrate to `frameDefaults.poleMaterial` and `frameDefaults.poleShape`.

### Per-Element Overrides

```typescript
// Existing field, kept as-is:
poleOverrides?: Record<string, PoleConfig>   // key: "l{level}r{row}c{col}_{corner}"

// New field:
railOverrides?: Record<string, ElementConfig>  // key: "r{row}c{col}_{orientation}"
```

`PoleConfig` already exists in `container.ts` (lines 317-324):

```typescript
interface PoleConfig {
  visible?: boolean;
  material?: string;
  shape?: string;
}
```

`ElementConfig` is the rail equivalent (identical shape):

```typescript
interface ElementConfig {
  visible?: boolean;
  material?: string;
  shape?: string;
}
```

Material and shape are separate properties on both poles and rails.

### Key Conventions

- **Poles:** `"l{level}r{row}c{col}_{corner}"` (existing format from Phase 2 spec). Level = container level (0 for single-story). Corner = `ne`, `nw`, `se`, `sw`. Example: `"l0r1c2_ne"`. This matches the `PolePosition` output from `computePolePositions` which returns `{ row, col, corner }`.
- **Rails:** `"r{row}c{col}_{orientation}"` (new). Orientation: `h` (horizontal rail along a row boundary) or `v` (vertical rail along a column boundary).
  - `h` rails exist at row boundaries 0 through VOXEL_ROWS (5 horizontal lines for a 4-row grid). `"r{vr}c{col}_h"` is the horizontal rail segment at vertex row `vr`, spanning from column `col` to `col+1`. Range: vr 0..4, col 0..7.
  - `v` rails exist at column boundaries 0 through VOXEL_COLS (9 vertical lines for an 8-col grid). `"r{row}c{vc}_v"` is the vertical rail segment at vertex col `vc`, spanning from row `row` to `row+1`. Range: row 0..3, vc 0..8.

### Override Resolution

Element override -> `frameDefaults` -> theme default.

### Store Actions

On containerSlice (container-level mutations):

- `setFrameDefaults(containerId, defaults)` — set container-level defaults.
- `setFrameElementOverride(containerId, key, config)` — set one pole or rail override. Key prefix (`l` for poles, `r` for rails) determines which map to update.
- `clearFrameElementOverride(containerId, key)` — remove override, revert to default.
- `batchSetFrameOverrides(containerId, keys[], config)` — apply same config to multiple elements.

### Persistence

`frameDefaults`, `poleOverrides`, `railOverrides` are persisted (user intent, not computed state). Undo/redo works automatically via temporal snapshots.

### Initial Material/Shape Registries

New file `src/config/frameMaterials.ts`:

```typescript
export const POLE_MATERIALS = ['Steel', 'Wood', 'Concrete', 'Aluminum'] as const;
export const POLE_SHAPES = ['Round', 'Square', 'I-Beam', 'H-Beam'] as const;
export const RAIL_MATERIALS = ['Steel', 'Wood', 'Aluminum'] as const;
export const RAIL_SHAPES = ['Round', 'Square', 'Channel'] as const;
```

These are the initial sets. Additional entries can be added later without architectural changes.

---

## Section 3: Frame Mode 3D Interaction

### Rendering When `frameMode === true`

- Voxel face meshes: ~10% opacity, `depthWrite: false`, `raycast={() => {}}`. Translucent ghosts.
- Container frame posts + perimeter rails: full opacity, raycast enabled.
- Smart poles: full opacity, raycast enabled.
- Ground, sky, lighting: unchanged.

### Hover Behavior

- Hovering a rail segment: amber highlight (`#ffcc00`), matching existing hover convention.
- Hovering a pole: same amber highlight.
- No voxel face hover — hitboxes disabled.

### Selection Behavior

- Clicking a rail or pole selects it (cyan `#00bcd4`).
- New UI state: `selectedFrameElement: { containerId: string; key: string; type: 'pole' | 'rail' } | null` in UI slice (ephemeral). The `type` field avoids fragile key-string parsing in the Inspector.
- Clicking empty space deselects.
- Single element selection only (multi-select deferred).

### Geometry for Interaction

Container frame rendering is done via **individual `<mesh>` elements in `ContainerMesh.tsx`** (lines 1759-1800 for corner posts, lines 655+ for rail segments). These are NOT InstancedMesh. In Frame Mode:

- Each post/rail `<mesh>` gets `onPointerOver`/`onPointerOut`/`onClick` handlers (only when `frameMode === true`).
- Poles render individually from `pillarPositions` in `ContainerSkin.tsx`. They need raycast enabled when `frameMode` is on.
- When `frameMode === false`, frame meshes have `raycast={() => {}}` to avoid intercepting voxel clicks.

### Floor/Ceiling in Frame Mode

The Floor/Ceiling toggle controls which horizontal plane of rails is interactive:
- Floor: bottom-level rails and poles hoverable/selectable.
- Ceiling: top-level rails and poles.

### Demand-Mode Rendering

The project uses `frameloop="demand"` on the Canvas. All frame hover/select interactions and view toggle changes must call `invalidate()` to trigger re-render. This follows the existing `StoreInvalidator` pattern — subscribe to `frameMode` and `selectedFrameElement` changes.

---

## Section 4: Frame Mode 2D Container Grid

### Grid Transformation

When `frameMode === true`, the 2D Container Grid becomes a frame diagram:

- Cell interiors: de-emphasized (light fill, no material color). Grid lines are the interactive elements.
- **Edge segments (rails):** Each edge between two cells is a hoverable/clickable rail target. Hover = amber highlight. Click = select rail, populate Inspector.
- **Intersection points (poles):** Each vertex where grid lines meet is a hoverable/clickable pole target. Rendered as a small dot/circle. Hover = amber. Click = select pole.

### Visual Feedback

- Selected rail: cyan edge (thicker stroke).
- Selected pole: cyan filled circle at intersection.
- Hidden elements (`visible: false`): dashed/dimmed stroke for rails, hollow circle for poles.
- Custom material: subtle color tint or icon badge.

### Floor/Ceiling in 2D Frame Mode

The Floor/Ceiling toggle determines which level's rails and poles are shown. Same as 3D.

### Click Target Sizing

- Rail edge hit targets: ~8px wide strip along each grid edge.
- Pole intersection targets: ~12px diameter circle at each vertex.
- Invisible hit areas layered over visual grid lines.

### designComplexity Interaction

Frame Mode always shows the full grid (all vertices and edges), regardless of `designComplexity`. The bay grouping is a voxel-level concept; the frame grid is always the same 4x8 structural skeleton. When `frameMode === true`, `designComplexity` has no effect on the 2D grid.

---

## Section 5: Frame Inspector Preview

### Element Detail View

When `selectedFrameElement` is set, the Inspector preview area replaces the voxel preview:

**For a selected Pole:**
- Preview: 2D icon representing the pole shape/material (3D mini-preview deferred).
- **Visibility:** toggle switch (show/hide).
- **Material:** dropdown (sourced from `POLE_MATERIALS` registry).
- **Shape:** dropdown (sourced from `POLE_SHAPES` registry).
- **Label:** auto-generated, e.g. "Pole at R1 C2".
- **Reset button:** clears override, reverts to container default.

**For a selected Rail:**
- Same layout: visibility toggle, material dropdown (`RAIL_MATERIALS`), shape dropdown (`RAIL_SHAPES`), label (e.g. "Rail R1 C2 horizontal"), reset button.

### Container-Level Defaults

Below element detail (or accessible via "Frame Settings" sub-section):
- Pole material default, pole shape default.
- Rail material default, rail shape default.
- Changing a default affects all elements without per-element overrides.

### When Nothing Selected in Frame Mode

Inspector shows the container-level frame defaults panel directly — 4 dropdowns (pole material, pole shape, rail material, rail shape).

---

## Section 6: View Isolation Rendering

### Principle

Each active toggle "owns" its geometry at full opacity. Non-owned geometry fades. This is the V2 behavior missing from V1.

### Toggle Model

Floor/Ceiling is a mutually exclusive pair — one is always active. Frame is an independent boolean. This gives 4 reachable states:

| inspectorView | frameMode | Voxel Faces | Frame Elements |
|---------------|-----------|-------------|----------------|
| floor | OFF | Floor full, ceiling ~15% | ~30% |
| ceiling | OFF | Ceiling full, floor ~15% | ~30% |
| floor | ON | Floor ~40% | Full |
| ceiling | ON | Ceiling ~40% | Full |

The default state is `inspectorView: 'floor', frameMode: false` — floor faces at full, ceiling faded, frame at background opacity. This matches the current default behavior.

### Implementation

- Extend the existing `levelTier` system in `GlobalVoxelMeshes` with view-toggle-based opacity.
- Opacity values are tunable constants. A pure function `getViewOpacity(elementType, inspectorView, frameMode)` returns the opacity.
- Faded geometry has `raycast={() => {}}` — only full-opacity geometry is interactive.

---

## Section 7: 2D Bay Mode and Merge Verification

This section consolidates Work Items 1, 2, and 6 from the original Phase 2 spec. The requirements are brought forward here for completeness; they are not new.

### Bay Mode in Simple (WI-1/WI-2)

When `designComplexity === 'simple'` and `frameMode === false`, the Container Grid renders 15 bay cells instead of 32 voxel cells.

- Uses existing `computeBayGroups()` from `bayGroups.ts`.
- Each bay cell spans `gridRow/gridCol/rowSpan/colSpan` in a CSS Grid layout.
- Cell shows dominant surface type (most common material across the bay's voxels).
- Click bay interior: selects the bay (all voxel indices into `selectedVoxels`).
- Click bay edge: selects the bay's wall face for painting.
- Bay labels from existing `BayGroup.label` field.

When a bay is selected, the Inspector voxel preview shows individual voxel breakdown within that bay for fine-tuning without switching to Detail mode.

### Adjacent Railing Merge Verification (WI-6)

Test-only work. No new production code expected. Verification that existing autotiling works:

- Cross-bay railing connections: bay group painting applies to all voxels; adjacent bays' railings connect and suppress duplicate posts.
- Auto-railing connections: adjacent fall-hazard voxels from `recomputeSmartRailings` connect seamlessly.
- Mixed railing types: Cable next to Glass should NOT suppress end posts (different types keep their own posts).

If tests reveal issues, targeted fixes to existing autotiling logic.

---

## Scope Exclusions

- Multi-select of frame elements (deferred).
- Corinthian column / context-aware shape rules (future smart rules phase).
- Railing customization via Frame Mode (railings are wall-type face treatments, not frame elements).
- Per-level frame overrides (frame overrides are per-container, not per-level).
- 3D mini-preview for poles/rails in Inspector (2D icon fallback acceptable for this phase).

---

## File Impact Summary

### New Files
- `src/config/frameMaterials.ts` — `POLE_MATERIALS`, `POLE_SHAPES`, `RAIL_MATERIALS`, `RAIL_SHAPES` registries.
- `src/components/ui/FrameInspector.tsx` — Inspector panel content for frame element detail + container defaults.

### Modified Files
- `src/types/container.ts` — `ElementConfig` interface, `frameDefaults` (replaces `poleDefaults`), `railOverrides` on ContainerState. `poleOverrides` and `PoleConfig` already exist.
- `src/store/slices/containerSlice.ts` — `setFrameDefaults`, `setFrameElementOverride`, `clearFrameElementOverride`, `batchSetFrameOverrides`.
- `src/store/slices/uiSlice.ts` — `frameMode: boolean`, `selectedFrameElement: { containerId, key, type } | null`.
- `src/components/ui/Toolbar.tsx` (or equivalent) — Frame toggle button.
- `src/components/ui/InspectorPanel.tsx` — Route to `FrameInspector` when `frameMode && selectedFrameElement`.
- `src/components/ui/MatrixEditor.tsx` — Frame Mode grid (edges + intersections as SVG hit targets), Bay Mode grid (15 cells in CSS Grid).
- `src/components/three/ContainerMesh.tsx` — Frame element hover/select handlers (individual `<mesh>` elements for posts/rails), raycast toggling based on `frameMode`.
- `src/components/objects/ContainerSkin.tsx` — View isolation opacity, pole raycast toggling, `pillarPositions` override lookup.
- `src/store/useStore.ts` — Persist `frameDefaults`, `railOverrides` (poleOverrides already persisted). Add `frameMode`/`selectedFrameElement` to `StoreInvalidator`.

### Test Files
- `src/__tests__/frame-mode.test.ts` — Frame data model, override resolution, store actions, poleDefaults migration.
- `src/__tests__/view-isolation.test.ts` — Opacity calculation for all toggle combinations.
- `src/__tests__/bay-mode.test.ts` — Bay cell rendering, selection, painting.
- `src/__tests__/railing-merge.test.ts` — Cross-bay connections, mixed types, auto-railing adjacency.
