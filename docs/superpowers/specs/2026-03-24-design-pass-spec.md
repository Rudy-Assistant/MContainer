# Design Pass — UI Standardization & New Features

**Date**: 2026-03-24
**Status**: Approved
**Depends on**: Stream A bug fixes (debug/wireframe toggle, frame mode skin hiding, door flush offset)

## Overview

Six coordinated changes that unify the UI card system, add a Container tab, introduce ghost preview on hover, clean up the inspector, fix hotbar layout, and add multi-select to the block grid. Implementation order follows dependency chain: foundation components first, then features that consume them.

## Implementation Sequence

1. PresetCard + Isometric SVG system (foundation)
2. Container tab (new tab built on PresetCard)
3. Ghost preview on hover (interaction layer)
4. Inspector cleanup (removal pass)
5. Bottom hotbar layout (positioning + styling)
6. Multi-select in block grid (selection model)

## CSS Variable Additions

New variables required (add to both `:root` and `[data-theme="dark"]` in `globals.css`):

```css
/* Light mode */
:root {
  --accent-muted: rgba(37, 99, 235, 0.5);
}

/* Dark mode */
[data-theme="dark"] {
  --accent-muted: rgba(59, 130, 246, 0.5);
}
```

Existing variables used throughout this spec:
- `--surface` (card backgrounds)
- `--accent` (active borders)
- `--text-main` (primary text)
- `--text-muted` (secondary text)
- `--text-dim` (tertiary text)
- `--border` (inactive borders)

---

## 1. PresetCard Component + Isometric SVG System

### PresetCard

Shared card component replacing BlockTab buttons, OptionCardGrid, and TextureSwatchGrid.

**Props:**

```ts
interface PresetCardProps {
  content: ReactNode;       // SVG, texture <img>, or icon
  label: string;            // "Floor+Ceil", "Oak Planks", "Outlet"
  active: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}
```

**Styling:**

- Aspect ratio: 1 (square)
- Border radius: 6px
- Border: 2px solid `var(--accent)` when active, 2px solid transparent otherwise
- Background: `var(--surface)`
- No divider line between content area and label
- Label: 10px font, bottom-aligned, same background as card body
- Transition: `border-color 100ms`
- Grid: 3-column, 6px gap (replaces all current card grids)

### IsometricVoxelSVG (programmatic generator)

Single component that renders any block/container preset as an isometric cube.

**Props:**

```ts
interface IsometricVoxelSVGProps {
  faces: VoxelFaces;   // { top, bottom, n, s, e, w } → SurfaceType
  size?: number;        // default 64, rendered pixel size
}
```

**Rendering:**

- 60×60 internal SVG viewBox, rendered at `size` pixels (default 64px)
- Isometric cube showing 3 visible faces (top, front/south, right/east)
- Each face is a parallelogram filled by SurfaceType color

**SurfaceType → fill color mapping:**

| SurfaceType | Fill | Notes |
|-------------|------|-------|
| Open | `#e2e8f0` | Dashed stroke outline |
| Solid_Steel | `#64748b` | Slate |
| Glass_Pane | `#93c5fd` | Light blue, semi-transparent |
| Railing_Cable | `#94a3b8` | Grey, horizontal line pattern |
| Railing_Glass | `#7dd3fc` | Light sky blue, semi-transparent |
| Deck_Wood | `#8B6914` | Warm brown |
| Concrete | `#9ca3af` | Medium grey |
| Gull_Wing | `#78716c` | Stone, angled top edge |
| Half_Fold | `#78716c` | Stone, half-height face |
| Door | `#475569` | Dark slate, door handle mark |
| Stairs | `#6b7280` | Grey, diagonal tread lines |
| Stairs_Down | `#6b7280` | Grey, diagonal tread lines (reversed) |
| Wood_Hinoki | `#d4a574` | Pale blond cedar |
| Floor_Tatami | `#84a66f` | Grass green |
| Wall_Washi | `#faf5ef` | Off-white, translucent feel |
| Glass_Shoji | `#e8e8e8` | Frosted white |
| Window_Standard | `#93c5fd` | Same as Glass_Pane (steel frame implied by face geometry) |
| Window_Sill | `#93c5fd` | Same as Glass_Pane |
| Window_Clerestory | `#93c5fd` | Same as Glass_Pane |
| Window_Half | `#93c5fd` | Same as Glass_Pane |

