# Block Tab & Custom Gizmo Design

**Date:** 2026-03-24
**Status:** Draft v2
**Depends on:** FinishesPanel redesign (sprint-finishes-panel-handoff.md)

---

## Overview

Two tasks:
1. **Block tab** — Unify VoxelContextMenu and BayContextMenu into a single Block tab in the FinishesPanel. Remove floating radial menus from the 3D canvas. Expand VoxelPreview3D to render multi-voxel bay groups.
2. **Custom gizmo** — Replace drei GizmoViewport with a custom orientation gizmo using drei's `<View>` overlay with click-to-snap camera rotation.

---

## Task 1: Block Tab

### Problem

Structural presets (Void, Floor, Ceiling, Railing, Window, etc.) are currently accessed via right-click radial menus floating over the 3D canvas. These menus:
- Obscure the viewport
- Are disconnected from the FinishesPanel workflow
- Have diverged: BayContextMenu uses module types (Solid, Glass, Fold-Down, etc.) while VoxelContextMenu uses structural presets (Void, Floor, Ceiling, etc.)
- BayContextMenu mixes structural and finish concerns in one floating menu

### Design

#### Tab bar

The FinishesPanel tab bar becomes 5 tabs:

```
Block | Flooring | Walls | Ceiling | Electrical
```

No separate Bay tab. Block tab is context-sensitive based on selection type.

#### Block tab content

The Block tab shows the same 8 structural presets regardless of whether the selection is a single voxel (Detailed mode) or a bay group (Simple mode).

**Preset face maps** (extracted verbatim from VoxelContextMenu CONFIGS):

| Preset | top | bottom | n | s | e | w |
|--------|-----|--------|---|---|---|---|
| Void | Open | Open | Open | Open | Open | Open |
| Floor | Open | Deck_Wood | Open | Open | Open | Open |
| Ceiling | Solid_Steel | Open | Open | Open | Open | Open |
| Floor+Ceil | Solid_Steel | Deck_Wood | Open | Open | Open | Open |
| Railing | Solid_Steel | Deck_Wood | Railing_Cable | Railing_Cable | Railing_Cable | Railing_Cable |
| Window | Solid_Steel | Deck_Wood | Glass_Pane | Glass_Pane | Glass_Pane | Glass_Pane |
| Half-Fold | Open | Deck_Wood | Half_Fold | Half_Fold | Solid_Steel | Solid_Steel |
| Gull-Wing | Open | Deck_Wood | Gull_Wing | Gull_Wing | Solid_Steel | Solid_Steel |

> **Implementation note:** Extract the CONFIGS array from VoxelContextMenu.tsx verbatim into `blockPresets.ts`. Do NOT re-derive from the description column above — use the actual code values as source of truth.

Below the preset grid: **Actions** row — Lock, Copy, Reset. When a bay is selected, also show **Deploy/Close** toggle (for hinged presets like Half-Fold, Gull-Wing) and **Apply to Wall** (batch-apply current config to all bays on the wall).

Layout: 4-column grid of preset cards (icon + label). Active preset highlighted with cyan border.

#### Scope indicator

A badge row between the tab bar and preset grid shows selection scope:

- **Detailed mode**: grey badge `1 voxel` + position text `Body · Row 2, Col 4`
- **Simple mode**: cyan badge `Bay · N voxels` + bay ID text `body_0`

#### Bay preset application

When a preset is applied to a bay, the bay is treated as a **single block with 6 outer faces**. The preset configures those 6 boundary faces. Internal voxel faces within the bay are not individually addressed — the bay is one unit.

Example: "Railing" on a 2×2 body bay (indices [9,10,17,18]) places cable railings on the 4 outermost wall edges of the bay group, not on each voxel's 4 edges independently.

**Boundary face computation algorithm:**

