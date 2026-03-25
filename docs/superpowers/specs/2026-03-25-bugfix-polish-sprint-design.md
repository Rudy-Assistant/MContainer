# Bugfix & Polish Sprint — Design Spec

**Date:** 2026-03-25
**Scope:** 5 bug fixes + 1 feature (ghost preview) across ModuHome V1
**Prerequisite handoffs:** sprint-design-pass-handoff.md, sprint-bugfix-handoff.md

---

## 1. Grid Orientation Fix

### Problem
SpatialVoxelGrid and MatrixEditor SimpleBayGrid both map col 0 (nearest camera) to "S Deck 1". User expects nearest extension to be "S Deck 3".

### Solution
Reverse deck numbering in `computeBayGroups()` and add directional labels.

### Files Changed
- `src/config/bayGroups.ts`
- `src/components/ui/finishes/SpatialVoxelGrid.tsx`
- `src/components/ui/MatrixEditor.tsx`

### Details

**Label reversal in `computeBayGroups()`:**
- Current: Deck 1 = cols 1-2 (nearest), Deck 2 = cols 3-4, Deck 3 = cols 5-6 (farthest)
- New: Deck 3 = cols 1-2 (nearest), Deck 2 = cols 3-4, Deck 1 = cols 5-6 (farthest)
- Applied symmetrically to both N Deck and S Deck rows
- Bay 1/2/3 body labels unchanged (no nearest/farthest semantic issue)

