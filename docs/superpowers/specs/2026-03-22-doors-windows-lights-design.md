# Doors, Windows & Lights — Unified Placeable Object System

**Date**: 2026-03-22
**Status**: Design
**Scope**: Form+Skin object model, catalog UI, placement flow, rendering, state management, migration

## Overview

Replace the current face-property approach to doors, windows, and lights with a **unified placeable object system**. Every placeable item — doors, windows, lights, electrical fixtures, and eventually furniture — follows the same model: pick a **Form** (structural shape) from a catalog, place it in 3D, then customize its **Skin** (materials, colors, finishes).

This is driven by two principles:
1. **Form+Skin separation** — inspired by 3D-printed container home accessories, where you print the Form then finish the Skin independently.
2. **Sims 4 Build Mode UX** — catalog browsing, click-to-place, property panel customization.

### Key Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Placement model | Object-on-face (not face replacement) | Allows sub-face positioning, mixed arrangements, richer catalog |
| Light/electrical model | Everything is a placeable object | Unified system; kill FaceFinish.light/electrical path |
| Wall cutting | Visual framing illusion | Form geometry includes wall surround; no runtime CSG |
| Sub-face positioning | 3-slot horizontal grid per face | Balance of flexibility and structure |
| Architecture | Unified Scene Graph (Approach C) | One SceneObject system for all placeable items |
| Catalog depth | Category tabs + style filter | 27 forms, 17 styles, ~45 materials |
| Panel layout | Dual-panel (bottom bar + left panel) | Bottom = Form catalog, Left = Skin editor |
| Hotbar integration | Deferred | Depends on broader panel layout sprint |

---

## 1. Form+Skin Object Model

### Core Types

```typescript
interface FormDefinition {
  id: string;                          // "door_barn_slide"
  category: FormCategory;              // "door" | "window" | "light" | "electrical"
  name: string;                        // "Barn Slide Door"
  description: string;
  styles: StyleId[];                   // ["industrial", "rustic"]
  anchorType: AnchorType;              // "face" | "floor" | "ceiling"
  slotWidth: 1 | 2 | 3;               // sub-face slots consumed (face-anchored only)
  dimensions: { w: number; h: number; d: number }; // bounding box in meters
  skinSlots: SkinSlot[];               // customizable regions
  defaultSkin: Record<string, string>; // { frame: "raw_steel", glass: "clear" }
  geometry: "procedural" | "glb";
  glbPath?: string;                    // if geometry = "glb"
  costEstimate: number;                // base cost for BOM
  constraints?: FormConstraints;
}

interface SkinSlot {
  id: string;             // "frame"
  label: string;          // "Frame"
  materialOptions: string[]; // valid material IDs for this slot
}

interface FormConstraints {
  requiresExteriorFace?: boolean;
  minClearanceBelow?: number;    // meters
  incompatibleWith?: string[];   // other formIds
}

type FormCategory = "door" | "window" | "light" | "electrical";
type AnchorType = "face" | "floor" | "ceiling";

// Wall face directions only — top/bottom are not valid for object placement
type WallDirection = "n" | "s" | "e" | "w";

type StyleId =
  | "modern" | "industrial" | "japanese" | "desert_brutalist"
  | "coastal" | "noir_glass" | "solarpunk" | "frontier_rustic"
  | "retro_capsule" | "neo_tropical" | "cyberpunk" | "maker_raw"
  | "art_deco" | "arctic_bunker" | "terra_adobe" | "memphis_pop"
  | "stealth";

type StyleEffectType =
  | "patina_tint" | "paper_glow" | "heat_shimmer" | "salt_frost"
  | "reflection_tint" | "moss_glow" | "ember_warmth" | "soft_bloom"
  | "dappled_light" | "edge_glow" | "layer_lines" | "gold_gleam"
  | "frost_rim" | "clay_warmth" | "color_punch" | "matte_absorb";
```

> **Note on `freestanding`**: Removed from AnchorType. When furniture arrives, it will
> use `"floor"` anchor with `offset` for positioning. No distinct freestanding type needed.

```typescript
interface SceneObject {
  id: string;                          // uuid
  formId: string;                      // references FormDefinition
  skin: Record<string, string>;        // slot overrides { frame: "matte_black" }
  anchor: ObjectAnchor;
  state?: Record<string, unknown>;     // runtime: door open/closed, light brightness
}

interface ObjectAnchor {
  containerId: string;
  voxelIndex: number;
  type: AnchorType;
  face?: WallDirection;    // for wall-mounted (n/s/e/w only)
  slot?: number;           // 0 | 1 | 2 sub-face position
  offset?: [number, number]; // for floor/ceiling fine positioning
}
```

