# FinishesPanel Redesign — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Tabbed FinishesPanel with VoxelPreview3D face selector, texture thumbnail swatches, Open-wall empty-state fix, universal Color picker

## Overview

Replace the flat conditional FinishesPanel with a tabbed layout driven by VoxelPreview3D as the face selector. Texture thumbnail swatches replace plain color blocks. The Open-wall bug is fixed by showing an inline surface type picker. Voxel configuration presets are deferred to a future sprint.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tab scope | Same voxel, all faces | Tabs view different face categories of one voxel. Switching tabs does NOT mutate `selectedFace` in the store. |
| Wall face presentation | VoxelPreview3D as face selector | User clicks faces directly in the 3D preview. No accordions — one face active at a time, finishes below. |
| Swatch source | PBR crop + canvas fallback | Use `/assets/materials/{folder}/color.jpg` where mapping exists; procedural canvas with noise for unmapped materials. |
| Panel housing | Inside Sidebar contextual area | Stays in existing flex:1 overflow area. No standalone floating panel. |
| Voxel presets | Deferred | Out of scope for this sprint. |
| Architecture | Full Component Split (Approach B) | Thin shell + 4 tab files + shared primitives. ~100-150 lines per file. |

## File Structure

```
src/components/ui/finishes/
├── FinishesPanel.tsx        (~100 lines)  — tab state, auto-select, VoxelPreview3D mount, shell
├── FinishesTabBar.tsx       (~40 lines)   — horizontal tab buttons (dark theme pills)
├── FlooringTab.tsx          (~80 lines)   — floor material TextureSwatchGrid + Color
├── WallsTab.tsx             (~120 lines)  — surface type picker + surface-dependent finishes + Color
├── CeilingTab.tsx           (~100 lines)  — ceiling material + lighting fixtures + light color + Color
├── ElectricalTab.tsx        (~60 lines)   — switches/outlets/dimmers grid + Color
├── TextureSwatchGrid.tsx    (~100 lines)  — shared: 3-col grid of 64×64 texture swatches
└── textureThumbnail.ts      (~60 lines)   — thumbnail URL resolver + canvas noise fallback
```

### Files Modified

| File | Change |
|------|--------|
| `src/components/ui/Sidebar.tsx` (line 505-513) | Both `voxel/bay` and `face/bay-face` routes render the new `<FinishesPanel />`. Remove direct `<WallTypePicker>` usage here. |
| `src/config/finishPresets.ts` | Add `textureFolder?: string` to `MaterialPreset`. Add mappings for existing PBR textures. |
| `src/components/ui/VoxelPreview3D.tsx` | Wire face click to call `setSelectedFace(face)` in addition to surface cycling. |
| `src/components/ui/WallTypePicker.tsx` | Stays for potential standalone use, but its grid entries are reused inside `WallsTab`. |

### Files Unchanged

| File | Reason |
|------|--------|
| `src/hooks/useSelectionTarget.ts` | Selection derivation logic unchanged. |
| `src/config/wallTypes.ts` | Wall type data unchanged; consumed by WallsTab. |
| `src/config/materialCache.ts` | PBR material singletons unchanged; thumbnails use raw color.jpg files directly. |
| `src/store/slices/*` | Store actions (`setFaceFinish`, `clearFaceFinish`, `paintFace`, `setSelectedFace`) already exist. |

## Component Design

### FinishesPanel (shell)

**Mount condition:** `target.type` is `voxel`, `bay`, `face`, or `bay-face` (replaces the current split routing in Sidebar.tsx).

**Layout:**
1. **VoxelPreview3D** at top — always visible. Receives `containerId`, `voxelIndex`, `bayGroupIndices` from target. Clicking a face in the preview sets `selectedFace` in the store.
2. **FinishesTabBar** below — 4 tabs: Flooring / Walls / Ceiling / Electrical.
3. **Active tab content** below — scrollable.

**Tab auto-selection:**
- `selectedFace === 'bottom'` → Flooring
- `selectedFace === 'top'` → Ceiling
- `selectedFace in ['n','s','e','w']` → Walls
- No face selected → no tab content, just the preview

Local `useState` for active tab. `useEffect` syncs tab when `selectedFace` changes. User can manually switch tabs without changing the store's selectedFace.

**Props flow:** FinishesPanel reads target from `useSelectionTarget()`, passes `{ containerId, voxelIndex, indices, face }` to the active tab component. Each tab reads voxel data from the store via its own atomic selectors.

### FinishesTabBar