```
Given: bayIndices[], presetFaces {top, bottom, n, s, e, w}

For each voxelIndex in bayIndices:
  row = Math.floor(voxelIndex / GRID_COLS)
  col = voxelIndex % GRID_COLS

  // Top and bottom always apply to all voxels in the bay
  setFace(voxelIndex, 'top', presetFaces.top)
  setFace(voxelIndex, 'bottom', presetFaces.bottom)

  // Wall faces only apply at the bay's outer boundary
  minRow = min(row for all bayIndices)
  maxRow = max(row for all bayIndices)
  minCol = min(col for all bayIndices)
  maxCol = max(col for all bayIndices)

  if row == minRow: setFace(voxelIndex, 'west', presetFaces.west)   // west = minRow
  if row == maxRow: setFace(voxelIndex, 'east', presetFaces.east)   // east = maxRow
  if col == minCol: setFace(voxelIndex, 'north', presetFaces.north) // north = minCol
  if col == maxCol: setFace(voxelIndex, 'south', presetFaces.south) // south = maxCol

  // Internal faces (not at bay boundary) → Open
  if row != minRow: setFace(voxelIndex, 'west', 'Open')
  if row != maxRow: setFace(voxelIndex, 'east', 'Open')
  if col != minCol: setFace(voxelIndex, 'north', 'Open')
  if col != maxCol: setFace(voxelIndex, 'south', 'Open')
```

#### Dual data model bridge

The system maintains two parallel data models:
- **Voxel faces**: `voxelGrid[index].faces` — per-voxel, 6 SurfaceType faces
- **Wall/bay modules**: `container.walls[wall].bays[bayIndex].module` — per-wall ModuleType

`applyBlockConfig` writes to **both** models atomically:

1. Set voxel faces (as described above)
2. Map the preset to the corresponding ModuleType and call `setBayModule`:
   - Void → `createOpenVoid()`
   - Floor/Ceiling/Floor+Ceil/Railing/Window → `createPanelSolid()` (with appropriate face config)
   - Half-Fold → `createHingedWall(foldsDown=true, foldsUp=false)`
   - Gull-Wing → `createHingedWall(foldsDown=true, foldsUp=true)`

This ensures both rendering paths stay consistent. The voxel face model is the source of truth for 3D rendering; the wall/bay model provides the module identity for UI state (which preset is "active").

#### `applyBlockConfig` store action

- **Slice**: `voxelSlice.ts` (alongside existing `setFace`, `setFaces`)
- **Signature**: `applyBlockConfig(containerId: string, indices: number[], presetId: BlockPresetId)`
- **PresetId type**: `type BlockPresetId = 'void' | 'floor' | 'ceiling' | 'floor_ceil' | 'railing' | 'window' | 'half_fold' | 'gull_wing'` (string enum, not numeric index — avoids brittle coupling to array order)
- **Undo**: Creates a temporal snapshot (zundo) before applying
- **Lock check**: Skips locked voxels (checks `voxelGrid[i].locked`)
- **Bay module sync**: If indices match a known bay group, also calls `setBayModule`

#### BayContextMenu feature relocation

Current BayContextMenu features relocate as follows:

| Feature | Current location | New location | Rationale |
|---------|-----------------|--------------|-----------|
| Module types (Solid/Glass/Fold-Down/etc.) | BayContextMenu radial ring | Block tab presets | Structural identity |
| Deploy/Close toggle | BayContextMenu center | Block tab Actions row | Structural state |
| Apply to Entire Wall | BayContextMenu secondary | Block tab Actions row | Batch scope action |
| Edge treatment (Railing/Glass/Solid/Closet/Open) | BayContextMenu edge mode | Walls tab | Surface finish on wall face |
| Side wall type | BayContextMenu edge mode | Walls tab | Surface finish on side face |
| Floor material (8 swatches) | BayContextMenu floor mode | Flooring tab | Already handles floor materials |
| Color swatches (9 colors) | BayContextMenu secondary | Walls tab | Wall surface color |
| Remove Floor toggle | BayContextMenu floor mode | Flooring tab | Floor state toggle |
| Lock/Unlock | BayContextMenu center | Block tab Actions row | Per-block state |

No features are lost — they relocate to their natural tab.

#### Backward compatibility