### Sub-Face Grid

Each wall face divides into 3 horizontal slots:

```
 +----------+----------+----------+
 |  slot 0  |  slot 1  |  slot 2  |
 |  (left)  | (center) | (right)  |
 +----------+----------+----------+
          2.44m voxel face
```

- Standard door (slotWidth=2): placed at slot 0-1 or slot 1-2
- Narrow window (slotWidth=1): any single slot
- Wide picture window (slotWidth=3): fills entire face
- Empty slots render the base wall SurfaceType

> **Sub-face grid applies to standard wall faces only** (n/s/e/w on body and extension
> voxels). Actual face width varies by orientation and voxel position. The 3-slot
> division is proportional (each slot = 1/3 of actual face width), not fixed to 2.44m.

### Floor/Ceiling Object Collision

Floor and ceiling anchored objects (lamps, lights) use bounding-box collision
based on `FormDefinition.dimensions`. Two objects cannot overlap:

```typescript
function canPlaceFloorObject(form: FormDefinition, anchor: ObjectAnchor, existing: SceneObject[]): boolean {
  // Check bounding box overlap using form.dimensions + anchor.offset
  // against all existing floor objects in the same voxel
}
```

---

## 2. Form Catalog

### Registry

```typescript
// src/config/formRegistry.ts
const formRegistry: Map<string, FormDefinition> = new Map();

// Query helpers
function getByCategory(cat: FormCategory): FormDefinition[];
function getByStyle(style: StyleId): FormDefinition[];
function getByCategoryAndStyle(cat: FormCategory, style: StyleId): FormDefinition[];
```

Static data, not in the Zustand store. Built from typed definition files per category.

### Doors (8 Forms)

| ID | Slots | Styles | Skin Slots |
|---|---|---|---|
| `door_single_swing` | 2 | all | frame, panel, handle |
| `door_double_swing` | 3 | all | frame, panel, handle |
| `door_barn_slide` | 2 | industrial, rustic | frame, panel, track |
| `door_pocket_slide` | 2 | modern, japanese | frame, panel |
| `door_bifold` | 3 | modern | frame, panel, handle |
| `door_french` | 3 | classic, rustic | frame, glass, handle |
| `door_glass_slide` | 2 | modern, noir_glass | frame, glass, track |
| `door_shoji` | 2 | japanese | frame, paper |

### Windows (7 Forms)

| ID | Slots | Styles | Skin Slots |
|---|---|---|---|
| `window_standard` | 1 | all | frame, glass, sill |
| `window_picture` | 3 | modern, noir_glass | frame, glass |
| `window_half` | 1 | all | frame, glass, wall |
| `window_clerestory` | 1 | modern, industrial | frame, glass |
| `window_porthole` | 1 | industrial, coastal, stealth | frame, glass |
| `window_shoji_screen` | 2 | japanese | frame, paper |
| `window_double_hung` | 1 | classic, rustic, frontier | frame, glass, sill |

### Lights (8 Forms)

| ID | Anchor | Styles | Skin Slots |
|---|---|---|---|
| `light_pendant` | ceiling | all | fixture, cord |
| `light_flush_mount` | ceiling | modern, industrial | fixture |
| `light_track` | ceiling | modern, industrial | track, heads |
| `light_recessed` | ceiling | modern, noir_glass | trim |
| `light_wall_sconce` | face | all | fixture, shade |
| `light_strip_led` | face | modern, cyberpunk, noir_glass | housing |
| `light_floor_lamp` | floor | all | base, shade |
| `light_table_lamp` | floor | all | base, shade | *

> \* `light_table_lamp` uses floor anchor as simplification. When furniture surfaces
> are added, table lamps will gain a `"surface"` anchor type for placement on tables/shelves.

### Electrical (4 Forms)

| ID | Anchor | Styles | Skin Slots |
|---|---|---|---|
| `electrical_outlet` | face | all | plate |
| `electrical_switch` | face | all | plate |
| `electrical_dimmer` | face | all | plate |
| `electrical_usb_outlet` | face | modern, cyberpunk, retro | plate |

---

## 3. Style Taxonomy (17 Styles)

Each style defines default materials for common skin slots, visual effects, and which forms it's compatible with.