**Fallback rule:** Any SurfaceType not in this table renders as `#cbd5e1` (light grey).

### IsometricItemSVG (hand-crafted)

Individual SVG components for electrical/fixture items that don't fit the cube model.

**Props:**

```ts
interface IsometricItemSVGProps {
  itemId: string;   // 'switch', 'outlet', 'dimmer', 'pendant', etc.
  size?: number;
}
```

Each item is a small hand-drawn isometric SVG: switch (wall plate with toggle), outlet (wall plate with two slots), dimmer (wall plate with slider), pendant (hanging fixture), etc.

### Usage

- Block tab: `<PresetCard content={<IsometricVoxelSVG faces={preset.faces} />} />`
- Electrical tab: `<PresetCard content={<IsometricItemSVG itemId="switch" />} />`
- Flooring/Walls/Ceiling tabs: `<PresetCard content={<img src={texture.thumbnail} />} />`

---

## 2. Container Tab

New first tab in FinishesPanel: `container | block | flooring | walls | ceiling | electrical`

### Layout (top to bottom)

1. **Container 3D Preview** — Adapted VoxelPreview3D showing full container. In Simple mode, shows multi-voxel bay as a group. Individual faces within the preview are hoverable/selectable for detailed edits without switching to Detail mode.

2. **Mode toggle icons:**
   - **⬡ Floor/Ceiling toggle**: Single Lucide icon (e.g., `Layers` / `SquareStack`) that cycles between Floor (default) and Ceiling state. Maps to the existing `inspectorView: 'floor' | 'ceiling'` state in uiSlice. Floor mode selects bottom horizontal faces on current level. Ceiling mode selects top horizontal faces on level+1 (rooftop), and context-switches the panel to show rooftop-relevant options (rooftop materials, ceiling fans, solar panels). Toggling only affects what future clicks select; it does not change the active selection.
   - **▣ Frame toggle**: Lucide wireframe cube icon (e.g., `Box`), on/off. Maps to existing `frameMode: boolean` in uiSlice. When ON: hides all voxel skins, shows only rails/poles. Floor/Ceiling toggle becomes disabled. Panel switches to frame material/shape options. When OFF: normal voxel view resumes.

3. **Container-level preset row** — 5 PresetCards in a single horizontal row using `gridTemplateColumns: 'repeat(5, 1fr)'` (overrides the default 3-column grid used elsewhere):
   - All Deck: walls open + railing, floor deck, no ceiling
   - Interior: all walls solid, floor deck, ceiling solid
   - N Deck: north walls open + railing, rest solid
   - S Deck: south walls open + railing, rest solid
   - Retract: retractable/fold walls config

   Each uses IsometricVoxelSVG showing a representative voxel of that config. Clicking applies the face config to every voxel in the container.

4. **Spatial voxel grid** — Named cells in spatial arrangement. The UI grid collapses the underlying 4-row voxel model (rows 0-3) into 3 display rows:

   ```
   Display Row 0 → Voxel Row 0 (extensions): NW Corner, N Deck 1–3, NE Corner
   Display Row 1 → Voxel Rows 1+2 (body):    W End, Bay 1–3, E End
   Display Row 2 → Voxel Row 3 (extensions):  SW Corner, S Deck 1–3, SE Corner
   ```

   In Detail mode, Display Row 1 expands into two sub-rows showing all 4 underlying voxel rows individually.

   Bay grouping in Simple mode: Bay 1 = voxels 10+11+18+19, Bay 2 = 12+13+20+21, Bay 3 = 14+15+22+23 (matching CLAUDE.md definition).

   Corners/ends: greyed-out, smaller text (extension voxels, only present when extensions exist). Selected cells: blue fill.

---