Existing persisted containers (idb-keyval) with `container.walls` data continue to load normally. The `walls` data model is not removed — it remains in the schema and is bridged by `applyBlockConfig`. On hydration, `rebuildMergeTracking` already runs; no additional migration needed.

### VoxelPreview3D expansion

Currently VoxelPreview3D renders a single voxel as an exploded cube with 6 clickable faces. This must expand to support multi-voxel bay groups:

- When a bay is selected, render all constituent voxels in their spatial arrangement (e.g. a 2×2 grid for body_0)
- Outer boundary of the bay group highlighted with cyan edges
- Internal voxel divisions visible as subtle lines
- Each individual voxel within the preview is clickable for drill-down — clicking voxel 9 within body_0 selects that voxel for face-level editing without switching out of Simple mode
- Merged dimensions computed from min/max col/row of bay group indices, accounting for extension vs body cell sizes (already partially implemented in GroupedVoxelPreview)

### Files to modify

| File | Change |
|------|--------|
| `src/components/ui/finishes/FinishesPanel.tsx` | Add Block tab to FinishesTabBar |
| `src/components/ui/finishes/FinishesTabBar.tsx` | Add `'block'` to `FinishTab` type, update `FINISH_TABS` array |
| `src/components/ui/finishes/BlockTab.tsx` | **New file** — preset grid, scope badge, actions row (Lock/Copy/Reset/Deploy/ApplyToWall) |
| `src/components/ui/VoxelPreview3D.tsx` | Expand CubeScene to render multi-voxel bay groups with per-voxel click targets |
| `src/components/ui/VoxelContextMenu.tsx` | Remove (presets moved to BlockTab) |
| `src/components/ui/BayContextMenu.tsx` | Remove (features relocated to tabs per table above) |
| `src/app/page.tsx` | Remove VoxelContextMenu and BayContextMenu mount points |
| `src/components/three/Scene.tsx` | Remove `closeBayContextMenu()` calls from event handlers |
| `src/store/slices/uiSlice.ts` | Remove `voxelContextMenu` and `bayContextMenu` state + actions |
| `src/store/slices/voxelSlice.ts` | Add `applyBlockConfig` action with dual-model bridge |
| `src/config/blockPresets.ts` | **New file** — shared BlockConfig[] array (extracted verbatim from VoxelContextMenu CONFIGS) |
| `src/components/ui/finishes/WallsTab.tsx` | Add edge treatment, side wall type, and color swatch sections (relocated from BayContextMenu) |
| `src/components/ui/finishes/FlooringTab.tsx` | Add floor material swatches and Remove Floor toggle (relocated from BayContextMenu) |

### Data flow

```
User clicks voxel/bay → useSelectionTarget() derives SelectionTarget
  → FinishesPanel reads target type
  → Block tab shows presets + scope badge
  → User clicks preset card
  → applyBlockConfig(containerId, indices, presetId) action
    → check locks, skip locked voxels
    → create temporal snapshot
    → compute bay boundary faces
    → set voxel faces (voxelGrid[i].faces)
    → sync bay module (container.walls[wall].bays[bayIndex].module)
    → invalidate() for demand-mode re-render
```

### What this does NOT change

- The 15 fixed bay groups in `bayGroups.ts` — unchanged
- `designComplexity: 'simple' | 'detailed'` toggle — unchanged
- `useSelectionTarget` hook — unchanged (already supports all needed types)
- Selection mechanics (click, shift-click, marquee) — unchanged
- `container.walls` schema — unchanged (bridged, not deprecated)

---

## Task 2: Custom Orientation Gizmo

### Problem

The current drei GizmoHelper + GizmoViewport works but:
- Shows all 6 axes including -Y (viewing from below ground is never useful)
- No click-to-snap functionality (purely visual)
- Grey with no hover feedback

### Design

Replace with a custom gizmo using drei's `<View>` component for an independent overlay with its own orthographic camera. This avoids the R3F crash from the previous separate-file attempt while keeping the gizmo camera-independent.

#### Visual