```typescript
interface StyleDefinition {
  id: StyleId;
  label: string;
  description: string;
  defaultMaterials: Record<string, string>; // skinSlot → materialId
  defaultWallSurface: SurfaceType;
  effects: StyleEffect[];
  // NOTE: No compatibleForms here. FormDefinition.styles is the single source of
  // truth. Use getByStyle(styleId) to derive compatible forms at query time.
}

interface StyleEffect {
  type: StyleEffectType;
  targets?: string[];     // "sun_facing", "exterior", "edges", etc.
  color?: string;
  intensity?: number;
}

// Quick skin presets — 5 per style, each defines all skin slots at once
interface QuickSkinPreset {
  id: string;             // "industrial_dark"
  styleId: StyleId;
  label: string;          // "Dark Industrial"
  slots: Record<string, string>; // { frame: "matte_black", glass: "smoked_glass", ... }
}
```

### Style Definitions

#### Modern Minimal
- **Materials**: white matte, light oak, clear glass, brushed aluminum
- **Shapes**: clean rectangles, flush frames, hidden hardware
- **Effects**: none
- **Vibe**: Scandinavian showroom, everything aligned and quiet

#### Industrial Raw
- **Materials**: raw steel, exposed weld seams, wire mesh, concrete
- **Shapes**: riveted frames, cage fixtures, barn track hardware
- **Effects**: `patina_tint` — rust-orange wash on steel surfaces
- **Vibe**: converted warehouse, nothing hides what it's made of

#### Japanese Wabi
- **Materials**: hinoki cypress, rice paper (washi), dark iron, tatami
- **Shapes**: shoji lattice grids, curved lantern forms, sliding panels
- **Effects**: `paper_glow` — soft light diffusion through washi surfaces
- **Vibe**: ryokan stillness, asymmetric balance, natural imperfection

#### Desert Brutalist
- **Materials**: raw concrete, oxidized copper, sand-blasted steel, terracotta
- **Shapes**: massive slab frames, deep-set openings, chamfered edges
- **Effects**: `heat_shimmer` — subtle emissive warmth on sun-facing surfaces
- **Vibe**: Marfa Texas compound, heavy forms in bright light

#### Coastal Drift
- **Materials**: bleached wood, rope-wrapped hardware, sea glass, white-wash steel
- **Shapes**: porthole windows, louvered panels, rounded corners
- **Effects**: `salt_frost` — faint white edge weathering on exterior surfaces
- **Vibe**: shipping container turned beach house, wind-worn and sun-faded

#### Noir Glass
- **Materials**: smoked glass, polished black steel, dark mirror, gunmetal
- **Shapes**: frameless panels, flush-mount everything, knife-edge trim
- **Effects**: `reflection_tint` — environment map boost on glass surfaces
- **Vibe**: luxury penthouse in a box, everything reflects everything

#### Solarpunk
- **Materials**: bamboo composite, recycled copper, living wall panels, cork
- **Shapes**: organic curves, hexagonal light fixtures, vine-frame windows
- **Effects**: `moss_glow` — green-tinted ambient on living surfaces at night
- **Vibe**: optimistic post-industrial, tech and nature fused

#### Frontier Rustic
- **Materials**: reclaimed barn wood, wrought iron, amber glass, leather straps
- **Shapes**: arched window tops, forged hinges, lantern fixtures, X-brace doors
- **Effects**: `ember_warmth` — warm orange point light bleed from fixtures
- **Vibe**: mountain cabin in a container, handmade and heavy

#### Retro Capsule
- **Materials**: powder-coated pastels, chrome, frosted acrylic, white laminate
- **Shapes**: rounded-rect windows, bubble lights, toggle switches, pill doors
- **Effects**: `soft_bloom` — gentle glow halo around light fixtures
- **Vibe**: 1960s space station meets Airstream trailer

#### Neo-Tropical
- **Materials**: dark teak, woven rattan, palm fiber, blackened brass
- **Shapes**: slatted louver panels, wide overhang frames, pendant baskets
- **Effects**: `dappled_light` — shadow pattern overlay simulating leaf canopy
- **Vibe**: Bali villa distilled into a steel box

#### Cyberpunk Edge
- **Materials**: carbon fiber, neon-edge acrylic, dark chrome, perforated steel
- **Shapes**: angular cuts, LED-strip-integrated frames, honeycomb grilles
- **Effects**: `edge_glow` — colored emissive strips along frame edges
- **Vibe**: near-future container pod, every surface has a light strip

