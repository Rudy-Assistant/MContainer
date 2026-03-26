# Hotbar Absorption & Panel Restructure

## Context

The SmartHotbar (bottom bar) and Interior Finishes left panel have grown functionally redundant — both present structural/form options for container surfaces. The Hotbar shows Doors/Windows/Lights/Electrical in a horizontal carousel, while the Walls tab shows a flat grid of 14 surface types. Users must mentally bridge two separate UIs to accomplish one task (selecting a wall type and its finish).

This design consolidates all structural and finish selection into the left panel's existing tab system, using a unified Category → Variant → Finish hierarchy. The Hotbar becomes an optional power-user shortcut bar, hidden by default.

## Design

### 1. Unified Tab Pattern: Category → Variant → Finish

All three surface tabs (Flooring, Walls, Ceiling) adopt the same 3-level hierarchy:

**Level 1 — Category (structural type):** A grid of PresetCards showing what *kind* of surface element this is.

**Level 2 — Variant (specific model):** A grid of PresetCards showing the specific variant within the selected category. Each variant maps to a `SurfaceType` in the store.

**Level 3 — Finish (material + color):** Material texture swatches and color picker. Applied as `faceFinish` metadata on the selected face via the existing `useApplyFinish` hook (which calls `setFaceFinish` in voxelSlice).

#### Walls Tab Categories & Variants

| Category | Variants (SurfaceType mapping) |
|----------|-------------------------------|
| Wall | Steel (`Solid_Steel`), Concrete (`Concrete`), Washi (`Wall_Washi`), Shoji (`Glass_Shoji`), Glass (`Glass_Pane`), Half-Fold (`Half_Fold`), Gull-Wing (`Gull_Wing`) |
| Door | Single Swing (`Door`), Double Swing (`Door` + `doorStyle: 'double_swing'`), Barn Slide (`Door` + `doorStyle: 'barn_slide'`), Pocket Slide (`Door` + `doorStyle: 'pocket_slide'`), Bifold (`Door` + `doorStyle: 'bifold'`), French (`Door` + `doorStyle: 'french'`), Glass Slide (`Door` + `doorStyle: 'glass_slide'`), Shoji Screen (`Door` + `doorStyle: 'shoji'`) |
| Window | Standard (`Window_Standard`), Half (`Window_Half`), Sill (`Window_Sill`), Clerestory (`Window_Clerestory`) |
| Railing | Cable (`Railing_Cable`), Glass (`Railing_Glass`) |
| Stairs | *See Stairs note below* |
| Shelf/Cabinet | Placeholder category — future variants. Shows "Coming soon" state with no variants. |
| Open | Single variant — removes face (`Open`) |

**Stairs note:** Stairs are volumetric — they change `voxelType` to `'stairs'` and involve multi-voxel smart-stair logic in voxelSlice (`_smartStairChanges`, `stairPart`, `stairAscending`). They do NOT use the simple `paintFace` path. The Stairs category card triggers `setVoxelType(containerId, idx, 'stairs')` instead, which invokes the existing smart-stair placement system. The category card is present in the Walls tab for discoverability, but its application logic is distinct from other wall categories.

#### Flooring Tab Categories & Variants

| Category | Variants |
|----------|----------|
| Solid Floor | Wood (`Deck_Wood`), Tatami (`Floor_Tatami`), Hinoki (`Wood_Hinoki`), Concrete (`Concrete`) |
| Glass Floor | Transparent floor (`Glass_Pane`) |
| Open | Removes floor face (`Open`) |

Note: The "Deck" category from initial exploration is dropped — `Deck_Wood` is already under Solid Floor. Slatted deck styling is a finish/theme concern, not a structural category.

#### Ceiling Tab Categories & Variants

| Category | Variants |
|----------|----------|
| Solid Ceiling | Steel (`Solid_Steel`), Wood (`Deck_Wood`), Concrete (`Concrete`) |
| Skylight | Glass ceiling (`Glass_Pane`) — future: partial skylight variants |
| Open | Removes ceiling face (`Open`) |

