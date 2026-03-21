# Sims-Style UI Overhaul — Design Spec

## Problem

The current hotbar conflates structural wall types (Door, Window, Railing) with material finishes (Steel, Glass, Concrete) into a single flat list. No building game or design tool works this way. Users cannot:
- Select a wall and change its color/material independently of its structural type
- Configure door style (swing vs sliding), window tint, or frame color
- Add lighting fixtures or electrical outlets to faces

The four-tab bottom hotbar (Rooms | Surfaces | Materials | Furniture) is cramped, paginated, and fighting the left sidebar for the same responsibilities.

## Solution

Adopt the Sims 4 interaction model: separate **structural type** from **finish**. Consolidate all building actions into the left sidebar as contextual sections. Replace the bottom hotbar with a minimal recent-items strip.

## Architecture

### Layout Changes

**Left sidebar becomes the primary workspace.** The contextual area below the container grid and preview adapts based on what's selected:

| Selection State | Contextual Area Shows |
|---|---|
| Nothing selected | Container properties (Finish dropdown, Rooftop Deck, room assignment) |
| Voxel selected | Wall Type icon grid (structural types with thumbnails) |
| Wall face selected | Wall Finishes panel (exterior material, interior paint, electrical) |
| Window face selected | Window Options (frame color, glass tint) |
| Door face selected | Door Options (style: swing/sliding/barn, color) |
| Floor face selected | Flooring panel (material cards with texture previews) |
| Ceiling face selected | Ceiling panel (material, lighting fixture, light color) |

**Sidebar section order (top to bottom):**
1. **Header:** `← Library` / container name (toggle)
2. **Preview** (collapsible): 3D mini-view with container name overlay. "Hide Roof", "Hide Skin", save-to-library button, Synced badge remain visible even when collapsed.
3. **Container Grid** (collapsible): 8×4 VoxelGrid (MatrixEditor)
4. **Contextual Area** (scrollable, fills remaining space): content driven by selection state per table above

**Bottom bar transformation:**
- Replace four-tab SmartHotbar with a single-row recent-items strip
- Shows last 5-8 applied items (wall types + finishes) as icon+label chips
- Keyboard shortcuts 1-9 map to these slots
- BOM summary remains at right end

### Data Model

**Parallel `faceFinishes` on VoxelState** — non-breaking addition:

```ts
// NEW type in src/types/container.ts
interface FaceFinish {
  material?: string;      // 'steel' | 'wood' | 'concrete' | 'bamboo' | ...
  paint?: string;         // hex color for interior paint, null = no paint
  tint?: string;          // glass tint: 'clear' | 'smoke' | 'blue' | 'privacy'
  frameColor?: string;    // window/door frame hex color
  doorStyle?: string;     // 'swing' | 'sliding' | 'barn'
  light?: string;         // 'pendant' | 'flush' | 'track' | 'recessed' | 'none'
  lightColor?: string;    // 'warm' | 'cool' | 'daylight' | 'amber'
  electrical?: string;    // 'switch' | 'double_switch' | 'outlet' | 'dimmer' | 'none'
}

type FaceFinishes = Partial<Record<keyof VoxelFaces, FaceFinish>>;
```

Added to `Voxel` interface:
```ts
faceFinishes?: FaceFinishes;  // optional — absent = theme defaults
```

**Why parallel, not nested into VoxelFaces:**
- Zero changes to existing face-type logic (renderers, merge detection, BOM, validation, undo)
- `faceFinishes` is optional — all existing voxels work without migration
- Persist and zundo handle it automatically
- Default resolution: absent finish values fall back to active theme defaults

**SurfaceType cleanup:** The existing 20 `SurfaceType` values remain as structural type identifiers. No renaming needed — they already describe structure (`Door`, `Glass_Pane`, `Window_Standard`). The finish layer adds the material/color/style dimension that was previously missing.

### Wall Type Picker (Voxel Selected)

When a voxel is selected, the contextual area shows an icon grid of structural types — similar to the Sims 4 build catalog:

