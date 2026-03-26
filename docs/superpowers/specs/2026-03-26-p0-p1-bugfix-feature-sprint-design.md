# Design Spec: P0 + P1 Bugfix & Feature Sprint

**Date:** 2026-03-26
**Scope:** 3 P0 bugs + 3 P1 feature gaps from sprint-ui-polish-handoff.md
**Approach:** Bug-first (P0 sequential), then features (P1 independent)

---

## Sprint Items

| # | Priority | Item | Type |
|---|----------|------|------|
| 1 | P0 | Frame mode material reactivity | Bug |
| 2 | P0 | Frame mode view isolation (frame-only) | Bug |
| 3 | P0 | Door flush positioning | Bug |
| 4 | P1 | Wire block thumbnail previews | Feature |
| 5 | P1 | Multi-select in Block Grid | Feature |
| 6 | P1 | Grid orientation label fix | Feature |

**Dropped:** P0 #4 (debug/wireframe toggle) — already working in TopToolbar. P1 #6 (GLB models) — art pipeline blocker, not code work.

---

## 1. Frame Mode Material Reactivity

### Problem

`ContainerSkin.tsx:3451` hardcodes pole material to `mFrame` (theme default) or selection highlight material. The `poleOverride` is fetched from state but only `.visible` is checked — `.material` is ignored entirely. Same issue for rails.

### Root Cause

The rendering loop reads frame overrides but never maps material names to Three.js materials. The cascade defined in `frameMaterials.ts` (`resolveFrameProperty()`) is not called during rendering.

### Design

1. In the pole/rail rendering loop in `ContainerSkin.tsx`, after fetching `poleOverride`:
   - Call `resolveFrameProperty()` to get the resolved material name (element override > container defaults > theme default)
   - Map the resolved name (e.g., "Wood", "Concrete", "Aluminum", "Steel") to a Three.js material from `materialCache.ts`
   - Apply as the pole/rail mesh material instead of hardcoded `mFrame`
2. Selection/hover highlights still take precedence (selected = yellow, hovered = cyan)
3. Material priority: `isSelected ? frameSelectMat : isHovered ? frameHoverMat : resolvedMaterial`

### Files

- `ContainerSkin.tsx` — pole/rail rendering (lines ~3440-3490)
- `frameMaterials.ts` — `resolveFrameProperty()` (already exists)
- `materialCache.ts` — material name to Three.js material mapping (may need a lookup helper)

### Tests

- Unit test: `resolveFrameProperty` returns override > default > theme fallback
- Integration: set frame material override in store, verify ContainerSkin renders with correct material

---

## 2. Frame Mode View Isolation

### Problem

When `frameMode === true`, walls and ceilings remain fully opaque, obscuring the frame structure (poles/rails). Users cannot see or interact with the frame clearly.

### Design

When `frameMode === true`:
- **Wall faces** (north, south, east, west): **not rendered** — skip in face rendering loop
- **Ceiling faces** (top): **not rendered**
- **Floor faces** (bottom): **rendered normally** — provides spatial reference
- **Poles and rails**: **rendered at full opacity**, fully interactable

Implementation: Add early-continue in the face rendering loop in `ContainerSkin.tsx`:
```
if (frameMode && (face is wall or top)) continue;
```

No material cloning needed. This is a pure rendering skip.

### Dependency

Must be implemented after Item 1 (material reactivity) so that frame elements are visually meaningful when walls are hidden.

### Files

- `ContainerSkin.tsx` — face rendering loop

### Tests

- Verify: toggle frameMode on → wall/ceiling meshes not in scene graph
- Verify: toggle frameMode off → walls/ceilings reappear
- Verify: floor remains visible in both modes

---

## 3. Door Flush Positioning

### Problem

`DoorFace` component in `ContainerSkin.tsx:542-617` has pivot offset calculations misaligned with wall face geometry. Door panel renders slightly offset from the wall plane.

### Design

1. Audit the `DoorFace` component's group `position` prop and the door panel's pivot point
2. The door hinge should sit exactly on the wall face plane
3. When closed, the door panel should be coplanar with the wall surface
4. Adjust position offsets and rotation origins to achieve flush alignment
5. Test with all door types: single swing, double swing, sliding, pocket, barn

### Files

- `ContainerSkin.tsx` — `DoorFace` component (lines 542-617)

### Tests

- Visual verification: door closed = flush with wall plane
- Door open animation: hinge stays on wall edge

---

## 4. Wire Block Thumbnail Previews

### Problem

