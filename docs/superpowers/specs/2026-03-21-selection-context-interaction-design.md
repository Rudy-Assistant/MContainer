# Selection → Context → Action Interaction Model

**Date:** 2026-03-21
**Status:** Design
**Scope:** Unified selection context that drives hotbar auto-switching, wall selection highlights, preset cycle order, and smart warning actions.

---

## Problem Statement

Five interconnected interaction issues degrade the Sims/Valheim-style workflow:

1. Selecting a voxel shows Materials (or whatever tab was last active) instead of configuration presets
2. Selecting a wall highlights the whole voxel — no persistent wall-specific selection indicator
3. Double-click cycle order starts with Deck instead of Floor
4. Smart warnings are too prominent (full inline list), contain false positives, and clicking one doesn't guide the user toward a solution
5. Simple mode bay groups must be treated as single units in the selection context

## Architecture Overview

A derived `SelectionTarget` discriminated union computed from existing store state (`selectedVoxel`, `selectedFace`, `selectedVoxels`, `designComplexity`). A `useHotbarAutoSwitch()` hook reads this context and calls `setActiveHotbarTab()` when the target *type* changes. No new store slices — this is a derivation layer on top of existing selection state.

Future-proofing: any future context panel (Approach B — replacing tabs with context-aware panels) reads the same `SelectionTarget` interface. Only the UI consumer changes.

---

## 1. Selection Context Model

### SelectionTarget Type

```typescript
type SelectionTarget =
  | { type: 'none' }
  | { type: 'container'; containerId: string }
  | { type: 'voxel'; containerId: string; index: number }
  | { type: 'bay'; containerId: string; indices: number[]; bayId: string }
  | { type: 'face'; containerId: string; index: number; face: FaceKey }
  | { type: 'bay-face'; containerId: string; indices: number[]; bayId: string; face: FaceKey }
```

**Naming note:** The store already has a `selectionContext` field in `selectionSlice.ts` (holds subPart/wall info for drag operations). To avoid collision, the hook is named `useSelectionTarget()` and the derivation function is `deriveSelectionTarget()`. The existing `selectionContext` store field is unrelated and unchanged.

### Derivation Logic

Pure function, no side effects. Computed from existing store state.

**Priority order** (first match wins): `selectedVoxels` > `selectedVoxel` > `selection` (container) > none. The `setSelectedVoxel` and `setSelectedVoxels` actions are mutually exclusive (each clears the other), so at most one is non-null.

```
deriveSelectionTarget(state):
  // Bay group selection (Simple mode multi-voxel)
  if state.selectedVoxels:
    const cid = state.selectedVoxels.containerId
    const indices = state.selectedVoxels.indices
    const bayId = getBayGroupForVoxel(indices[0])?.id ?? 'unknown'
    if state.selectedFace:
      return { type: 'bay-face', containerId: cid, indices, bayId, face: state.selectedFace }
    return { type: 'bay', containerId: cid, indices, bayId }

  // Single voxel selection (Detail mode, or Simple mode single-voxel bay like corners)
  // VoxelPayload = VoxelRef | VoxelExtRef (discriminated by isExtension)
  // VoxelRef: { containerId, index, isExtension?: undefined }
  // VoxelExtRef: { containerId, isExtension: true, col, row } — no `index` field
  if state.selectedVoxel:
    const sv = state.selectedVoxel
    if sv.isExtension:
      // Extension voxels use col/row, not index. Convert to grid index for context.
      const idx = sv.row * VOXEL_COLS + sv.col
      const cid = sv.containerId
      if state.selectedFace:
        return { type: 'face', containerId: cid, index: idx, face: state.selectedFace }
      return { type: 'voxel', containerId: cid, index: idx }
    else:
      const cid = sv.containerId
      const idx = sv.index
      if state.selectedFace:
        return { type: 'face', containerId: cid, index: idx, face: state.selectedFace }
      return { type: 'voxel', containerId: cid, index: idx }

  // Container-level selection
  if state.selection.length > 0:
    return { type: 'container', containerId: state.selection[0] }

  return { type: 'none' }
```