**Wall types (when inspector view = floor, selecting wall faces):**
| Icon | Label | SurfaceType |
|---|---|---|
| Solid wall | Solid Wall | `Solid_Steel` |
| Glass pane | Glass Pane | `Glass_Pane` |
| Window | Window | `Window_Standard` |
| Half window | Half Window | `Window_Half` |
| Sill window | Sill Window | `Window_Sill` |
| Clerestory | Clerestory | `Window_Clerestory` |
| Door | Door | `Door` |
| Railing (cable) | Cable Rail | `Railing_Cable` |
| Railing (glass) | Glass Rail | `Railing_Glass` |
| Open | Open | `Open` |
| Shoji | Shoji | `Glass_Shoji` |
| Washi | Washi Panel | `Wall_Washi` |

**Floor types (when inspector view = floor, selecting floor faces):**
Deck Wood, Concrete, Hinoki, Tatami, Open

**Ceiling types (when inspector view = ceiling):**
Steel, Open

Each icon is a small rendered thumbnail. Clicking applies the type to all wall faces of the selected voxel (like the current preset behavior). Face-specific application happens when a specific face is selected.

### Finishes Panel (Face Selected)

The finishes panel adapts to the current face's structural type. Each section below describes what appears for each type.

**Solid wall (`Solid_Steel`) finish options:**
- **Exterior Material:** Grid of material cards — Steel, Wood, Concrete, Bamboo (thumbnail + label). Maps to `faceFinishes.n.material`.
- **Interior Paint:** Color swatch grid (14 preset colors from concept art palette: warm whites, beiges, earth tones, greens, greys). Final swatch is [+] which opens inline color picker (hue strip + saturation square + hex input). Maps to `faceFinishes.n.paint`.
- **Electrical:** Icon row — Switch, Double Switch, Outlet, Dimmer, None. Maps to `faceFinishes.n.electrical`.

**Window (`Window_*`) finish options:**
- **Frame Color:** Swatch row — Black, White, Bronze, Natural, [+]. Maps to `faceFinishes.n.frameColor`.
- **Glass Tint:** Swatch row — Clear, Smoke, Blue, Privacy. Maps to `faceFinishes.n.tint`.

**Door (`Door`) finish options:**
- **Style:** Icon cards — Swing, Sliding, Barn. Maps to `faceFinishes.n.doorStyle`.
- **Color:** Swatch row — same as frame colors + [+]. Maps to `faceFinishes.n.frameColor`.

**Floor (`Deck_Wood`, `Concrete`, etc.) finish options:**
- **Flooring Material:** Larger cards with texture preview — Oak Wood Planks, Polished Concrete, Bamboo, Hinoki Cedar, Tatami, Tile. Maps to `faceFinishes.bottom.material`.

**Ceiling (`Solid_Steel`) finish options:**
- **Material:** Steel, Open, Plaster. Maps to `faceFinishes.top.material`.
- **Lighting:** Icon cards — Pendant, Flush Mount, Track, Recessed, None. Maps to `faceFinishes.top.light`.
- **Light Color:** Swatch row — Warm White, Cool White, Daylight, Amber. Maps to `faceFinishes.top.lightColor`.

**Electrical (wall faces only):**
- **Electrical:** Icon row — Switch, Double Switch, Outlet, Dimmer, None. Appears as a subsection for any wall face type.

**Inline color picker** (triggered by [+] swatch):
- Hue strip (horizontal rainbow gradient)
- Saturation/brightness square
- Hex input field
- Appears inline below the swatch row, not a modal

All changes apply immediately on click — Sims-style instant preview. No "apply" button.

### Recent Items Strip (Bottom Bar)

Replaces the current four-tab SmartHotbar entirely.

```
┌────────────────────────────────────────────────────────────┐
│  1:[Solid Wall] 2:[Glass] 3:[Oak Floor] 4:[Door] 5:[...]  │
│                                              BOM: $5,600   │
└────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Shows last 5-8 distinct items applied (wall types AND finishes, deduped)
- Each chip shows a small icon + label
- Keyboard 1-9 applies that recent item to the current selection
- Clicking a chip applies it to the current selection
- List updates automatically as user works (MRU order)
- BOM summary at right end (existing BomBar component)

**What moves out of the hotbar:**
- Rooms → contextual area when nothing selected (room assignment dropdown)
- Surfaces → Wall Type icon grid in sidebar
- Materials → Finishes panel in sidebar
- Furniture → Library view with Furniture category filter

### Rendering Changes

**FaceFinish → Material mapping:** The `ContainerSkin.tsx` renderer currently picks materials from `_themeMats` based on `SurfaceType`. With `faceFinishes`, the renderer needs an additional lookup:

```
getMaterialForFace(surfaceType, faceFinish, theme):
  if faceFinish?.material → resolve material from materialCache by name
  if faceFinish?.paint → clone base material, set color to paint hex
  else → use theme default material for surfaceType (existing behavior)
