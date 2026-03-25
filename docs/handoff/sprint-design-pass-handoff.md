# Sprint: Design Pass — Handoff Document

## What Was Built

### Selection Model Migration
- **Removed**: `selectedVoxel`, `selectedVoxels`, `setSelectedVoxel`, `setSelectedVoxels`, `toggleVoxelInSelection` from `selectionSlice.ts`
- **Added**: `selectedElements: { type: ElementType; items: Array<{containerId, id}> } | null` with `setSelectedElements` and `toggleElement`
- **Compatibility hooks**: `useSelectedVoxel()` / `useSelectedVoxels()` in `src/hooks/` derive legacy shapes from `selectedElements` for consumers that still need the old format
- **Critical pattern**: Zustand selectors with middleware chains do NOT support `equalityFn` as 2nd arg. Must use `useShallow` for subscription + `useRef` dedup in component body. See `useSelectedVoxel.ts` for the pattern.
- `selectedFace` is ORTHOGONAL to `selectedElements` — stores face direction (n/s/e/w/top/bottom), not element selection. `setSelectedElements` must NOT clear `selectedFace` unless sel is null.

### New Components
- `PresetCard` (`src/components/ui/finishes/PresetCard.tsx`) — Shared card: square image area with highlight border on image only, text label below outside highlight. Used by all tabs.
- `IsometricVoxelSVG` (`src/components/ui/svg/IsometricVoxelSVG.tsx`) — Programmatic isometric cube with floor plane, detail overlays (railing lines, window cross-hatch, fold indicators)
- `IsometricItemSVG` (`src/components/ui/svg/IsometricItemSVG.tsx`) — Hand-crafted electrical item SVGs
- `ContainerTab` (`src/components/ui/finishes/ContainerTab.tsx`) — Mode toggles (Floor/Ceiling, Frame) + container preset row
- `ContainerPresetRow` (`src/components/ui/finishes/ContainerPresetRow.tsx`) — 5 PresetCards for All Deck/Interior/N Deck/S Deck/Retract
- `SpatialVoxelGrid` (`src/components/ui/finishes/SpatialVoxelGrid.tsx`) — Named cell grid for multi-select (Shift+Click range, Ctrl+Click toggle)
- `surfaceColorMap.ts` (`src/components/ui/svg/surfaceColorMap.ts`) — SVG-specific surface colors (intentionally different from SURFACE_COLORS in surfaceLabels.ts)

### UI Changes
- FinishesPanel: Container tab added as first tab, all 6 tabs fit (abbreviated "Elec.")
- BlockTab: 3-col grid with IsometricVoxelSVG PresetCards
- WallsTab: converted from custom buttons to PresetCard (3-col)
- BottomPanel: pagination (6/page with arrows), 2-line labels, dark rounded cards
- SmartHotbar: dark slot buttons for white text, CSS calc() centering
- MatrixEditor: deploy bar (text buttons) removed — presets now in Container tab
- Simple/Detail toggle: moved from Sidebar to Settings dropdown
- DebugOverlay: extension voxels excluded from wireframe

### Ghost Preview
- `ghostPreset` state in uiSlice — set on PresetCard hover, cleared on leave/tab switch/panel close
- `HoverPreviewGhost` extended in `src/components/objects/HoverPreviewGhost.tsx` — renders transparent overlay with pulse animation

## Remaining Issues

### 1. Grid Orientation Mismatch (HIGH PRIORITY)
**File**: `src/components/ui/finishes/SpatialVoxelGrid.tsx`
**Problem**: When the user clicks the nearest extension voxel in 3D, the MatrixEditor highlights "S Deck 1" but the user expects the nearest to be "S Deck 3". The numbering goes 1→2→3 from nearest to farthest (matching column indices), but the user's mental model has 3 = nearest.
**Root cause**: The voxel index formula `idx(row,col) = row*8+col` maps col 0 to +X (nearest camera). Bay groups number 1→2→3 from col 1-2 → col 3-4 → col 5-6 (left to right = nearest to farthest). This is a naming convention issue, not a code bug.
**Options**: (a) Renumber so Deck 3 = nearest (col 1-2), Deck 1 = farthest (col 5-6) — requires changing bayGroups.ts labels. (b) Add "Front"/"Back" labels to the grid. (c) Accept current numbering and add orientation indicator.