## 3. Ghost Preview on Hover

### Store

```ts
// uiSlice additions
ghostPreset: {
  source: 'block' | 'container';
  faces: VoxelFaces;
  targetScope: 'voxel' | 'bay' | 'container';
} | null;
setGhostPreset: (g: GhostPreset | null) => void;
clearGhostPreset: () => void;
```

### Trigger

- Block tab PresetCard `onMouseEnter` → `setGhostPreset({ source: 'block', faces, targetScope: 'voxel' })` (or `'bay'` in Simple mode)
- Container preset row `onMouseEnter` → `setGhostPreset({ source: 'container', faces, targetScope: 'container' })`
- `onMouseLeave` → `clearGhostPreset()`
- Also clears on: tab switch, panel close, preset click (after apply), sidebar collapse

### 3D Rendering — HoverPreviewGhost

Mounts as a sibling to ContainerSkin inside the per-container group in SceneCanvas.tsx. Conditionally rendered when `ghostPreset !== null` and the container matches the currently selected container (or all containers for container-scope ghosts).

**Scope behavior:**

- **Voxel**: Overlay currently selected voxel(s) with transparent faces matching preset
- **Bay**: Cover all voxels in the active bay group
- **Container**: Cover all voxels in container. **Smart constraint**: skip extension positions where an adjacent container exists — do not preview configurations that would collide with neighbors

**Ghost material:**

```
opacity: 0.35
transparent: true
depthWrite: false
color: tinted toward preset's dominant surface color
Pulse animation: opacity 0.25 ↔ 0.40, 800ms ease-in-out
```

### Existing patterns followed

Mirrors `facePreview`, `hoveredVoxel`, `hoveredVoxelEdge`, and `paintPayload` in uiSlice — reactive store → conditional scene graph rendering. Follows the same pattern as existing ghost rendering in SceneCanvas.tsx (drag ghost creates separate `<ContainerSkin ghostMode={true} />` instances).

---

## 4. Inspector Cleanup

### Remove

- Bay/Block toggle text labels (replaced by single mode icon)
- Legend section (color key for voxel states)
- Cable info text
- Scope text
- "Structural Presets" label above block preset grid

### Replace S/D toggle

Two separate `S` and `D` letter buttons → single toggle Lucide icon (e.g., `Grid2x2` / `Grid3x3`):

- Simple mode: grouped grid icon. Color: `var(--text-muted)`
- Detail mode: subdivided grid icon. Color: `var(--accent)`
- Single click toggles between states

Use Lucide icons (already imported in BlockTab.tsx) rather than Unicode symbols for consistent cross-platform rendering.

### Resulting header

```
Container 40ft HC    [bookmark][fullscreen][link][help][grid-toggle]
CONTAINER            [🔖] Synced
```

Five fewer text elements. Left panel becomes purely visual: preview, tabs, cards.

---

## 5. Bottom Hotbar Layout

### Responsive offset

```ts
// Read sidebar state from store (note: polarity is "collapsed", not "open")
const sidebarCollapsed = useStore(s => s.sidebarCollapsed);
const sidebarWidth = sidebarCollapsed ? 0 : 320;
const availableWidth = viewportWidth - sidebarWidth;
const centerX = sidebarWidth + (availableWidth / 2);

// style
left: centerX + 'px',
transform: 'translateX(-50%)'
```

Hotbar centers in remaining canvas area, never overlapping sidebar.

### Transparency increase

```
Current:  rgba(255, 255, 255, 0.92)   via var(--hotbar-bg)
New:      rgba(255, 255, 255, 0.15)
          backdrop-filter: blur(20px) saturate(1.4)
          border: 1px solid rgba(255, 255, 255, 0.12)
```

Update `--hotbar-bg` in globals.css to `rgba(255, 255, 255, 0.15)` (light) and corresponding dark mode value. Frosted glass whisper over the 3D scene.

### Remove icon dots

Colored dot indicators removed. Slot content (isometric SVG or color swatch) is sufficient identification.

### Readable text