**Extension voxel handling:** `VoxelPayload` is a discriminated union (`VoxelRef | VoxelExtRef`). `VoxelExtRef` has `col`/`row` instead of `index`. The derivation converts extension coordinates to a grid index (`row * VOXEL_COLS + col`) so `SelectionTarget` always provides a flat `index`. All downstream consumers (highlight rendering, hotbar switching, paint application) already work with grid indices.

**Note:** `selectedVoxels` is checked regardless of `designComplexity`. In Simple mode, bay clicks set `selectedVoxels`; in Detail mode, shift-click multi-select also sets `selectedVoxels`. Both produce `'bay'`/`'bay-face'` targets — the hotbar mapping is the same. The `getBayGroupForVoxel` function is imported from `src/config/bayGroups.ts` (takes a single index, returns the bay group containing it).

### Selector Stability

Exposed as `useSelectionTarget()` hook. The derivation returns a new object each call, so the hook uses a custom equality function that compares `type` + `containerId` + `index`/`indices` + `face` + `bayId`. For `indices` arrays, compare by length + first/last element (bay groups are always the same set of indices for a given bayId, so this is sufficient without deep comparison).

### File Location

- `src/hooks/useSelectionTarget.ts` — hook + type + derivation function

---

## 2. Wall Selection Highlight

### Problem

Hovering a wall edge shows an orange face overlay (HoverHighlight), but selecting only shows a whole-voxel cyan wireframe. The wall-specific visual disappears when the mouse moves away.

### Solution

Add a persistent cyan face overlay for selected faces, mirroring the hover system:

