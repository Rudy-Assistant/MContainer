# Sprint Handoff: Block Tab + Gizmo

**Date:** 2026-03-24
**Sprint:** Block/Bay tabs + Custom Gizmo
**Status:** Core implementation complete, design pass needed

---

## What Was Completed

### Block Tab (FinishesPanel)
- **FinishesTabBar** updated: `block | flooring | walls | ceiling | electrical`
- **BlockTab.tsx** created: 8 structural presets (Void, Floor, Ceiling, Floor+Ceil, Railing, Window, Half-Fold, Gull-Wing) in 4-col grid with Lock/Copy/Reset actions
- **blockPresets.ts** config extracted from VoxelContextMenu CONFIGS
- **applyBlockConfig** store action: single-voxel and bay boundary logic, lock check
- **FinishesPanel** wired: Block tab as default, shows without face selection
- Block tab auto-selects on voxel/bay selection

### Context Menu Removal
- VoxelContextMenu.tsx and BayContextMenu.tsx removed from page.tsx mounts
- closeBayContextMenu calls removed from Scene.tsx
- Context menu state cleaned from store slices

### Custom Orientation Gizmo
- **OrientationGizmo.tsx**: HTML/SVG overlay, 5 axes (+Y, ±X, ±Z, no -Y)
- Grey dots, no labels, no background/frame, no center origin dot
- Uniform dot size, hover brightens to white
- Click-to-snap via window event → Scene.tsx CameraControls listener
- Camera quaternion shared via ref (Scene useFrame → OrientationGizmo rAF)
- GizmoHelper/GizmoViewport removed from Scene.tsx

### Ctrl+Click Multi-Select (Bay Grid)
- MatrixEditor SimpleBayGrid: Ctrl/Cmd+Click toggles bay groups in/out of multi-select
- Toggle logic: if all bay indices already selected, removes them; else adds them

### Frame Mode Exit
- FrameInspector: "← Exit Frame Mode" button added
- Sidebar: MatrixEditor always visible, FrameInspector shown below when frame mode active

---

## What Remains (Design Pass Items)

### 1. Block Tab Isometric Previews
**Current:** Preset cards show small Lucide icons (X, Footprints, Fence, etc.)
**Desired:** Isometric mini-renders showing how the voxel looks with each config applied (similar to TextureSwatchGrid thumbnails for materials)
**Approach options:**
- (A) Pre-rendered PNGs: Create 8 isometric renders offline, reference as static assets
- (B) SVG isometric drawings: Programmatic SVG showing cube with faces colored by preset
- (C) Canvas mini-renders: R3F offscreen render per preset (heaviest)
**Recommendation:** (B) SVG isometric — lightweight, scales to any size, can highlight specific faces with colors matching the preset

### 2. Ghost Preview on Preset Hover
**Current:** Hovering a preset in Block tab does nothing in 3D viewport
**Desired:** When hovering a preset card, the selected voxel(s) in 3D temporarily show a transparent preview of what that preset would look like
**Existing pattern:** `HoverPreviewGhost` already exists for hotbar items
**Implementation:** Add `onMouseEnter` to preset buttons → set `facePreview` store state → HoverPreviewGhost renders transparent overlay

### 3. Standardize Card Design Across Tabs
**Current:** TextureSwatchGrid (Ceiling/Flooring) uses square image cards with texture thumbnails. OptionCardGrid (Lighting/Electrical) uses smaller text-based cards. BlockTab uses icon-only small buttons.
**Desired:** Consistent card size, hover behavior, and text readability across all tabs
**Approach:** Create a shared `PresetCard` component used by all tab types, with variants for texture thumbnails vs SVG previews vs icon-only

### 4. Bottom Hotbar Improvements
- Hotbar overlaps left panel — needs responsive behavior (side-scroll or collapse)
- 80% more transparent background
- Remove dots from door icons
- Make text more readable (larger, higher contrast)

### 5. Pre-Existing Bugs (Not Sprint Scope)
- **Ceiling mode selection:** L1 walls highlight instead of L2/roof; bay hover outline offset from container coordinates
- **Shift+Click drag:** Container doesn't move on release
- **Debug/Wireframe mode:** Previously existed, no longer accessible in UI
- **Frame mode rendering:** Pole/Rail materials don't update visually when changed in Frame inspector; Frame mode should hide walls/ceilings, show only frame
- **Door flush placement:** Doors don't rest flush with walls; shared-face doors should use "smart" property to occupy both sides
- **Window/Railing half-bay openings:** Strange partial openings in bays — possibly faulty Smart system logic

### 6. Inspector Cleanup (from user feedback)
- Remove Bay/Block toggle from Block Grid area (should be Simple/Detail mode toggle)
- Remove legend (Steel/Glass/Wood/Rail)
- Remove N-Cable/S-Cable/E-Cable info and All Walls/Floors/Ceilings buttons beneath Block Grid
- Remove "Bay · 2 voxels" / "Extension · Row 3, Col 3" text from Block tab
- Remove "Structural Presets" label
- Container Preset Configurations (All Deck, Interior, N Deck, S Deck, Retract) need their own tab with isometric container previews

### 7. Multi-Select Regression
- Shift+Click row select in Block Grid (may conflict with Shift+Click container drag)
- Element type constraint: only same-type elements can be multi-selected together (walls with walls, frame with frame, bays with bays)

---

## Files Modified This Sprint

| File | Change |
|------|--------|
| `src/config/blockPresets.ts` | **New** — BlockPresetId + BLOCK_PRESETS array |
| `src/components/ui/finishes/BlockTab.tsx` | **New** — Preset grid + actions |
| `src/components/ui/OrientationGizmo.tsx` | **New** — HTML/SVG gizmo overlay |
| `src/components/ui/finishes/FinishesTabBar.tsx` | Added 'block' tab |
| `src/components/ui/finishes/FinishesPanel.tsx` | Wired BlockTab, default to 'block' |
| `src/components/three/SceneCanvas.tsx` | Mount OrientationGizmo, expose cameraQuaternionRef |
| `src/components/three/Scene.tsx` | Remove GizmoHelper, add useFrame quaternion write, add gizmo-snap listener |
| `src/app/page.tsx` | Remove VoxelContextMenu + BayContextMenu mounts |
| `src/store/slices/voxelSlice.ts` | Add applyBlockConfig action |
| `src/components/ui/MatrixEditor.tsx` | Ctrl+Click multi-select in SimpleBayGrid |
| `src/components/ui/FrameInspector.tsx` | Exit Frame Mode button |
| `src/components/ui/Sidebar.tsx` | Show MatrixEditor always, FrameInspector below |

---

## Test Status

- 700+ tests passing
- `npx tsc --noEmit` → 0 errors
- New tests: `src/__tests__/block-presets.test.ts` (single voxel, bay boundary, lock skip, all 8 presets)