Note: The existing ceiling material grid only has Steel and Open. This spec adds Wood, Concrete, and Glass as new ceiling variants. The ceiling category configs (`ceilingCategories.ts`) must define these, and the existing `getWallTypesForContext` / `WALL_TYPES` flat array is deprecated in favor of the new category configs.

### 2. PresetCard Visual Upgrade

Every selectable item at every level uses PresetCard. The image square is the ONLY element that receives visual effects. The text label sits below, always outside the frame.

**States:**

| State | Image | Text |
|-------|-------|------|
| Default | No border, no shadow | `color: --text-muted`, `font-weight: 400` |
| Hover | `transform: scale(1.04)`, `box-shadow: 0 6px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)` | `color: --text-main`, `font-weight: 600` |
| Selected | `box-shadow: 0 0 0 2.5px rgba(99,102,241,0.7), 0 0 16px rgba(99,102,241,0.2)`, check badge (indigo circle, top-right) | `color: --text-main`, `font-weight: 700` |

**Select animation — pop-then-shrink:**

Inject via a `<style>` tag in PresetCard (or a CSS module if the project adopts one). Inline styles cannot express `@keyframes`.

```css
@keyframes selectPop {
  0%   { transform: scale(1.04); }  /* from hover state */
  40%  { transform: scale(1.08); }  /* pop */
  100% { transform: scale(1.0);  }  /* settle */
}
```

Duration: 200ms, easing: ease-out. Triggered by adding `animation: selectPop 200ms ease-out` when transitioning from unselected to selected (track previous `active` prop via `useRef` to detect transition). The `<style>` tag is injected once, idempotently, on first PresetCard mount.

**Card content by level:**
- Categories: icon (emoji or SVG) centered in square
- Variants: material texture thumbnail or 3D preview render
- Colors: solid color swatch

### 3. Hotbar Changes

- **Hidden by default.** Visibility toggled via Settings dropdown (new toggle: "Hotbar").
- **When visible:** 10 slots mapped to keyboard 1-9, 0. Existing slot behavior unchanged.
- **Slot assignment UI is deferred.** Current FIXED_PRESETS array continues to define the 10 slots. User-assignable slots (drag/right-click) are a future feature.
- **No functional changes to hotbar internals.** SmartHotbar component stays intact, just wrapped in a visibility guard.
- Store: add `showHotbar: boolean` to `uiSlice`, default `false`. Settings toggle calls `toggleHotbar()`.

### 4. Shared Components

#### CategoryRow

New reusable component used by WallsTab, FlooringTab, CeilingTab:

```typescript
interface CategoryRowProps {
  categories: { id: string; icon: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}
```

Renders a grid of PresetCards for category selection. The selected category determines which variant grid appears below.

#### VariantGrid

Renders PresetCards for variants within a category. Clicking a variant applies the corresponding `SurfaceType` to the selected face(s).

```typescript
interface VariantGridProps {
  variants: { id: string; surfaceType: SurfaceType; label: string; thumbnail?: string }[];
  selected: SurfaceType | null;
  selectedCategory: string;  // scopes selection highlight to (category, surfaceType) pair
  onSelect: (surfaceType: SurfaceType, variantId: string) => void;
}
```

The `selectedCategory` prop ensures that a `SurfaceType` appearing in multiple categories (e.g., `Glass_Pane` under both Wall and Window) only highlights in the currently active category's grid.

### 5. Data Flow

**Standard wall/floor/ceiling faces (paintFace path):**
```
User clicks wall face in 3D
  → selectedFace = 'n' (or s/e/w)
  → FinishesPanel auto-switches to Walls tab
  → CategoryRow shows 7 categories
  → User selects "Door"
  → VariantGrid shows 8 door variants
  → User clicks "Barn Slide Door"
  → paintFace(containerId, voxelIndex, 'n', 'Door')
  → useApplyFinish applies { doorStyle: 'barn_slide' } via setFaceFinish
  → ContainerSkin re-renders with barn slide door geometry
  → Finish section shows door-specific options (material, color, handle style)
```