- **Color:** Cyan `#00bcd4` at opacity 0.3 (matching `HIGHLIGHT_COLOR_SELECT`)
- **Geometry:** Same plane geometry as the hover orange overlay — a quad positioned on the selected face
- **Persistence:** Stays until the user selects something else or presses Escape
- **Mutual exclusion:** When a face is selected, show the face overlay INSTEAD of the whole-voxel wireframe (don't show both). When only a voxel is selected (no face), keep the existing whole-voxel wireframe.

### Simple Mode Bay-Face

When a bay's wall is selected in Simple mode, the cyan overlay spans the full bay edge. For example, selecting the north wall of body_0 renders a single merged cyan plane covering all constituent voxels' north faces, not separate overlays per voxel.

The merged face overlay covers only **active** voxels in the bay group. If some bay voxels are inactive (e.g., set to Empty), those voxels are excluded from the plane — the overlay may have gaps.

### 2D BlockGrid Sync

The selected face's edge in the SVG grid gets a persistent cyan border/stroke, matching the existing hover-yellow → selection-cyan pattern.

### Files Modified

- `src/components/three/ContainerMesh.tsx` — VoxelHoverHighlight: add face overlay for `selectedFace` state
- `src/components/ui/BlockGrid.tsx` — SVG edge indicator for selected face (persistent cyan)

---

## 3. Hotbar Auto-Switch

### Problem

`activeHotbarTab` auto-switch was removed in Sprint 15b ("user manually controls tab; stays stable"). The hotbar stays on whatever tab the user last chose, regardless of selection context.

### Solution

Re-introduce auto-switch, driven by `SelectionTarget.type` transitions only (not every selection change).

### Hook: `useHotbarAutoSwitch()`

Mounted once in SmartHotbar.tsx. Subscribes to the derived selection context.

```
prevType = null
onSelectionContextChange(ctx):
  if ctx.type === prevType → skip (same category, different element)
  if ctx.type === 'none' → skip (deselection doesn't disrupt)

  mapping:
    'container' → setActiveHotbarTab(0)   // Rooms
    'voxel' | 'bay' → setActiveHotbarTab(1)   // Surfaces (configurations)
    'face' | 'bay-face' → setActiveHotbarTab(2)   // Materials

  prevType = ctx.type
```

### Key Behaviors

- **Type transition:** Switching from voxel→wall auto-switches Surfaces→Materials. Wall→voxel switches back.
- **Same type:** Clicking a different voxel (same type) does NOT re-trigger. Tab stays.
- **Deselection:** Pressing Escape or clicking background does NOT switch. Hotbar stays where it is.
- **Manual override:** User can manually switch tabs. Next type-change from selection overrides.
- **Always auto-switch:** Every selection type change updates the hotbar. No sticky/lock behavior.

### Materials Tab Filtering

When auto-switched to Materials (2) via face selection, filter displayed items by face category. The existing `MATERIAL_SWATCHES` in SmartHotbar uses a `group` field with values `'wall' | 'floor' | 'window' | 'special'`. The filter maps `selectedFace` to allowed groups:

| Selected Face | Swatch Groups Shown | Notes |
|---|---|---|
| Wall (n/s/e/w) | `'wall'` + `'window'` + `'special'` (minus stairs) | Includes theme materials (Hinoki, Shoji, etc.) that have group='wall' |
| Floor (bottom) | `'floor'` + explicit `Open` | Includes theme floor materials (Tatami, etc.) |
| Ceiling (top) | Filter by SurfaceType: `Solid_Steel`, `Open` only | No swatch group exists for ceiling — filter by specific surface types |

This is a display filter in SmartHotbar — not a store change. The `selectedFace` value determines which filter. When no face is selected (voxel/bay target), show all swatches unfiltered.

**Implementation:** Add a `getVisibleSwatches(selectedFace: FaceKey | null): MaterialSwatch[]` function in SmartHotbar that filters `MATERIAL_SWATCHES` based on the mapping above.

### What Sprint 15b Got Wrong

It removed ALL auto-switching. The problem wasn't auto-switching — it was switching on every selection change regardless of type. The fix is switching only on *type* transitions.

### Files Modified

- `src/hooks/useHotbarAutoSwitch.ts` — new hook
- `src/components/ui/SmartHotbar.tsx` — mount hook, add face-category filtering
- `src/store/slices/uiSlice.ts` — fix outdated comment on line 37 (says `0=rooms, 1=materials, 2=furniture` but actual layout confirmed in SmartHotbar.tsx lines 1475-1478: `0=Rooms, 1=Surfaces, 2=Materials, 3=Furniture`)

---

## 4. Double-Click Cycle Order

### Problem

`BLOCK_PRESETS` order: `[Deck, Default, Floor+Ceil, Floor+Ceil+Rail, Floor+Ceil+Glass, Sealed, Empty]`. Most voxels start as Default (index 1). When starting from a non-matching state (curIdx=-1), first advance lands on Deck (index 0) which has open walls — confusing.

### Solution

Reorder `BLOCK_PRESETS` to lead with floor-centric configurations:

```
[0] Floor+Ceil       — open walls, wood floor, steel ceiling
[1] Floor+Ceil+Rail  — adds railing
[2] Floor+Ceil+Glass — adds glass walls
[3] Deck             — open top, wood bottom
[4] Default          — steel walls + floor + ceiling (starting state)
[5] Empty            — inactive
```

**Note:** "Sealed" has been merged into "Default" — they had identical face definitions (all Solid_Steel walls + steel top + wood bottom). With identical faces, `findIndex` in `cycleBlockPreset` always matched the first one, making the second unreachable. If a distinct "Sealed" is needed later (e.g., steel bottom instead of wood), it can be re-added as a differentiated entry.

### Rationale

The most common editing action is opening up a bay (removing walls while keeping floor/ceiling). Floor+Ceil first means one double-click from Default gets there. The progression adds enclosure: railing → glass → deck → sealed. Default (starting state) is near the end — you rarely cycle back to it.

When `curIdx=-1` (no match), first advance lands on Floor+Ceil, matching user expectation.

### Files Modified

- `src/store/useStore.ts` — reorder `BLOCK_PRESETS` array, merge duplicate Default/Sealed
- Update any tests that assert preset order or count

---

## 5. Smart Warnings Redesign

### 5a. Compact Toolbar Badge

Replace the inline WarningPanel in the inspector with a toolbar badge:

- **No warnings:** Badge hidden
- **Warnings present:** Small red/amber triangle icon with count (e.g., `⚠ 3`) in the toolbar
- **Click badge → popover dropdown** below toolbar (same z-index pattern as Sun slider popover)

### 5b. Warning Popover

The popover shows a compact list:

- **Category headers** (Accessibility, Structural) — collapsed by default
- **Each warning:** One line with severity icon + short message
- **Hover warning → 3D overlay** highlights affected voxels (existing WarningOverlay, no change)
- **Click warning → two actions:**
  1. Select the problem element: `setSelectedVoxel` / `setSelectedVoxels` with the warning's `voxelIndices`
  2. Guide hotbar to solution (where applicable):

| Warning Rule | Click Action |
|---|---|
| "No exit — all walls are solid" | Select first body voxel + set `selectedFace` to a solid wall → Materials filtered to Door/Sliding Glass |
| "Extension has roofing without structural support" | Select extension voxel → Surfaces (configurations) |
| "Unprotected edge" | Select the voxel + set `selectedFace` to the open wall → Materials (wall options) |
| "Stair to nowhere" | Select the stair voxel → Surfaces (configurations) — user can remove stairs or stack a container |
| "No weather envelope" | Select first voxel with open walls → Materials (wall options) |
| "Floating container — base missing" | Select the container (container-level) → no hotbar change (structural issue, not a material/surface fix) |
| "Budget exceeded" | No element selection — no hotbar change (informational only) |

**Fallback:** For any warning without a specific action mapping (including future rules), select the first affected voxel from `voxelIndices[0]` (or the container if `voxelIndices` is empty) and do not change the hotbar tab.

### 5c. Fix `checkUnsupportedCantilever` False Positive

Current rule flags ALL extension voxels with roofing as unsupported.

Fix: An extension voxel is supported if any of its inward-facing neighbors (toward the body zone) is an active voxel. The body frame provides structural support through the connection.

For corner voxels: supported if at least one adjacent extension or body voxel in either direction is active.

### Files Modified

- `src/components/ui/WarningPanel.tsx` → refactor into `WarningBadge.tsx` + `WarningPopover.tsx`
- `src/components/ui/TopToolbar.tsx` — mount WarningBadge
- `src/utils/designValidation.ts` — fix `checkUnsupportedCantilever` neighbor check
- Warning click handler: add solution-mapping logic

---

## 6. Simple/Detail Mode Interaction

The selection context model handles both modes transparently:

| Mode | Click voxel center | Click wall edge |
|---|---|---|
| **Simple** | `{ type: 'bay', indices: [...], bayId }` | `{ type: 'bay-face', indices: [...], face }` |
| **Detail** | `{ type: 'voxel', index }` | `{ type: 'face', index, face }` |

Both map to the same hotbar tabs (bay/voxel → Surfaces, bay-face/face → Materials). The distinction only matters for:

- **Highlight rendering:** Bay shows merged wireframe/face overlay; voxel shows individual
- **Paint application:** Bay paints all indices; voxel paints one (existing behavior, no change)
- **Inspector Detail View:** Still shows individual voxels within the bay for fine-tuning (no change)

Multi-voxel configurations (stairs, etc.) already ignore bay boundaries at the store level and continue to do so.

---

## Not In Scope

- Interior Finishes panel / Approach B context panels (deferred — future evolution)
- Inspector Detail View face highlight (nice-to-have, not blocking)
- New warning rules beyond the cantilever fix
- Changes to Smart/Manual mode behavior
- Changes to furniture or room assignment systems

---

## Testing Strategy

| Area | Test Type | What to Assert |
|---|---|---|
| SelectionTarget derivation | Unit test | Each type derived correctly from store state combinations |
| Auto-switch hook | Unit test | Type transitions trigger tab change; same-type doesn't; deselection doesn't |
| Face-category filter | Unit test | Wall face → wall materials; floor → floor materials |
| Cycle order | Unit test (update existing) | New preset order; curIdx=-1 advances to Floor+Ceil |
| Cantilever validation | Unit test (update existing) | Supported extension voxels not flagged; unsupported ones still flagged |
| Selector stability | Anti-pattern test | `useSelectionContext` doesn't cause infinite re-renders (useShallow) |
| Warning click → hotbar | Integration test | Click "No exit" warning → wall face selected + Materials tab + Door visible |