- 5 axis lines radiating from a center point: +Y (up), +X, -X, +Z, -Z
- Each axis terminates in a small sphere
- All grey (#94a3b8) by default, no labels
- Positive axes: slightly thicker lines (linewidth 2), larger spheres (radius 0.08)
- Negative axes: thinner lines (linewidth 1), smaller spheres (radius 0.05)
- No -Y axis (looking up from underground is not useful)

#### Interaction

- **Hover**: hovered axis brightens to white (#ffffff), line thickens, sphere enlarges
- **Click**: camera snaps to an axis-aligned view using `cameraControlsRef.current.setPosition()` + `setTarget()`
  - +Y click → top-down view (position above target, looking down)
  - +X click → view from +X looking at orbit target
  - -X click → view from -X looking at orbit target
  - +Z click → view from +Z looking at orbit target
  - -Z click → view from -Z looking at orbit target
- Camera transition uses CameraControls' built-in smooth interpolation (smoothTime)

#### Implementation approach

Use an **HTML overlay with SVG** approach (not drei `<View>`, which requires `eventSource` on Canvas — forbidden per project anti-patterns):

1. Add an 80×80px `<div>` with `position: absolute; top: 60px; right: 60px; pointer-events: auto` as a sibling to the Canvas inside SceneCanvas.tsx's container div
2. Render an SVG inside this div with 5 axis lines + circle endpoints
3. The SVG rotates based on the main camera's spherical coordinates (read via a `useFrame` hook that writes to a ref, then a `requestAnimationFrame` loop in the HTML component reads the ref)
4. Click handlers on SVG circles call `cameraControlsRef.current.setPosition(...)` for snap-to-axis
5. Hover handlers toggle CSS classes for brightness

This approach:
- Avoids `eventSource` on Canvas (project anti-pattern)
- No R3F raycasting interference (pure HTML/SVG layer)
- Camera rotation mirrored via shared ref (no store mutations per frame)
- Simple, no drei dependency for the gizmo itself
- Avoids the crash from previous separate-file R3F component attempt

#### Positioning

- Fixed 80×80px div in top-right corner of viewport, margin [60, 60] from edges (matching current GizmoHelper position)
- Semi-transparent background (optional, for contrast)
- z-index above canvas but below UI panels

### Files to modify

| File | Change |
|------|--------|
| `src/components/three/Scene.tsx` | Remove GizmoHelper/GizmoViewport import and JSX |
| `src/components/three/SceneCanvas.tsx` | Add gizmo HTML/SVG overlay div inside container, add `useFrame` hook to write camera quaternion to shared ref |

---

## Testing

### Block tab

- Unit test: `applyBlockConfig` applies correct faces for each preset to single voxel (verify against face map table)
- Unit test: `applyBlockConfig` applies correct boundary faces for each preset to bay group (body_0: 4 voxels, verify internal faces are Open)
- Unit test: `applyBlockConfig` bridges to `setBayModule` — verify ModuleType is set correctly
- Unit test: `applyBlockConfig` skips locked voxels
- Unit test: BlockTab presets match extracted VoxelContextMenu CONFIGS exactly
- Integration: selecting a voxel in Detailed mode shows Block tab with scope badge "1 voxel"
- Integration: selecting a bay in Simple mode shows Block tab with scope badge "Bay · N voxels"

### Multi-voxel preview

- Unit test: bay group renders correct number of sub-voxels in VoxelPreview3D
- Integration: clicking a sub-voxel within bay preview selects that voxel for face editing

### Feature relocation

- Integration: Walls tab shows edge treatment options when bay with hinged module is selected
- Integration: Flooring tab shows floor material swatches + Remove Floor toggle

### Custom gizmo

- Visual: gizmo appears in top-right, 5 axes visible, no labels
- Integration: clicking +Y axis snaps camera to top-down view
- Integration: hover brightens axis to white

---

## Out of scope

- Furniture/Appliances/Fixtures catalog (bottom bar in concept art)
- Group/Ungroup containers (toolbar action, not Block tab)
- Smart mode auto-consequences (orthogonal system, unchanged)
- User-definable bay groups (bays remain fixed geometry)
- Deprecating `container.walls` model (bridged, not removed)