Horizontal row of 4 pill buttons. Dark background (`var(--surface-dark)`), subtle border. Active tab: accent highlight border + slightly lighter background. Matches concept art tab style.

Props: `activeTab`, `onTabChange`, `disabled?: boolean` (disabled when no face selected — tabs visible but grayed).

### FlooringTab

Content when `selectedFace === 'bottom'`:
- **TextureSwatchGrid** with `FLOOR_MATERIALS` (6 items: Oak Planks, Polished Concrete, Bamboo, Hinoki Cedar, Tatami, Tile)
- **Color** — `SwatchRow` preset circles + custom ColorPicker button

Applies finish via `setFaceFinish(containerId, voxelIndex, 'bottom', { material })`.

### WallsTab

Content when `selectedFace in ['n','s','e','w']`:

**Surface type picker** — always shown at top. Reuses `WALL_TYPES.filter(t => t.category === 'wall')` from wallTypes.ts. Grid of icon+label buttons (same layout as current WallTypePicker but styled to match concept art dark cards). Clicking changes the surface via `paintFace(containerId, voxelIndex, face, surface)`.

**Surface-dependent finishes** — shown below the surface type picker, content varies by current surface:
- `Open` → nothing below the picker (this IS the fix — user sees the picker and can change surface)
- `Solid_Steel` / other wall surfaces → Exterior Material (TextureSwatchGrid) + Color
- `Glass_Pane` / windows → Glass Tint (SwatchRow) + Frame Color (SwatchRow) + Color
- `Door` → Door Style (material cards) + Frame Color + Color

Uses `getFinishOptionsForFace(surface, face)` flags to determine which sections render.

### CeilingTab

Content when `selectedFace === 'top'`:
- **TextureSwatchGrid** with `CEILING_MATERIALS` (3 items: Steel, Open, Plaster)
- **Lighting fixtures** — material card grid (`LIGHT_FIXTURES`: None, Pendant, Flush, Track, Recessed)
- **Light color** — shown only when a fixture other than 'none' is selected (`LIGHT_COLORS`: Warm White, Cool White, Daylight, Amber)
- **Color**

### ElectricalTab

Content when `selectedFace in ['n','s','e','w']`:
- **Electrical type grid** — `ELECTRICAL_TYPES` (None, Switch, Double Switch, Outlet, Dimmer) as dark card grid
- **Color**

When `selectedFace` is `top` or `bottom`, shows: "Electrical is available on wall faces. Click a wall in the preview above."

### TextureSwatchGrid

Shared primitive. 3-column CSS grid, gap 6px.

Props:
```ts
interface SwatchItem {
  id: string;
  label: string;
  color: string;           // fallback hex
  textureFolder?: string;  // maps to /assets/materials/{folder}/color.jpg
}

interface Props {
  items: SwatchItem[];
  activeId?: string;
  onSelect: (id: string, label: string) => void;
}
```

Each swatch button:
- 64×64px image area: `<img>` with `object-fit: cover` and `loading="lazy"` when `textureFolder` exists. On `onerror`, falls back to canvas swatch.
- Canvas fallback: base color fill + subtle per-pixel noise (±10 RGB). Generated once, cached in module-level `Map<string, string>`.
- Label below (fontSize 9, uppercase, `var(--text-dim)`)
- Active state: 2px accent border + subtle background tint
- Hover: border highlight
- Dark card styling matching concept art aesthetic

### textureThumbnail.ts

```ts
// Returns image src for a swatch item
function getSwatchSrc(item: SwatchItem): string | null
// Returns a canvas data URL with noise pattern for a hex color
function generateNoiseSwatch(id: string, hex: string, size?: number): string
```

Module-level `Map<string, string>` cache for generated data URLs. Canvas noise: iterate 64×64 pixels, parse base hex, add `Math.random() * 20 - 10` to each RGB channel clamped to 0-255.

### Texture-to-Preset Mapping

Added to `MaterialPreset` in `finishPresets.ts`:

| Preset ID | `textureFolder` | Source |
|-----------|-----------------|--------|
| `oak_wood` | `Deck_Wood` | `/assets/materials/Deck_Wood/color.jpg` |
| `concrete` | `Concrete` | `/assets/materials/Concrete/color.jpg` |
| `bamboo` | `Bamboo` | `/assets/materials/Bamboo/color.jpg` |
| `hinoki` | `Japanese_Cedar` | `/assets/materials/Japanese_Cedar/color.jpg` |
| `steel` | `Corrugated_Steel` | `/assets/materials/Corrugated_Steel/color.jpg` |
| `wood` | `Deck_Wood` | `/assets/materials/Deck_Wood/color.jpg` |
| `plaster` | `Plaster` | `/assets/materials/Plaster/color.jpg` |
| `tatami` | — | Canvas fallback `#C8D5A0` |
| `tile` | — | Canvas fallback `#E0D5C5` |