**Directional labels:**
- SpatialVoxelGrid: `FRONT` above row 0, `BACK` below row 2 (matching V2's `FRONT (N)` / `BACK (S)`)
- MatrixEditor SimpleBayGrid: same `FRONT` / `BACK` labels at top/bottom
- Small caps, dimmed color (`var(--text-dim)`), outside the grid cells

### Verification
Playwright clicks the nearest extension voxel in 3D, confirms MatrixEditor highlights "S Deck 3" (not "S Deck 1").

---

## 2. Container Preset Icon Cards

### Problem
The 5 container presets (All Deck, Interior, N Deck, S Deck, Retract) are small PresetCards in a horizontal row. They should be prominent icon buttons in a grid, within the Container tab.

### Solution
Replace horizontal PresetCard row with a 3-column CSS grid of larger icon buttons.

### Files Changed
- `src/components/ui/finishes/ContainerPresetRow.tsx`
- `src/components/ui/finishes/ContainerTab.tsx`
- `src/components/ui/finishes/PresetCard.tsx`

### Details

**Layout in ContainerTab:**
- Floor/Ceiling/Frame toggle row stays at top (unchanged)
- Section label "Presets" below toggles (`var(--text-dim)`)
- ContainerPresetRow switches to a 3-column CSS grid
- 5 presets: 3 on first row, 2 on second row (left-aligned)

**PresetCard `size="large"` variant:**
- New optional `size` prop: `"default" | "large"`
- `"large"`: ~72-80px image area, `IsometricVoxelSVG` at 48-56px
- Bold label: `font-weight: 600`, white text
- Dark card background, subtle border (`rgba(255,255,255,0.08)`), `border-radius: 8px`
- Highlight on image only (per PresetCard convention), text below outside highlight

**Interaction:** Click applies preset (existing `handleApplyPreset`). Hover triggers ghost preview (existing `setGhostPreset`/`clearGhostPreset`).

---

## 3. Context-Aware Tab Switching

### Problem
When a wall/floor/ceiling face is clicked in 3D, FinishesPanel should auto-switch to the relevant tab. Current `faceToTab()` exists but may not fire reliably due to React batching between `setSelectedElements` and `setSelectedFace`.

### Solution
Extend `faceToTab()` routing, add element-type routing, and batch the two Zustand calls.

### Files Changed
- `src/components/ui/finishes/FinishesPanel.tsx`
- `src/components/objects/ContainerSkin.tsx`

### Details

**Face-to-tab routing (extend `faceToTab()`):**
- `n`, `s`, `e`, `w` → `'walls'` (already works)
- `top` → `'ceiling'` when ceiling mode active, otherwise `'flooring'`
- `bottom` → `'flooring'`
- No face + bay/block element type → `'block'`
- `null` face + no element → stays on current tab
- Container tab is never auto-selected (manual only)

**Batching fix in ContainerSkin:**
- Combine `setSelectedElements()` + `setSelectedFace()` into a single Zustand action, or use `unstable_batchedUpdates` to ensure both land in the same React render cycle
- FinishesPanel's `useEffect` watching `selectedFace` then fires reliably

**Element-type routing (new):**
- Second `useEffect` in FinishesPanel watching `selectedElements.type`
- If type is `'bay'` or `'block'` and no face selected → auto-switch to `'block'` tab
- Face selection takes priority over element-type routing

### Verification
Playwright clicks a wall face in 3D → confirms Walls tab active with "WALL SURFACE" options visible. Repeat for floor → Flooring tab, ceiling → Ceiling tab.

---

## 4. Hotbar Redesign + Ghost Preview

### Problem
BottomPanel cards don't match aspirational art direction (rounded frames, separated labels). Ghost preview for stamp mode is missing.

### Solution
Redesign card styling to match aspirational art. Extend ghost preview system for hotbar stamp mode.

### Files Changed
- `src/components/ui/BottomPanel.tsx`
- `src/components/ui/SmartHotbar.tsx`
- `src/components/objects/HoverPreviewGhost.tsx`
- `src/store/slices/uiSlice.ts`

### Details

**BottomPanel card redesign:**
- Visible rounded frame/border: `border-radius: 10px`, border `rgba(255,255,255,0.12)`
- Image thumbnail fills card frame, rounded top corners
- White label below image, outside frame: `#fff`, `font-weight: 600`, `font-size: 12px`
- 2-line label truncation stays
- Dark pill container background unchanged
- Left/right arrow pagination unchanged (6/page)
- Selected: highlight border on image frame only (accent color)
- Placing: subtle blue tint (`#93c5fd`) on label

**SmartHotbar slot styling:**
- Matching rounded frame treatment on slot buttons
- Label color stays `#ffffff` (hardcoded)
- Verify computed color is `rgb(255, 255, 255)`

**Ghost Preview (stamp mode):**
- Trigger: hotbar material/bay config active (isPlacing = true), hovering a voxel face in 3D
- Existing infrastructure: `ghostPreset` in uiSlice + `HoverPreviewGhost` — extend for hotbar stamp mode
- New state: `stampPreview: { surfaceType: SurfaceType; hoveredVoxelIndex: number } | null` in uiSlice
- Visual: transparent overlay (0.3 opacity) showing material on hovered face. Green tint (`#22c55e` at 0.2 opacity) = valid placement. Red tint = invalid (e.g., floor material on wall).
- Flow: select material in hotbar → hover voxel face → ghost preview → click to apply → ghost follows cursor
- Clear: deselect hotbar item, press Escape, or switch tabs

### Verification
Playwright selects material in hotbar → hovers voxel face → confirms ghost preview element in scene → clicks → confirms material applied. Also: `getComputedStyle` on hotbar labels confirms `rgb(255, 255, 255)`.

---

## 5. Wireframe Debug Overlay

### Problem
V1's DebugOverlay uses EdgesGeometry lineSegments (body only), but ContainerSkin's own halo/edge rendering creates a second wireframe for extensions. Result: doubled wireframes.

### Solution
Port V2's approach: render voxels as wireframe meshes directly, suppress ContainerSkin's normal rendering in wireframe mode.

### Files Changed
- `src/components/three/DebugOverlay.tsx`
- `src/components/objects/ContainerSkin.tsx`

### Details

**Replace DebugOverlay architecture:**
- Remove EdgesGeometry + lineSegments approach
- When `debugHitboxes` is true, render each voxel as `<mesh>` with `MeshBasicMaterial({ wireframe: true, depthTest: false, depthWrite: false, side: DoubleSide })`
- Body voxels (rows 1-2, cols 1-6): red `0xff2222`, opacity 0.6
- Extension voxels (rows 0/3, cols 0/7): orange `0xff8800`, opacity 0.4
- Positions from `getVoxelLayout()` — exact alignment with ContainerSkin
- All 32 voxels rendered

**ContainerSkin suppression:**
- When `debugHitboxes` is true, skip normal face rendering (skin meshes, edge strips, baseplate wireframes, halo geometry)
- Container becomes invisible except for DebugOverlay wireframes
- Selection highlight and hover highlight still render on top (`renderOrder: 100+`)

**Corner debug labels (from V2):**
- Port `DebugLabels`: colored corner dots at voxels 0, 7, 24, 31
- Red (NW), Blue (NE), Green (SW), Yellow (SE)
- Only visible when `debugHitboxes` is true

### Verification
Playwright toggles wireframe ON → confirms single set of wireframe outlines (no doubling). Confirms extensions visible in orange. Toggles OFF → normal rendering returns.

---

## Invariants (Must Not Violate)

- Never mutate refs inside Zustand selectors — use `useShallow` + component body dedup
- `selectedFace` is orthogonal to `selectedElements` — don't clear on reselection
- MatrixEditor owns the spatial grid — never duplicate in FinishesPanel
- PresetCard: highlight on image only, text below
- Always verify with Playwright before claiming complete

## Dependencies Between Issues

Issues 1-5 are largely independent. Ordering recommendation:
1. Grid orientation (issue 1) — standalone, no deps
2. Container presets (issue 2) — standalone, touches ContainerTab
3. Context-aware tabs (issue 3) — touches FinishesPanel + ContainerSkin selection flow
4. Wireframe debug (issue 5) — touches ContainerSkin + DebugOverlay
5. Hotbar redesign + ghost preview (issue 4) — largest scope, touches BottomPanel + SmartHotbar + HoverPreviewGhost + uiSlice

Issues 3 and 5 both modify ContainerSkin.tsx — implement 3 first (selection batching), then 5 (wireframe suppression) to avoid merge conflicts.