```
Current:  8px uppercase monospace
New:      10px, fontWeight 500, var(--text-main)
          letterSpacing: 0.02em
          textShadow: 0 1px 3px rgba(0,0,0,0.3)
```

Regular weight, slightly larger, text-shadow for contrast. Key badges `[1]`...`[0]` preserved in same style.

---

## 6. Multi-Select in Block Grid

### Selection model — typed selection context

```ts
// Replaces selectedVoxel, selectedVoxels, selectedFace in selectionSlice

selectedElements: {
  type: ElementType;
  items: Array<{
    containerId: string;
    id: string;    // format varies by type, see table below
  }>;
} | null;

type ElementType =
  | 'frame'      // rails/poles (Frame mode only)
  | 'wall'       // vertical voxel faces
  | 'floor'      // bottom horizontal faces (Floor mode)
  | 'ceiling'    // top horizontal faces (Ceiling mode)
  | 'voxel'      // individual voxel (Detail mode)
  | 'bay'        // grouped voxels (Simple mode)
  | 'container'; // entire container
```

**Element ID format per type:**

| ElementType | `id` format | Example |
|-------------|-------------|---------|
| frame | Frame element key: `"l{level}r{row}c{col}_{corner}"` (pole) or `"r{row}c{col}_{h\|v}"` (rail) | `"l0r1c2_tfl"`, `"r1c2_h"` |
| wall | `"{voxelIndex}:{face}"` where face is n/s/e/w | `"10:n"`, `"14:w"` |
| floor | `"{voxelIndex}"` (bottom face implied) | `"10"`, `"18"` |
| ceiling | `"{voxelIndex}"` (top face implied, level+1) | `"10"`, `"18"` |
| voxel | `"{voxelIndex}"` | `"10"` |
| bay | Bay group ID from Simple mode mapping | `"bay1"`, `"nDeck2"` |
| container | Container ID | `"container-abc123"` |

### Type constraint

Structural: setting a new type clears all existing items. If 3 walls are selected and a floor face is clicked, walls clear and the floor becomes sole selection. No mixed-type selections.

### Interaction

| Action | Behavior |
|--------|----------|
| Click | Clear selection, select single element |
| Shift+Click | Range select: row-major order (left-to-right, top-to-bottom) within the spatial grid, from last-selected to clicked element, all same-type in between. Cross-container Shift+Click falls back to Ctrl+Click behavior. |
| Ctrl+Click | Toggle individual element. Must match active type. Different type → clear and start new |

### Cross-container

Items array holds `containerId` per element. Ctrl+Click Bay 2 in Container A, then Ctrl+Click Bay 2 in Container B → both selected. Bulk actions iterate all items.

### Mode gating

| Mode | Selectable types |
|------|-----------------|
| Frame ON | frame only |
| Frame OFF + Floor | floor, wall, bay, voxel, container |
| Frame OFF + Ceiling | ceiling, wall, bay, voxel, container |

### Migration plan

The following store fields are removed and replaced by `selectedElements`:

| Removed field | Replacement |
|---------------|-------------|
| `selectedVoxel: VoxelPayload \| null` | `selectedElements` with type `'voxel'` and single item |
| `selectedVoxels: { containerId, indices[] } \| null` | `selectedElements` with type `'bay'` and multiple items |
| `selectedFace: keyof VoxelFaces \| null` | `selectedElements` with type `'wall'`/`'floor'`/`'ceiling'` |

**New actions replacing old ones:**

| Old action | New action |
|-----------|------------|
| `setSelectedVoxel(payload)` | `setSelectedElements({ type: 'voxel', items: [{ containerId, id: String(index) }] })` |
| `setSelectedVoxels({ containerId, indices })` | `setSelectedElements({ type: 'bay', items: indices.map(i => ({ containerId, id: bayIdFromIndex(i) })) })` |
| `setSelectedFace(face)` | `setSelectedElements({ type: faceToType(face), items: [{ containerId, id: \`${voxelIndex}:${face}\` }] })` |
| `toggleVoxelInSelection(containerId, index)` | `toggleElement(containerId, id)` — adds/removes from items array, same-type constraint |
| `clearSelection()` | `setSelectedElements(null)` |