**Stairs (volumetric, different path):**
```
User selects "Stairs" category in Walls tab
  → VariantGrid shows stair variants (Standard, Down)
  → User clicks "Standard"
  → setVoxelType(containerId, voxelIndex, 'stairs')
  → Smart-stair system computes stairPart, stairAscending, _smartStairChanges
  → ContainerSkin re-renders with stair geometry
```

### 6. Tab Structure Changes

**Before:** Container | Block | Flooring | Walls | Ceiling | Elec.

**After:** Container | Block | Flooring | Walls | Ceiling | Elec.

Tab names stay the same. Internal content changes:

- **Flooring:** Add CategoryRow (Solid, Glass, Open) above existing material grid. Deprecate direct material-first layout.
- **Walls:** Replace flat 14-item surface grid with CategoryRow + VariantGrid. Absorb hotbar door/window items as variants under Door/Window categories. Deprecate `WALL_TYPES` flat array and `getWallTypesForContext`.
- **Ceiling:** Add CategoryRow (Solid, Skylight, Open) above existing material grid. Expand from 2 items to full category set.
- **Container, Block, Elec.:** No changes in this sprint.

### 7. Migration: Surface Types to Categories

The existing 14 surface types in the Walls tab flat grid map to categories as follows:

| Current flat item | → Category | → Variant |
|-------------------|-----------|-----------|
| 🔲 Solid Wall | Wall | Steel |
| 🪟 Glass Pane | Wall | Glass |
| ⬜ Window | Window | Standard |
| ▭ Half Window | Window | Half |
| ▤ Sill Window | Window | Sill |
| ═ Clerestory | Window | Clerestory |
| 🚪 Door | Door | Single Swing |
| ⫿ Cable Rail | Railing | Cable |
| ▯ Glass Rail | Railing | Glass |
| ▫ Open | Open | (single variant) |
| ▦ Shoji | Wall | Shoji |
| ▧ Washi | Wall | Washi |
| ⌐ Half Fold | Wall | Half-Fold |
| ⌃ Gull Wing | Wall | Gull-Wing |

Half-Fold and Gull-Wing are extension panel mechanisms. They live under the Wall category since they are wall surface variants (fold-out/fold-up panels).

### 8. Store State

New state in `uiSlice`:

```typescript
showHotbar: boolean;          // default: false
toggleHotbar: () => void;

selectedWallCategory: string | null;     // default: null (auto-detect from current face SurfaceType)
selectedFloorCategory: string | null;    // default: null
selectedCeilingCategory: string | null;  // default: null
setSelectedWallCategory: (cat: string | null) => void;
setSelectedFloorCategory: (cat: string | null) => void;
setSelectedCeilingCategory: (cat: string | null) => void;
```

**Behavior:**
- Category selection is ephemeral UI state (not undoable, not persisted). Only `paintFace` / `setFaceFinish` / `setVoxelType` calls are undoable.
- When a face is selected, the category auto-selects based on the face's current `SurfaceType` (e.g., `Door` → Door category, `Window_Half` → Window category).
- Switching to a different tab or deselecting clears the category to `null`.

## Scope

### In Scope
- Restructure Walls tab: CategoryRow → VariantGrid → Finish controls
- Restructure Flooring tab: add CategoryRow above existing materials
- Restructure Ceiling tab: add CategoryRow above existing materials
- Add Shelf/Cabinet category (placeholder — no 3D models, shows "Coming soon")
- PresetCard visual upgrade (hover scale+shadow, select glow+badge+pop animation)
- Hide Hotbar by default, add Settings toggle
- Shared CategoryRow and VariantGrid components
- Category-to-SurfaceType mapping configuration files
- Deprecate `WALL_TYPES` / `getWallTypesForContext` in favor of category configs

### Deferred
- New 3D models (spiral staircase, shelf variants, cabinet variants)
- Room Presets (multi-voxel + furniture templates under Block/Bay tab)
- Custom user-created presets/favorites
- Hotbar slot assignment UI (drag/right-click to assign slots)
- Drag-from-library-to-canvas workflow
- Theme-specific variant auto-switching

## Files to Modify