#### Maker Raw
- **Materials**: 3D-printed PLA/PETG, laser-cut plywood, anodized aluminum, acrylic
- **Shapes**: parametric lattice patterns, living-hinge curves, bolt-on brackets
- **Effects**: `layer_lines` — visible print texture on 3D-printed surfaces
- **Vibe**: the container home that knows it was built in a fab lab

#### Art Deco Revival
- **Materials**: polished brass, black lacquer, fluted glass, marble composite
- **Shapes**: sunburst window grilles, stepped door frames, fan-light transoms
- **Effects**: `gold_gleam` — specular highlight bias toward warm gold on brass
- **Vibe**: 1920s ocean liner stateroom compressed into a container

#### Arctic Bunker
- **Materials**: white powder-coat, frosted polycarbonate, titanium grey, cork insulation
- **Shapes**: triple-pane deep-set windows, pressure-seal doors, recessed everything
- **Effects**: `frost_rim` — icy blue-white edge glow on exterior frames at night
- **Vibe**: polar research station, everything sealed tight and glowing from within

#### Terra Adobe
- **Materials**: sun-baked clay, lime wash, hand-forged iron, mesquite wood, ceramic tile
- **Shapes**: arched doorways, deep window niches, scalloped light fixtures, heavy studs
- **Effects**: `clay_warmth` — subsurface scattering approximation on adobe surfaces
- **Vibe**: Santa Fe meets shipping container, thick walls and warm shadows

#### Memphis Pop
- **Materials**: bold primary laminates, terrazzo, pastel steel, squiggle wire
- **Shapes**: asymmetric window splits, triangle transoms, zigzag door panels, orb lights
- **Effects**: `color_punch` — saturation boost on primary-colored surfaces
- **Vibe**: Ettore Sottsass designed a container home, playful and unapologetic

#### Stealth Military
- **Materials**: matte OD green, cerakote dark earth, diamond plate, ballistic nylon mesh
- **Shapes**: narrow slit windows, blast-shutter doors, caged lights, flip-switch panels
- **Effects**: `matte_absorb` — near-zero specular, envMapIntensity crushed to 0.05
- **Vibe**: forward operating base, every opening is defensible

---

## 4. Materials Library (~45 materials)

```typescript
interface MaterialOption {
  id: string;
  label: string;
  color: string;           // hex
  metalness: number;
  roughness: number;
  applicableTo: string[];  // valid skin slot IDs
}
```

### Metals
raw_steel, brushed_aluminum, matte_black, gunmetal, polished_chrome, dark_chrome, oxidized_copper, blackened_brass, wrought_iron, anodized_aluminum, carbon_fiber, polished_brass, titanium_grey, diamond_plate, cerakote_dark_earth

### Woods
light_oak, warm_oak, walnut, hinoki_cypress, bleached_wood, reclaimed_barn, dark_teak, laser_cut_plywood, bamboo_composite, mesquite_wood

### Glass
clear_glass, frosted_glass, smoked_glass, bronze_tint, sea_glass, neon_edge_acrylic, fluted_glass, frosted_polycarbonate

### Mineral
concrete_grey, raw_concrete, terracotta, cork, sand_blasted_steel, sun_baked_clay, marble_composite, terrazzo, ceramic_tile

### Textile
rice_paper_washi, woven_rattan, palm_fiber, leather, ballistic_nylon

### Synthetic
white_laminate, black_lacquer, powder_coat_white, powder_coat_sage, powder_coat_coral, powder_coat_sky, powder_coat_mustard, powder_coat_blush, pla_white, pla_grey, pla_black, painted_white, painted_sage, matte_od_green, pastel_steel

---

## 5. Dual-Panel UI

### Layout

```
+----------------------------------------------------------+
|  [Toolbar]  Rotate Delete Group Ungroup ...  [BP 3D FP]  |
+--------+-------------------------------------------------+
|Interior|                                                  |
|Finishes|              3D Viewport            [Ext/Int]    |
|        |                                                  |
|Context-|                                                  |
|sensitive                                                  |
|left    |                                                  |
|panel   |     +------------------------------+             |
|        |     | Doors | Windows |Lights|Elec |             |
|        |     |  <  [card] [card] [card]  >  |             |
|        |     +------------------------------+             |
+--------+-------------------------------------------------+
| BOM  Flooring $2,500  Walls $3,000  Lighting $1,200      |
+----------------------------------------------------------+
```