**Read adapter — `useSelectionTarget` hook** returns the same `{ containerId, indices, type }` shape by deriving from `selectedElements`:
- `type: 'voxel'` → `{ containerId, indices: [parseInt(id)], type: 'voxel' }`
- `type: 'bay'` → `{ containerId, indices: bayGroupToIndices(id), type: 'bay' }`
- `type: 'wall'` → `{ containerId, indices: [parseInt(id.split(':')[0])], type: 'face', face: id.split(':')[1] }`

Write call sites (at least `select()`, `selectObject()`, `copyVoxel()`, `pasteVoxel()`, `pasteToSelection()`) must be updated to use new actions. The implementation plan should inventory all write sites via grep for the removed field names.

### Visual feedback in grid

| State | Style |
|-------|-------|
| Single selected | 2px solid `var(--accent)`, filled bg |
| Multi-selected | 2px solid `var(--accent-muted)`, filled bg |
| Shift-hover range preview | 1px dashed `var(--accent)`, no fill |

---

## Key Architecture Decisions

1. **Hybrid SVG approach**: Programmatic `IsometricVoxelSVG` for all cube-based presets (block + container). Hand-crafted `IsometricItemSVG` for electrical items (switch, outlet, dimmer — unique shapes). Fallback color for unmapped SurfaceTypes.

2. **Typed selection context**: `selectedElements: { type, items[] }` enforces single-type constraint structurally. Type switch = automatic clear. Cross-container via containerId per item. Migration plan covers all write call sites.

3. **Mode toggles as Lucide icons**: Floor/Ceiling = single cycling icon mapping to `inspectorView`. Frame = on/off icon mapping to `frameMode`. S/D = single toggling icon. Compact, no text labels. Lucide icons for cross-platform consistency.

4. **Reuse existing store fields**: Floor/Ceiling toggle maps to `inspectorView`, Frame toggle maps to `frameMode`, sidebar offset reads `sidebarCollapsed`. No unnecessary new state.

## Domain Model Note: Simple vs Detail Mode

**Simple mode** groups granular voxels into aggregate "Bays" treated as single blocks in app logic and the Smart system. The VoxelPreview3D adapts to show multi-voxel bays, with individual faces still hoverable/selectable for detailed edits without activating Detail mode.

**Detail mode** exposes every individual voxel in the grid for direct manipulation.

The spatial grid layout maps to physical container positions. The UI collapses the underlying 4-row voxel model (rows 0-3) into 3 display rows:

```
Display Row 0 → Voxel Row 0:   NW Corner | N Deck 1-3 | NE Corner
Display Row 1 → Voxel Rows 1+2: W End    | Bay 1-3    | E End
Display Row 2 → Voxel Row 3:   SW Corner | S Deck 1-3 | SE Corner
```

In Detail mode, Display Row 1 expands into two sub-rows showing all 4 underlying voxel rows individually.

Bay groupings (Simple mode): Bay 1 = v10+11+18+19, Bay 2 = v12+13+20+21, Bay 3 = v14+15+22+23.

## Element Type Hierarchy

| Type | Description | When selectable |
|------|-------------|-----------------|
| Frame | Rails/rods grid surrounding voxels | Frame mode ON only |
| Wall | Vertical faces of voxels (N/S/E/W) | Frame mode OFF |
| Floor | Bottom horizontal faces | Floor mode (Frame OFF) |
| Ceiling | Top horizontal faces (level+1 rooftop) | Ceiling mode (Frame OFF) |
| Voxel | Individual voxel (all 6 faces) | Detail mode |
| Bay | Grouped voxels (Simple mode block) | Simple mode |
| Container | Entire container | Always |

Floor selects bottom faces on current level. Ceiling selects top faces on level+1 (rooftop) and context-switches panel options to rooftop-relevant items.

Frame mode is a full view switch — hides voxel skins, shows only structural frame (rails/poles). Floor/Ceiling distinction does not apply in Frame mode.