| File | Change |
|------|--------|
| `src/components/ui/finishes/PresetCard.tsx` | Add hover scale+shadow, select glow+badge+pop animation (inject `<style>` for keyframes), bold text states |
| `src/components/ui/finishes/WallsTab.tsx` | Replace flat surface grid with CategoryRow + VariantGrid. Add stairs-specific path. |
| `src/components/ui/finishes/FlooringTab.tsx` | Add CategoryRow above material grid |
| `src/components/ui/finishes/CeilingTab.tsx` | Add CategoryRow above material grid, expand variant set |
| `src/components/ui/finishes/CategoryRow.tsx` | New shared component |
| `src/components/ui/finishes/VariantGrid.tsx` | New shared component |
| `src/config/wallCategories.ts` | New config: category → variant → SurfaceType mappings (including all 8 door variants from doors.ts) |
| `src/config/floorCategories.ts` | New config: floor category definitions |
| `src/config/ceilingCategories.ts` | New config: ceiling category definitions |
| `src/store/slices/uiSlice.ts` | Add `showHotbar`, `toggleHotbar`, `selectedWallCategory`, `selectedFloorCategory`, `selectedCeilingCategory` + setters |
| `src/components/ui/SmartHotbar.tsx` | Wrap in visibility guard (`showHotbar`) |
| `src/components/ui/TopToolbar.tsx` | Add Hotbar toggle to Settings dropdown |
| `src/components/three/Scene.tsx` | Guard SmartHotbar render with `showHotbar` |

### 9. Ghost Previews

When a variant is selected in any surface tab, hovering over a valid face in 3D shows a ghost preview before committing.

**Wall/Floor/Ceiling variants (paintFace path):**
- Selecting a variant (e.g., Door > Barn Slide) sets `activeBrush` to the target `SurfaceType` and `stampPreview` with finish metadata.
- `HoverPreviewGhost.tsx` StampGhost renders a green-tinted overlay on the hovered face, sized correctly via `getVoxelLayout` (already fixed this sprint).
- Clicking commits the change; moving away clears the ghost.

**Block presets (stampArea path):**
- When a Block tab preset is hovered or selected, a ghost preview of the full voxel configuration follows the cursor over valid voxels.
- Ghost uses the existing `FlushGhostPreview` component (already renders in `ContainerSkin.tsx` for active voxels and `BaseplateCell` for inactive ones).
- Ghost color indicates validity: green = can apply, red = locked/invalid.

**Stairs:**
- Selecting a stair variant shows a wireframe/transparent stair ghost at the hovered voxel position.
- Uses existing `StairMesh` component rendered with ghost material (transparent, green-tinted).

**Category cards (no ghost):**
- Selecting a *category* (e.g., "Door") does NOT trigger a ghost — only selecting a specific *variant* within a category activates the brush/ghost system.

## Verification

1. **Walls tab:** Select wall face → see 7 category cards → click Door → see 8 door variant cards → click variant → face updates in 3D → finish controls appear below
2. **Flooring tab:** Select floor → see category row (Solid, Glass, Open) → select Solid → material grid appears → select material → floor updates
3. **Ceiling tab:** Same pattern as Flooring with ceiling-specific categories (Solid, Skylight, Open)
4. **Stairs:** Select Stairs category → click Standard → voxel converts to stair type with smart-stair logic
5. **PresetCard states:** Hover any card → scale+shadow+bold text. Click → pop-then-shrink animation → glow border + check badge. Text always outside frame.
6. **Hotbar:** Hidden by default. Settings → Hotbar toggle → bar appears. Keys 1-0 still work when visible.
7. **Ghost preview (wall variant):** Select Door > Barn Slide → hover over a wall face in 3D → green ghost overlay appears on that face → click → door applies.
8. **Ghost preview (block preset):** Hover a Block preset card → green ghost of full voxel config follows cursor over voxels → red ghost on locked voxels.
9. **Category auto-detect:** Select a face that already has a Door → Walls tab opens with Door category pre-selected.
10. **Regression:** Block tab unchanged. Container tab unchanged. Keyboard shortcuts still work. Only paintFace/setFaceFinish/setVoxelType calls are undoable (category selection is ephemeral).