### 2. Container Presets as Tabs with Icons (DESIGN)
**Current**: Container presets (All Deck, Interior, N Deck, S Deck, Retract) render as PresetCards with isometric SVGs in a horizontal row under the Container tab.
**User request**: These should be "Container Tabs with Icons" — possibly replacing the Floor/Ceiling/Frame tab bar, or as a second row of tabs within the Container tab.
**Needs**: Design decision on tab vs card layout for container-level presets.

### 3. Wall Selection Visibility in All Previews
**Current**: When a wall is selected in 3D, `setSelectedFace` is called and FinishesPanel initializes to the correct tab. But selection highlighting in MatrixEditor grid and VoxelPreview3D may not show the face highlight consistently.
**File**: `src/components/ui/finishes/FinishesPanel.tsx` line 25 — initialTab derived from selectedFace on mount.
**Risk**: React batching can cause FinishesPanel to remount between `setSelectedElements` and `setSelectedFace` calls.

### 4. Hotbar Slot Label Visibility
**Current**: SmartHotbar slot labels are `color: "#ffffff"` on dark buttons `rgba(0,0,0,0.35)`. BottomPanel card labels are `#fff` with 2-line wrap.
**Root cause pattern**: React inline style `color: undefined` removes the property, causing CSS cascade to inherit `var(--text-main)` (dark). Always use explicit color values, never `undefined`.

### 5. Wireframe Extension Wireframes
**Current**: DebugOverlay skips extension voxels (only body voxels shown). But ContainerSkin's own extension halo rendering still shows orange/yellow wireframe outlines for extensions.
**File**: `src/components/three/DebugOverlay.tsx` — extensions excluded. The remaining orange wireframes are from ContainerSkin's halo architecture.

## Key Architectural Decisions

1. **selectedFace is orthogonal** — It stores face direction, not element identity. Never clear it in setSelectedElements unless clearing selection entirely.
2. **Zustand selector pattern** — useShallow for subscription + derive in component body + useRef dedup. Never use equalityFn as 2nd arg with middleware stores.
3. **PresetCard is the standard** — All finishes tabs use it. Highlight on image only, text below.
4. **MatrixEditor owns the spatial grid** — FinishesPanel must NOT render its own grid.
5. **surfaceColorMap is SVG-specific** — Intentionally different from SURFACE_COLORS (Open = visible wireframe grey, not transparent).

## File Reference

| File | Lines | Role |
|------|-------|------|
| `src/store/slices/selectionSlice.ts` | ~240 | Selection model: selectedElements, toggleElement, clearSelection |
| `src/hooks/useSelectedVoxel.ts` | ~48 | Derives legacy VoxelPayload from selectedElements |
| `src/hooks/useSelectedVoxels.ts` | ~43 | Derives legacy selectedVoxels from selectedElements (bay only) |
| `src/hooks/useSelectionTarget.ts` | ~100 | Derives SelectionTarget for FinishesPanel routing |
| `src/components/ui/finishes/FinishesPanel.tsx` | ~140 | Tab routing, face-aware initial tab |
| `src/components/ui/finishes/SpatialVoxelGrid.tsx` | ~200 | Named cell grid with multi-select |
| `src/components/ui/finishes/ContainerTab.tsx` | ~90 | Container tab: mode toggles + preset row |
| `src/components/ui/finishes/PresetCard.tsx` | ~70 | Shared card component |
| `src/components/ui/svg/IsometricVoxelSVG.tsx` | ~130 | Programmatic isometric cube SVG |
| `src/components/ui/BottomPanel.tsx` | ~280 | Form picker with pagination |
| `src/components/ui/SmartHotbar.tsx` | ~1600 | Surface preset hotbar |
| `src/components/objects/HoverPreviewGhost.tsx` | ~170 | Ghost preview overlay in 3D |
| `src/components/three/DebugOverlay.tsx` | ~95 | Wireframe debug visualization |
| `src/components/ui/MatrixEditor.tsx` | ~1100 | Block grid (SimpleBayGrid/VoxelGrid) |
