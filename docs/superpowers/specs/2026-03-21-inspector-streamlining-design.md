# Inspector Panel Streamlining — Design Spec

**Date:** 2026-03-21
**Origin:** Browser review after UX Fixes sprint (553 tests, 11 commits)

## Summary

Four inspector panel improvements: semi-transparent frame in wall-cut modes, global roof/skin toggles, room dropdown removal, and a unified face editor replacing three separate components.

---

## Issue 1: Frame Semi-Transparent in Half/Down Wall Modes

### Problem
`FramePosts` scales post height down with `wallCutMode`. `FrameBeams` hides top beams entirely when walls aren't full. This removes structural orientation cues that help the user work inside containers.

### Solution
- **Posts:** Always render at full height. When `wallCutMode` is `'half'` or `'down'`, set material opacity to ~0.3 and `transparent: true`.
- **Top beams:** Always render (remove the `hideTopBeams` filter). Same semi-transparent treatment when walls are cut.
- **Bottom beams:** Unchanged — always visible, always opaque.

### Implementation
In `ContainerMesh.tsx`:
- `FramePosts` (line ~1759): Remove `cutScale` height calculation. Posts always use `dims.height`. Add opacity logic keyed on `wallCutMode !== 'full'`.
- `FrameBeams` (line ~1816): Remove `hideTopBeams` filter so top beams always render. Add same opacity logic.
- Material: Use `material.opacity = 0.3` + `material.transparent = true` via ref or conditional material variant. Avoid creating new meshes.

### Files
- `src/components/three/ContainerMesh.tsx` — FramePosts, FrameBeams functions

---

## Issue 2: Hide Roof / Hide Skin → Global Toolbar

### Problem
`hideRoof` and `hideSkin` are `useState` inside IsoEditor.tsx. They only affect the mini preview canvas, not the main 3D scene. User expects them to be global controls.

### Solution
1. Add `hideRoof: boolean` and `hideSkin: boolean` to `uiSlice.ts` as ephemeral store state with `toggleHideRoof` and `toggleHideSkin` actions.
2. Add two toggle buttons to `TopToolbar.tsx` Zone C, next to the wall visibility pill (`▮ ▄ ▁`). Same compact styling as the existing Frame button — highlighted when active.
3. `ContainerSkin.tsx` reads `hideRoof`/`hideSkin` from store. When `hideRoof` is true, skip rendering top faces. When `hideSkin` is true, skip rendering all voxel faces (same as existing per-container hideSkin but global).
4. `IsoEditor.tsx` removes local `hideRoof`/`hideSkin` state and `LayerBtn` controls. Reads from store instead.

### Toolbar Layout
```
[Floor|Roof] [Frame] [▮ ▄ ▁] [Roof] [Skin]
```

### Files
- `src/store/slices/uiSlice.ts` — add hideRoof, hideSkin, toggleHideRoof, toggleHideSkin
- `src/components/ui/TopToolbar.tsx` — add two toggle buttons
- `src/components/objects/ContainerSkin.tsx` — read global hideRoof/hideSkin
- `src/components/ui/IsoEditor.tsx` — remove local state, remove LayerBtn controls, read from store

---

## Issue 3: Remove Room Dropdown

### Problem
Room dropdown in the tile detail section assigns room tags to voxels but has no visible effect. UI clutter.

### Solution
Remove the `<select>` element and its wrapper `<div>` from `MatrixEditor.tsx` (lines ~1232-1264). The `setVoxelRoomTag` store action remains for API consumers.

### Files
- `src/components/ui/MatrixEditor.tsx` — remove Room Tag JSX block

---

## Issue 4: Unified Face Editor (Face Strip)

### Problem
The tile detail area has redundant headers ("N TILES" + "N BLOCKS SELECTED"), a useless Room dropdown, and three completely different components for the same task (editing voxel faces): FaceSchematic (single-select compass layout), BatchFaceControls (multi-select category rows), and 3D Preview toggle with VoxelPreview3D.

### Solution
Replace all three with a single `FaceStrip` component.

### Component: FaceStrip.tsx

**Props:** `containerId: string`, `indices: number[]` (works for 1 or N voxels)

**Layout:**
```
┌─────────────────────────────────────────┐
│ [N·Stl] [S·Stl] [E·Cbl] [W·Cbl]       │
│ [Top·Stl] [Bot·Wod]             4 sel  │
│─────────────────────────────────────────│
│ ▼ S FACE · Solid Steel                  │
│  [Steel] [Glass] [Window] [Wood]        │
│  [Railing] [Open]                       │
│                                         │
│  All walls: [Steel] [Glass] [Open]      │
│  All floors: [Wood] [Concrete] [Open]   │
│  All ceilings: [Steel] [Open]           │
└─────────────────────────────────────────┘
```

**Face buttons (top rows):**
- 6 buttons, filled with `SURFACE_COLORS[material]`
- Label: abbreviated face + short material (e.g. "N·Stl")
- Single select: exact material per face
- Multi select: material if unanimous, "Mix" with striped fill if voxels differ
- Click expands picker for that face; click again collapses
- Right-aligned quiet "N sel" count + ✕ deselect button

**Expanded picker:**
- Header: face name + current material
- Quick material buttons from `QUICK_MATERIALS` config
- Click applies material to that face on all selected voxels

**Batch shortcuts (always visible):**
- "All walls:" — sets N+S+E+W on all selected
- "All floors:" / "All ceilings:" — sets bottom/top
- Available for single AND multi select

**What gets removed from MatrixEditor:**
- "N TILES" / "TILE DETAIL" header block
- Room dropdown (Issue 3)
- FaceSchematic usage
- BatchFaceControls usage
- "N BLOCKS SELECTED" label
- "3D Preview" collapsible toggle + VoxelPreview3D in tile detail

**What stays:**
- Door Configuration section (renders below FaceStrip when door face present)
- Save-to-library bookmark button (moves into FaceStrip near the ✕)
- Finishes/Electrical panels in contextual area below

### Files
- **New:** `src/components/ui/FaceStrip.tsx`
- **Modified:** `src/components/ui/MatrixEditor.tsx` — replace tile detail section with `<FaceStrip />`
- **Delete:** `src/components/ui/FaceSchematic.tsx` (fully replaced)
- **Delete:** `src/components/ui/BatchFaceControls.tsx` (fully replaced)
- **Modified:** VoxelPreview3D usage in tile detail removed (IsoEditor sidebar preview unchanged)

---

## Testing Strategy

- Existing tests (553) must continue passing — no store API changes except new UI slice fields
- FaceStrip unit test: single-select renders 6 face buttons with correct materials
- FaceStrip unit test: multi-select shows "Mix" when voxels disagree on a face
- FaceStrip unit test: batch shortcuts apply material to correct faces
- Frame opacity test: wallCutMode 'half'/'down' produces opacity < 1 on posts/beams
- Global hideRoof/hideSkin: store toggle test + verify ContainerSkin reads from store
- Browser verification: all 4 changes visually confirmed