- **Bottom bar**: Form catalog — category tabs, horizontal card carousel, style filter pills
- **Left panel**: context-sensitive Skin editor
- **Bottom status bar**: BOM breakdown, container info, time/sun, cost tier

### Bottom Bar — Form Catalog

- Category tabs: Doors | Windows | Lights | Electrical | More...
- Horizontal carousel of Form cards (scroll or arrow-navigate)
- Style filter pills along the bottom (horizontally scrollable, multi-select)
- Cards show: silhouette icon, name, cost dots
- Thumbnails render in active theme's default Skin
- Click card = enter placement mode (ghost preview on cursor)
- Collapses to thin tab strip when not in use

### Left Panel — Context-Sensitive Skin Editor

**Nothing selected**: Surface browser (Flooring | Walls | Lighting tabs, material thumbnail grid)

**Placed object selected**: Skin customization
- Form name + active style label
- Dropdown per skin slot (filtered to compatible materials)
- Quick skins row (5 theme presets, one click to retheme whole object)
- Form-specific state controls:
  - Doors: state (closed/open), flip direction
  - Lights: brightness slider (0-100%), color temp slider (warm-cool), "on at night only" toggle
- Duplicate / Remove buttons

### Placement Flow

1. User clicks Form in bottom bar catalog
2. Cursor enters placement mode — ghost preview follows cursor
3. Ghost snaps to nearest valid sub-face slot on hover
4. Green tint = valid placement, red tint = blocked
5. Click to place — SceneObject created with theme default Skin
6. Ghost stays active for multi-place (click again for another)
7. Escape or right-click exits placement mode
8. Clicking existing placed object (outside placement mode) selects it, left panel shows Skin editor

### Panel Interaction

```
Bottom bar click (Form)          Left panel click (Skin)
        |                                |
        v                                v
  Enter placement mode            Apply to selection
  Ghost follows cursor            Update material/color
  Click surface -> place          Live preview in 3D
        |
        v
  Auto-select new object
  Left panel switches to
  Skin editor for it
```

---

## 6. State Management

### Store Slice — sceneObjectSlice

```typescript
// Top-level in Zustand store
interface SceneObjectSlice {
  sceneObjects: Record<string, SceneObject>;

  // Actions
  placeObject: (formId: string, anchor: ObjectAnchor, skinOverrides?: Record<string, string>) => string;
  removeObject: (objectId: string) => void;
  updateSkin: (objectId: string, slotId: string, materialId: string) => void;
  applyQuickSkin: (objectId: string, presetId: string) => void;
  updateState: (objectId: string, key: string, value: unknown) => void;
  moveObject: (objectId: string, newAnchor: ObjectAnchor) => void;
  duplicateObject: (objectId: string, newAnchor: ObjectAnchor) => void;
}

  // Cascade: called by removeContainer in containerSlice
  removeObjectsByContainer: (containerId: string) => void;
}

// Derived selectors (pure functions, no duplicated state)
function getObjectsByContainer(containerId: string): SceneObject[];
function getObjectsOnFace(containerId: string, voxelIndex: number, face: WallDirection): SceneObject[];
function getOccupiedSlots(containerId: string, voxelIndex: number, face: WallDirection): Set<number>;
function getObjectsByCategory(category: FormCategory): SceneObject[];
```

> **Slot occupancy is derived, not stored.** `getOccupiedSlots` computes which slots
> are taken by filtering `sceneObjects` by anchor. No `occupiedSlots` field on
> `VoxelFaces` or `Voxel` — single source of truth is the `sceneObjects` map.

### Store Location

`sceneObjects` lives at the top level of the Zustand store, not nested per-container. Lookup by container uses derived selectors that filter by `anchor.containerId`.

### Middleware

Follows existing stack: `immer (inner) -> zundo -> persist (outer)`
- immer: mutations via draft
- zundo: undo/redo covers place/remove/skin changes
- persist: sceneObjects serialized to idb-keyval
- zod: SceneObject schema validation on hydration

**Required wiring:**
- Add `sceneObjects` to `temporal.partialize` (alongside `containers`, `zones`, `furnitureIndex`)
- Add `sceneObjects` to `persist.partialize`
- Add `SceneObjectSchema` to `persistedStateSchema.ts`
- Add `schemaVersion: number` to persisted state (start at `2`; current implicit version is `1`)
- Migration guard: check `schemaVersion` on hydration; if `1`, run `migrateToSceneObjects`; if `2`, skip