### Non-Material Swatches

Light fixtures, door styles, and electrical types use dark card format with:
- Color indicator dot (the preset's hex color, 16×16px circle)
- Icon (existing emoji or SVG if available)
- Label below

Not TextureSwatchGrid — these are functional choices, not surface materials. Separate `OptionCardGrid` component or inline styled buttons.

## VoxelPreview3D Changes

The existing `PreviewFace.onClick` currently calls `onCycle()` which cycles the surface type. This needs to also set the selected face:

**Current:** `onClick → setVoxelFace(containerId, voxelIndex, face, cycleSurface(...))`
**New:** `onClick → setSelectedFace(face)` (face selection only). Surface type changes move to the WallsTab surface type picker.

Right-click context menu behavior stays unchanged.

The `activeBrush` integration (click applies active brush) should be preserved: if `activeBrush` is set, click applies it AND selects the face. If no brush, click just selects.

## Sidebar Routing Change

**Current (Sidebar.tsx:505-513):**
```
selectedObjectId    → SkinEditor
voxel/bay           → WallTypePicker
face/bay-face       → FinishesPanel
else                → Container Properties
```

**New:**
```
selectedObjectId    → SkinEditor
voxel/bay/face/bay-face → FinishesPanel (new tabbed version)
else                → Container Properties
```

The new FinishesPanel handles both cases:
- `voxel/bay`: Shows VoxelPreview3D with no face selected. Tabs visible but disabled/empty until user clicks a face.
- `face/bay-face`: Shows VoxelPreview3D with face highlighted + auto-selected tab + finish content.

## Color System

**Universal Color picker** replaces the old "Interior Paint" section. Available on every tab as the last section.

Applies a `color` hex field to `FaceFinish`. The 3D renderer interprets this as a tint/multiply on the material. Uses the existing `SwatchRow` component (circle buttons for preset colors) + `ColorPicker` popup for custom hex.

Preset colors: the existing `PAINT_COLORS` array (14 colors: White through Carbon).

## Open Wall Fix

When a wall face has surface `Open`:
1. User clicks the face in VoxelPreview3D → face selected, Walls tab auto-opens
2. WallsTab shows the surface type picker at top
3. No finish sections below (because `getFinishOptionsForFace('Open', face)` returns all false)
4. User picks a surface type from the grid → `paintFace()` changes the surface
5. WallsTab reactively re-renders with finish options for the new surface

This eliminates the empty panel problem. The surface type picker is always visible on the Walls tab, making the path from Open → any surface discoverable.

## Styling

All new components follow the concept art dark-theme aesthetic:
- Panel background: `var(--surface-dark, #0f172a)`
- Card backgrounds: `var(--card-dark, #1e293b)`
- Borders: `1px solid var(--border-dark, #334155)`
- Text: `var(--text-main, #e2e8f0)` for primary, `var(--text-dim, #64748b)` for labels
- Active accent: `var(--accent, #3b82f6)` border + `var(--accent-bg, rgba(59,130,246,0.08))` fill
- Hover: `border-color` transition to accent
- Border radius: 6-8px on cards, 4px on swatches
- Tab bar: pills with rounded corners, accent highlight on active

## Testing Strategy

1. **Unit tests** for `textureThumbnail.ts`: canvas generation, cache behavior, fallback logic
2. **Unit tests** for tab auto-selection logic: face→tab mapping
3. **Integration tests**: FinishesPanel renders correct tab for each face direction
4. **Integration tests**: WallsTab shows surface picker when surface is Open, shows finishes when surface is non-Open
5. **Integration tests**: TextureSwatchGrid renders correct number of items, fires onSelect
6. **Existing tests**: `setFaceFinish`, `clearFaceFinish`, `paintFace` store actions — no changes needed

## Out of Scope

- Voxel configuration presets (deferred to next sprint)
- Standalone floating panel (stays in Sidebar)
- New PBR texture assets (uses existing `/assets/materials/` files)
- Changes to 3D material rendering pipeline
- Changes to store actions or data model (uses existing `FaceFinish`, `setFaceFinish`, `paintFace`)