```

**Lighting fixtures:** When `faceFinish.top.light` is set, render a procedural light fixture mesh at the voxel ceiling center. Types:
- `pendant`: cylinder + cone hanging from ceiling
- `flush`: flat disc on ceiling
- `track`: rail with 3 spot cones
- `recessed`: circular cutout with inset light
- Each fixture also creates a `SpotLight` or `PointLight` in the scene

**Electrical:** When `faceFinish.{n|s|e|w}.electrical` is set, render a small procedural mesh on the wall face (switch plate, outlet plate). Visual only — no functional wiring.

**Door style:** `faceFinish.doorStyle` overrides the existing `doorConfig` mechanism. `swing` = hinged (existing), `sliding` = pocket door (existing), `barn` = new track-mounted style.

### Store Actions (New)

```ts
// In voxelSlice:
setFaceFinish: (containerId: string, voxelIndex: number, face: keyof VoxelFaces, finish: Partial<FaceFinish>) => void;
clearFaceFinish: (containerId: string, voxelIndex: number, face: keyof VoxelFaces) => void;

// In uiSlice:
recentItems: RecentItem[];  // MRU list of applied items
addRecentItem: (item: RecentItem) => void;
previewCollapsed: boolean;
setPreviewCollapsed: (v: boolean) => void;
gridCollapsed: boolean;
setGridCollapsed: (v: boolean) => void;
```

### Migration

No data migration needed. Existing voxels have no `faceFinishes` field — the renderer treats this as "use theme defaults." New finishes are additive. Undo/redo captures `faceFinishes` changes via zundo automatically.

### Testing

- Unit tests for `getMaterialForFace` resolution (finish overrides theme default)
- Unit tests for `setFaceFinish` / `clearFaceFinish` store actions
- Unit tests for `FaceFinish` defaults (absent = theme default)
- Unit tests for recent items MRU behavior
- Existing face-type tests remain unchanged (parallel data, no interference)
- Anti-pattern tests: selector stability for new selectors

### Files Affected

**New files:**
- `src/components/ui/WallTypePicker.tsx` — icon grid for structural types
- `src/components/ui/FinishesPanel.tsx` — contextual finishes UI
- `src/components/ui/RecentItemsBar.tsx` — bottom recent-items strip
- `src/components/ui/ColorPicker.tsx` — inline hue/saturation picker
- `src/components/ui/LightFixture.tsx` — procedural 3D light fixture meshes
- `src/components/ui/ElectricalPlate.tsx` — procedural wall switch/outlet meshes

**Modified files:**
- `src/types/container.ts` — add `FaceFinish`, `FaceFinishes` types, add `faceFinishes?` to `Voxel`
- `src/store/slices/voxelSlice.ts` — add `setFaceFinish`, `clearFaceFinish` actions
- `src/store/slices/uiSlice.ts` — add `recentItems`, `previewCollapsed`, `gridCollapsed`
- `src/components/ui/Sidebar.tsx` — restructure Inspector to collapsible Preview + Grid + contextual area
- `src/components/ui/MatrixEditor.tsx` — make independently collapsible
- `src/components/objects/ContainerSkin.tsx` — read `faceFinishes`, resolve materials, render fixtures
- `src/config/materialCache.ts` — add `getMaterialForFace()` resolver

**Removed files:**
- `src/components/ui/SmartHotbar.tsx` — replaced by sidebar contextual area + RecentItemsBar

**Deprecated but kept temporarily:**
- `src/hooks/useHotbarAutoSwitch.ts` — auto-switch logic moves into sidebar contextual rendering