### Voxel Face Coordination

When a face-anchored object is placed/removed:

**placeObject**:
1. Validate: check `getOccupiedSlots` — enough free slots for slotWidth?
2. Create SceneObject in sceneObjects map
3. Invalidate render
(No voxel mutation needed — occupancy is derived from sceneObjects)

**removeObject**:
1. Read anchor from SceneObject
2. Delete from sceneObjects map
3. Invalidate render
(Wall re-appears automatically — it was always rendering behind the object)

### Migration from Current Systems

| Current | New |
|---|---|
| `VoxelFaces.n = "Door"` | `SceneObject { formId: "door_single_swing", anchor.face: "n" }` |
| `DoorConfig` on VoxelState | `SceneObject.state { openState, swingDir }` |
| `DoorConstraints` | `FormDefinition.constraints` |
| `FaceFinish.light` | `SceneObject { formId: "light_*", anchor.type: "ceiling" }` |
| `FaceFinish.lightColor` | `SceneObject.skin { fixture: "warm" }` |
| `FaceFinish.electrical` | `SceneObject { formId: "electrical_*" }` |
| `FaceFinish.doorStyle` | Encoded in `FormDefinition.id` |
| `FaceFinish.frameColor` | `SceneObject.skin.frame` |
| `FaceFinish.tint` | `SceneObject.skin.glass` |
| `LightPlacement[]` per container | `SceneObject` with `anchor.type: "ceiling"` |
| `InteriorLights` component | Unified `SceneObjectRenderer` |

One-time hydration transform: read old format -> create SceneObjects -> delete old fields.
`FaceFinish` and `LightPlacement[]` become deprecated types. Guarded by `schemaVersion`
check (see Middleware section above).

### Theme/Style Migration

The existing codebase has 3 themes (`ThemeId = "industrial" | "japanese" | "desert"`)
in `src/config/themes.ts`, referenced by `currentTheme` in the store and `_themeMats`
in `materialCache.ts`.

**`StyleId` replaces `ThemeId`.** Migration path:
- `"industrial"` → `"industrial"` (same ID, expanded definition)
- `"japanese"` → `"japanese"` (same ID)
- `"desert"` → `"desert_brutalist"` (renamed for specificity)
- `currentTheme` store field renamed to `activeStyle: StyleId`
- `_themeMats` in materialCache refactored to read from `StyleDefinition.defaultMaterials`
- Components reading `currentTheme` updated to read `activeStyle`
- The 14 new styles are additive — no existing data breaks

### BOM Integration

BOM computation is extended to include scene objects. If `bomCompute.ts` does not yet
exist in V1, it is created as part of this sprint. The existing BomBar component (if
present) is updated; if not, a BOM display is created as part of the bottom status bar.

```typescript
function computeBOM(containers: ContainerState[], sceneObjects: Record<string, SceneObject>): BOMResult;
```

Each FormDefinition carries `costEstimate`. BOM sums Form costs + Skin material cost
modifiers across all placed objects, alongside existing structure/envelope costs.

---

## 7. Rendering Architecture

### SceneObjectRenderer

One component replaces ContainerSkin door/window rendering, InteriorLights, and LightFixture:

```typescript
// src/components/objects/SceneObjectRenderer.tsx
function SceneObjectRenderer({ containerIds }: { containerIds: string[] }) {
  // 1. Select sceneObjects for visible containers
  // 2. Group by geometry type (procedural vs GLB)
  // 3. For each object:
  //    a. Look up FormDefinition
  //    b. Compute world position from anchor
  //    c. Apply Skin materials
  //    d. Apply StyleEffects from active theme
  //    e. Apply runtime state (door rotation, light emissive)
}
```

### Position Computation

```
face anchor  -> voxelLocalCenter + faceTransform + slotOffset
floor anchor -> voxelLocalCenter + offset
ceiling      -> voxelLocalCenter + [0, vHeight, 0] + offset
```

Reuses existing `voxelLocalCenter` and `faceTransform` math from hitbox system.

### Instancing Strategy

Object counts are low (a home might have 4-8 doors, 6-10 windows, 8-12 lights). Strategy:

| Geometry Type | Approach | When |
|---|---|---|
| Procedural (outlets, switches, simple frames) | Direct `<mesh>` with shared geometry refs | Always |
| GLB models (detailed doors, light fixtures) | `useGLTF` with `clone()` per instance | Always |
| High-count same-type | Promote to `InstancedMesh` | instanceCount > 16 |