`BlockThumbnailRenderer.tsx` exists and renders material-accurate 128x128 PNGs for each of the 8 block presets (Floor, Window, Railing, etc.) using the current theme's PBR materials. `BlockThumbnailContext.tsx` provides `useBlockThumbnail(presetId)` hook. But `BlockTab.tsx` doesn't use them — it shows emoji icons instead.

### Design

1. Wrap BlockTab's parent (or BlockTab itself) with `<BlockThumbnailRenderer>` so the context provider is available
2. In BlockTab, for each preset card:
   - Call `useBlockThumbnail(preset.id)` to get the data URL
   - If data URL exists, pass as `content` prop to PresetCard (renders as `<img>`)
   - If null (not yet rendered), fall back to existing emoji icon
3. Thumbnails auto-regenerate on theme change (already handled by renderer's `key={key}` mechanism)

### Files

- `BlockTab.tsx` — consume thumbnails
- `BlockThumbnailRenderer.tsx` — already complete, just needs mounting
- `BlockThumbnailContext.tsx` — already complete, provides hook
- Parent component that renders BlockTab (likely `FinishesPanel.tsx`) — wrap with provider

### Tests

- Verify: BlockTab cards show material-accurate thumbnails instead of emojis
- Verify: switching theme regenerates thumbnails with new materials

---

## 5. Multi-Select in Block Grid

### Problem

MatrixEditor's block grid (`SimpleBayGrid` / `VoxelGrid`) only supports single-cell click selection. Users want Shift+Click for range select and Ctrl+Click for toggle.

### Design

1. Add `lastClickedCell` ref in MatrixEditor (persists across renders, no re-render on change)
2. **Plain click**: Single-select (existing behavior). Update `lastClickedCell`.
3. **Shift+Click**: Range select — compute rectangle from `lastClickedCell` to current cell, select all cells in range. Uses `setSelectedElements` with the full array.
4. **Ctrl+Click**: Toggle — if cell is in current selection, remove it; if not, add it. Uses `toggleElement`.
5. Works in both Simple (bay) and Detail (voxel) grid modes
6. Visual: all selected cells show the existing cyan highlight

### Data Flow

```
click handler receives (cellId, event)
  → if event.shiftKey: computeRange(lastClicked, cellId) → setSelectedElements(range)
  → if event.ctrlKey: toggleElement(cellId)
  → else: setSelectedElements([cellId]), lastClicked = cellId
```

### Files

- `MatrixEditor.tsx` — click handlers in SimpleBayGrid and VoxelGrid
- `selectionSlice.ts` — `setSelectedElements`, `toggleElement` (already exist)

### Tests

- Unit: range computation from cell A to cell B returns correct rectangle
- Integration: Shift+Click selects range, Ctrl+Click toggles individual cells

---

## 6. Grid Orientation Label Fix

### Problem

"S Deck 1" refers to the nearest-to-camera extension voxel, but users expect the nearest to be "S Deck 3". The numbering goes 1→2→3 from near to far (matching column indices), but the user's mental model has 3 = nearest.

### Design

Swap the labels in `bayGroups.ts`:
- **Before:** S Deck 1 (col 1-2, nearest) → S Deck 2 (col 3-4) → S Deck 3 (col 5-6, farthest)
- **After:** S Deck 3 (col 1-2, nearest) → S Deck 2 (col 3-4) → S Deck 1 (col 5-6, farthest)
- Same swap for N Deck labels

This is a label-only change. No index remapping, no logic changes. The FRONT/BACK labels added previously remain as additional orientation cues.

### Files

- `bayGroups.ts` — label strings only

### Tests

- Verify: nearest-to-camera extension shows "S Deck 3" / "N Deck 3" in grid
- Verify: clicking grid cell highlights correct voxel in 3D viewport

---

## Critical Invariants (from handoff)

These must not be violated during implementation:

1. **Never mutate refs inside Zustand selectors** — causes render loop crashes
2. **`selectedFace` is orthogonal to `selectedElements`** — `setSelectedElements` must NOT clear `selectedFace` unless sel is null
3. **MatrixEditor owns the spatial grid** — no grid duplication in FinishesPanel
4. **PresetCard convention** — square image area, highlight on image only, label below
5. **Zustand selectors with middleware** — no `equalityFn` 2nd arg; use `useShallow` + `useRef` dedup
6. **Floor-based hitbox paradigm** — vertical wall meshes use `raycast={nullRaycast}`

## Verification Plan

For each item:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all tests pass
3. Browser verification per item's specific checks
4. Final full walkthrough after all 6 items complete