### Wall Face Coordination

GlobalVoxelMeshes continues to render **all wall faces as-is** (no geometry splitting).
Form geometry renders **in front of** the wall with proper depth ordering. The Form's
self-contained geometry (which includes its own wall surround material) visually covers
the wall behind it. This avoids splitting face geometry into sub-regions — the simplest
correct approach.

For fully occupied faces (slotWidth=3), GlobalVoxelMeshes skips the face to avoid
z-fighting (the Form completely covers it anyway). This is the only modification to
the existing instanced mesh pipeline.

### Light Source Rendering

SceneObject lights produce actual THREE.js light sources:

| Light Type | THREE.js Source | Direction |
|---|---|---|
| Ceiling lights | SpotLight | Downward cone |
| Wall sconces | SpotLight | Wall wash |
| Floor/table lamps | PointLight | Omnidirectional |

Light intensity driven by:
- `SceneObject.state.brightness` (user slider, 0-100%)
- `timeOfDay` modifier (auto-brighten at night)
- Quality preset cap (max active shadow-casting lights)

### Style Effects

Material modifiers applied at render time — not new geometry, just material parameter tweaks:

| Effect | Implementation |
|---|---|
| `patina_tint` | `material.color.lerp(rustColor, 0.15)` |
| `paper_glow` | `material.emissive = warm`, `material.opacity = 0.85` |
| `heat_shimmer` | emissive intensity += `dot(normal, sunDir) * 0.3` |
| `salt_frost` | Custom edge-detect pass (postprocessing Effect) |
| `reflection_tint` | `material.envMapIntensity *= 1.8` |
| `moss_glow` | `material.emissive = green` when `timeOfDay < 6 \|\| > 20` |
| `ember_warmth` | pointLight color shift toward orange, radius * 1.3 |
| `soft_bloom` | Per-fixture bloom via luminanceThreshold override |
| `dappled_light` | Shadow camera gobo texture (cookie map) |
| `edge_glow` | Emissive channel UV mask on frame edge geometry |
| `layer_lines` | normalMap with horizontal stripe pattern |
| `gold_gleam` | `roughness * 0.6`, `metalness * 1.2` |
| `frost_rim` | Emissive ice-blue on exterior edges, nighttime only |
| `clay_warmth` | Color shift toward terracotta, roughness boost |
| `color_punch` | Saturation multiply via postprocessing HueSaturation |
| `matte_absorb` | `envMapIntensity = 0.05`, `roughness = 0.95` |

Most are one-line material tweaks. Only `salt_frost`, `dappled_light`, `soft_bloom`, and `color_punch` touch the postprocessing pipeline.

### Performance Budget

- Max shadow-casting lights: quality preset (low=2, med=4, high=8)
- Lights beyond cap: emissive visual only, no shadow map
- SceneObjects respect `frameloop="demand"` + `invalidate()`
- GLB budget: each form model < 5K triangles
- Form geometry LOD: not needed at container-home scale (<50 objects)

---

## 8. Testing Strategy

### Unit Tests

**Form Registry**
- All forms have required fields (id, category, anchorType, skinSlots)
- No duplicate form IDs
- Every form's style tags exist in the style registry
- Every default skin references valid materials
- slotWidth in {1, 2, 3}
- Constraints are internally consistent

**Material Registry**
- All materials have valid color/metalness/roughness
- applicableTo references valid skin slot IDs
- No orphan materials (every material used by at least one form default)

**Style Registry**
- All styles have defaultMaterials for common slots (frame, glass, panel)
- Effects reference valid effect types
- compatibleForms reference valid form IDs

### Store Tests

**sceneObjectSlice**
- placeObject creates SceneObject with correct anchor
- placeObject rejects invalid anchor (wrong anchor type for form)
- placeObject rejects occupied slots (collision detection)
- removeObject deletes and restores wall face
- updateSkin only accepts materials valid for that slot
- applyQuickSkin applies all slot overrides from preset
- moveObject within face (slot 0 -> slot 2)
- duplicateObject creates new ID, same form+skin
- undo/redo covers place -> remove -> undo cycle
- persist round-trip: serialize -> hydrate -> identical state
- migration: old DoorConfig/FaceFinish/LightPlacement -> SceneObjects
- removeObjectsByContainer cascades correctly (called from containerSlice.removeContainer)

**Slot Occupancy**
- slotWidth=1 occupies 1 slot
- slotWidth=2 occupies 2 adjacent slots
- slotWidth=3 fills face, blocks all other placements
- Two slotWidth=1 forms coexist on same face (different slots)
- slotWidth=2 + slotWidth=1 fills face exactly
- Removing an object frees its slots

### Integration Tests

**Placement Flow**
- Place door on exterior wall -> accepted, face marked
- Place door on interior wall -> rejected (if form requires exterior)
- Place window on floor -> rejected (anchorType mismatch)
- Place ceiling light on ceiling -> accepted
- Place floor lamp on floor -> accepted
- Place sconce on wall face -> accepted, correct slot
- Two windows on same face, different slots -> both exist
- BOM updates after each place/remove

**Wall Coordination**
- Partially occupied face: wall still renders, form geometry covers occupied region
- Fully occupied face (slotWidth=3): wall face skipped, form geometry covers it
- Remove object -> wall was always there, no re-render needed

**Stacking Interaction**
- Objects on L0 ceiling vs L1 floor: no conflict
- stackContainer preserves SceneObjects on existing containers
- removeContainer cascades: deletes all SceneObjects anchored to it

**Merge Interaction**
- Auto-merge skips faces with placed objects (user-placed = user-painted)
- Moving container recomputes merge but preserves SceneObjects

### Anti-Pattern Tests

**Selector Stability**
- getObjectsByContainer returns stable ref when objects unchanged
- getOccupiedSlots returns stable Set ref
- No infinite re-render from derived object selectors (useShallow)

**Render Rules**
- SceneObjectRenderer meshes have `raycast={() => {}}` on non-interactive parts
- No `<mesh>` without raycast control in object rendering tree
- Form geometries are disposed on unmount
- GLB clones are disposed on unmount

**Memory**
- Place 50 objects, remove all -> no geometry leak (dispose called)
- Style effect materials don't accumulate (reuse, don't clone per frame)

### Core Loop Canary Extension

Extend existing `core-loop-canary.test.ts`:
- Create container -> place door -> place window -> place light
- Verify BOM includes all three
- Remove door -> BOM updates
- Undo -> door returns -> BOM restored
- Change theme -> all objects re-skin to new theme defaults

---

## 9. Deferred Items

| Item | Reason | When |
|---|---|---|
| Hotbar / favorites integration | Depends on broader panel layout sprint (left vs bottom vs hybrid) | Panel layout sprint |
| Furniture forms | Same Form+Skin model, but needs room-module integration | After this system is stable |
| GLB model creation | Need actual 3D models for each form | Art pipeline sprint |
| Blueprint (BP) view object markers | Door swing arcs, window symbols in 2D | Blueprint view sprint |
| Floorplan (FP) view integration | Object placement in floorplan mode | Floorplan view sprint |
| Postprocessing style effects | `salt_frost`, `dappled_light`, `soft_bloom`, `color_punch` require custom shader passes or postprocessing pipeline changes | Effects polish sprint |
| Table lamp surface anchor | `light_table_lamp` currently uses floor anchor; needs `"surface"` anchor when furniture arrives | Furniture sprint |

---

## 10. File Structure

```
src/
  config/
    formRegistry.ts          Form catalog registry + query helpers
    forms/
      doors.ts               Door FormDefinitions
      windows.ts             Window FormDefinitions
      lights.ts              Light FormDefinitions
      electrical.ts          Electrical FormDefinitions
    styleRegistry.ts         Style definitions + effects
    materialRegistry.ts      Material options library
  types/
    sceneObject.ts           SceneObject, ObjectAnchor, FormDefinition types
  store/
    slices/
      sceneObjectSlice.ts    Store slice (actions + selectors)
  components/
    objects/
      SceneObjectRenderer.tsx  Unified 3D renderer for all placed objects
      PlacementGhost.tsx       Ghost preview during placement mode
    ui/
      FormCatalog.tsx          Bottom bar catalog (tabs + carousel + filters)
      SkinEditor.tsx           Left panel skin customization
      PlacementControls.tsx    Placement mode cursor/state management
  utils/
    slotOccupancy.ts          Sub-face slot math
    skinResolver.ts           Resolve skin overrides against theme defaults
    migration/
      migrateToSceneObjects.ts  One-time hydration from old format
  __tests__/
    form-registry.test.ts
    scene-object-slice.test.ts
    slot-occupancy.test.ts
    placement-flow.test.ts
    style-effects.test.ts
```
