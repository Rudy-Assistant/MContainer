# MODUHOME V1.0: TECHNICAL ARCHITECTURE & SPECIFICATION

---

## 1. CORE SYSTEM OBJECTIVES

- **True Verticality**: Support for multi-story stacking (up to 4 levels) with intelligent structural validation.
- **Auto-Merge Logic**: Algorithms to detect adjacent containers and automatically "dissolve" shared walls to create open floor plans.
- **Simulation Fidelity**: Real-time cost estimation, thermal visualization, and structural integrity checks.
- **Persistence**: State must survive browser refreshes via `localStorage` hydration.

### 1.1 Current Implementation Status

| Objective           | Status        | Notes                                                       |
|---------------------|---------------|-------------------------------------------------------------|
| True Verticality    | PLANNED       | Data model supports `y` position; stacking logic not yet implemented |
| Auto-Merge Logic    | PARTIAL       | Zone/group system exists; auto-void algorithm not yet wired |
| Simulation Fidelity | IMPLEMENTED   | Live BOM with real-time pricing; thermal/structural TBD     |
| Persistence         | IMPLEMENTED   | `localStorage` auto-save every 5s, restore on mount         |

### 1.2 Tech Stack

| Layer         | Technology                              |
|---------------|-----------------------------------------|
| Framework     | Next.js 16.1.6 (App Router, React 19)  |
| Language      | TypeScript 5                            |
| 3D Engine     | React Three Fiber 9.5 + Three.js 0.182 |
| 3D Helpers    | @react-three/drei 10.7                  |
| State         | Zustand 5.0 (single store)             |
| Styling       | Tailwind CSS 4 + inline styles          |
| Icons         | lucide-react 0.564                      |
| IDs           | uuid v13                                |

---

## 2. DATA STRUCTURES (TypeScript Interfaces)

### 2.1 The Container Entity

The fundamental unit is a node in a structural graph. Each container is fully self-describing: it knows its spatial position, its wall configuration, and its relationship to neighboring containers.

**Target Interface:**

```typescript
type ContainerID = string; // UUID v4

interface Container {
  id: ContainerID;
  type: '20ft_std' | '40ft_std' | '40ft_hc';

  // Spatial Coordinates (The "Snap Grid")
  position: [x: number, y: number, z: number];
  rotation: 0 | 90 | 180 | 270;
  level: number; // 0 = Ground, 1 = Second Floor, etc.

  // Structural Graph
  stackedOn: ContainerID | null; // ID of the container below
  supporting: ContainerID[];     // IDs of containers above

  // Wall Configuration (The "Smart Skin")
  // Each wall is an array of "Bays" (1.5m segments)
  walls: {
    front: BayModule[];
    back: BayModule[];
    left: BayModule[];
    right: BayModule[];
    roof: RoofModule;
    floor: FloorModule;
  };

  // Grouping Logic
  groupId: string | null; // For "Wings" or "Zones"
  mergedWalls: string[];  // IDs of walls that are invisible due to adjacency
}
```

**Current Implementation** (`src/types/container.ts`):

```typescript
interface Container {
  id: string;                        // UUID v4
  name: string;                      // Display label
  size: ContainerSize;               // "20ft_standard" | "40ft_standard" | "40ft_high_cube"
  position: ContainerPosition;       // { x, y, z }
  rotation: number;                  // Radians (Y-axis) — continuous, not locked to 90°
  walls: {
    front: WallConfig;               // WallConfig = { side, bays: BaySlot[] }
    back: WallConfig;
    left: WallConfig;
    right: WallConfig;
  };
  roofRemoved: boolean;
}
```

**Gap Analysis:**
- `level`, `stackedOn`, `supporting` — not yet implemented (vertical stacking)
- `roof: RoofModule`, `floor: FloorModule` — currently `roofRemoved: boolean` only
- `mergedWalls` — exists on `Zone` type, not on `Container` directly
- `rotation` — continuous radians, needs migration to discrete 0/90/180/270

### 2.2 Container Sizes

| Enum Key      | Label          | Dimensions (L x W x H)  | Long Wall Bays | Short Wall Bays |
|---------------|----------------|--------------------------|----------------|-----------------|
| `Standard20`  | 20' Standard   | 6.06 x 2.44 x 2.59 m   | 4              | 2               |
| `Standard40`  | 40' Standard   | 12.19 x 2.44 x 2.59 m  | 8              | 2               |
| `HighCube40`  | 40' High Cube  | 12.19 x 2.44 x 2.90 m  | 8              | 2               |

Bay width is uniformly **1.5 m**. Defined in `CONTAINER_DIMENSIONS`, `LONG_WALL_BAYS`, and `SHORT_WALL_BAYS` constants.

### 2.3 The Module System

Every interactable element is a "Module" with specific physical properties.

**Target Interface:**

```typescript
type ModuleType =
  | 'wall_solid'
  | 'wall_glass_fixed'
  | 'wall_glass_sliding'
  | 'wall_hinged_deck'    // Folds Down
  | 'wall_hinged_awning'  // Folds Up
  | 'door_standard'
  | 'void_open';          // Represents a removed wall segment

interface BayModule {
  id: string;
  type: ModuleType;

  // Physical State
  isOpen: boolean;        // For doors/hinges
  foldProgress: number;   // 0.0 to 1.0 (Animation state)

  // Metadata
  cost: number;
  thermal_r_value: number;
  weight_kg: number;
}
```

**Current Implementation** (`src/types/container.ts`):

```typescript
enum ModuleType {
  PanelSolid = "panel_solid",
  PanelGlass = "panel_glass",
  HingedWall = "hinged_wall",
}

// Union type: PanelSolid | PanelGlass | HingedWall
// All share: id, type, cost_factor, thermal_value
// HingedWall adds: foldsDown, foldsUp, openAmount (0-1)
// PanelGlass adds: variant (GlassVariant)
```

**Gap Analysis:**
- `door_standard`, `void_open` — not yet implemented
- `weight_kg` — not tracked
- `wall_hinged_deck` / `wall_hinged_awning` — currently unified as `HingedWall` with `foldsDown`/`foldsUp` booleans
- Gull-wing = `foldsDown: true` AND `foldsUp: true` (splits panel at mid-height)

### 2.4 Supporting Types

| Type                  | Purpose                                          | File                   |
|-----------------------|--------------------------------------------------|------------------------|
| `Zone`                | Groups containers, tracks merged walls           | `container.ts`         |
| `EnvironmentSettings` | `timeOfDay` (0-24h), `northOffset` (0-360°)     | `container.ts`         |
| `PricingConfig`       | Base costs, cut fees, module costs, surcharges   | `container.ts`         |
| `PricingEstimate`     | Low/high range (±15%), breakdown by category     | `container.ts`         |
| `AppState`            | Root state: containers, zones, env, view, pricing| `container.ts`         |

---

## 3. THE PHYSICS & LOGIC ENGINES

### 3.1 The "Auto-Void" Algorithm (Adjacency Detection)

> **Status: PLANNED** — Zone grouping exists; automatic wall dissolution not yet wired.

**Trigger:** Runs `onMoveEnd` or `onRotateEnd` of any container.

**Logic:**

1. Calculate the World Bounding Box of the active container.
2. Query the SpatialHash or Octree for potential neighbors.
3. If `Neighbor_Face_Normal` is opposite to `Active_Face_Normal` AND `distance < 0.05m`:
   - **Action:** Flag both bays as `potential_merge`.
   - **UI:** Show a "Merge/Void" button to the user (or auto-merge if "Auto-Join" is enabled).
   - **Result:** Replace `wall_solid` with `void_open` (invisible mesh).

**Current State:** The `Zone` type has a `mergedWalls` array tracking `{ containerA, containerB, sharedSide }` pairs. The store has `addContainerToZone` and `removeContainerFromZone` actions. The spatial query and auto-detection are not yet implemented.

### 3.2 The Vertical Stacking Logic

> **Status: PLANNED** — Y position exists in data model; stacking validation not yet implemented.

**The Grid:**
- **X/Z Axes:** 1.5m snap increments (implemented in `DragGhost`).
- **Y Axis:** Fixed increments of 2.59m (Standard) or 2.90m (High-Cube).

**Validation Rules:**

1. **Gravity Check:** A container cannot be placed at `Level > 0` unless its centroid is at least 60% supported by a container at `Level - 1`.
2. **Roof Penetration:** If a `StairModule` is present in the container below, the Floor of the container above must automatically spawn a `void_floor` cutout.

### 3.3 The Hinge Physics

> **Status: IMPLEMENTED** — Full spring animation system with correct pivot points.

**Implementation** (`src/components/three/ContainerMesh.tsx`):

**Pivot Points:**
- **Fold Down (Deck):** Bottom edge (`y = -height/2` relative to center). Rotates `+PI/2` outward.
- **Fold Up (Awning):** Top edge (`y = +height/2` relative to center). Rotates `-PI/2` upward.
- **Gull Wing:** Center split. Bottom half pivots at bottom edge, top half pivots at top edge.

**Spring Animation:**
```typescript
// AnimatedHingePivot — exponential decay at 60fps
const ANIM_SPEED = 4.0;
const spring = 1 - Math.exp(-ANIM_SPEED * delta * 8);
pivotRef.current.rotation.x += diff * spring;
// Threshold: 0.0005 radians to prevent micro-oscillation
```

**Pivot Geometry Stack:**
```
group(position=[0, pivotY, 0])         // Move origin to pivot point
  └── group(ref=rotating)               // Apply rotation here
      └── group(position=[0, -pivotY, 0])  // Offset children back
          └── DoubleSidedPanel           // The actual wall geometry
```

**Planned Enhancement — Collision Detection:**
- "Fold Down" actions must perform a Raycast downwards.
- If `hit.distance < 2.5m` (and target is not `ground`), block the fold and show error: "Obstructed".

### 3.4 The Snap Grid (Implemented)

```typescript
const SNAP = 1.5; // metres
const snappedX = Math.round(hitPoint.x / SNAP) * SNAP;
const snappedZ = Math.round(hitPoint.z / SNAP) * SNAP;
```

Raycast from camera through pointer to `THREE.Plane(Vector3(0, 1, 0), 0)` every frame via `useFrame`. Snapped position stored in `dragWorldPos` and rendered as ghost.

---

## 4. VISUALIZATION & RENDERING

### 4.1 The "Architectural" Shader System

All materials are procedural PBR — no texture files. Declared at module scope as singletons to prevent per-render re-creation.

**Corrugated Steel:**

| Property   | Value     | Notes                                   |
|------------|-----------|-----------------------------------------|
| Color      | `#2d3e50` | Dark Slate Blue                         |
| Metalness  | 0.75      | High metallic sheen                     |
| Roughness  | 0.35      | Semi-polished                           |
| Geometry   | 6 ribs/bay| Raised `boxGeometry` strips (0.025 x h x 0.012) |

**Glass (MeshPhysicalMaterial):**

| Property             | Value     |
|----------------------|-----------|
| `transmission`       | 1.0       |
| `thickness`          | 0.1       |
| `roughness`          | 0.0       |
| `ior`                | 1.5       |
| `envMapIntensity`    | 1.0       |

**Planned Enhancement:** `chromaticAberration: 0.05` for additional realism.

**Full Material Table:**

| Material            | Color     | Type                | Metalness | Roughness |
|---------------------|-----------|---------------------|-----------|-----------|
| `steelExterior`     | `#2d3e50` | MeshStandardMaterial| 0.75      | 0.35      |
| `steelDark`         | `#1e2d3d` | MeshStandardMaterial| 0.80      | 0.40      |
| `interiorWood`      | `#b8845a` | MeshStandardMaterial| 0.02      | 0.78      |
| `deckWalkSurface`   | `#9c6b30` | MeshStandardMaterial| 0.05      | 0.85      |
| `glassMat`          | `#ddeeff` | MeshPhysicalMaterial| 0.00      | 0.00      |
| `frameMat`          | `#1a2a3a` | MeshStandardMaterial| 0.85      | 0.25      |
| `roofMat`           | `#263646` | MeshStandardMaterial| 0.70      | 0.45      |
| `hingeExteriorDown` | `#8b4513` | MeshStandardMaterial| 0.60      | 0.40      |
| `hingeExteriorUp`   | `#7a6520` | MeshStandardMaterial| 0.60      | 0.40      |
| `hingeExteriorGull` | `#993311` | MeshStandardMaterial| 0.60      | 0.40      |
| `awningUnderside`   | `#cccccc` | MeshStandardMaterial| 0.15      | 0.60      |
| `corrugationRib`    | `#243444` | MeshStandardMaterial| 0.80      | 0.30      |

**Planned Enhancement — Normal Maps:** Procedurally generated sine wave normal maps for corrugation instead of geometry-based ribs.

### 4.2 Geometry Structure Per Container

```
ContainerMesh (group)
├── Floor plate — interior wood top (0.06 thick) + steel dark underside (0.04 thick)
├── Roof slab — conditional on roofRemoved (0.05 thick, overhangs 0.02)
├── 4 Corner posts — frameMat (0.1 x height x 0.1)
├── 8 Edge beams — frameMat (top + bottom, 4 each, 0.06 x 0.06)
├── 4 Wall assemblies
│   └── N Bay modules per wall
│       ├── SolidBay: boxGeometry + 6 CorrugationRibs
│       ├── GlassBay: 5-bar mullion frame + refractive glass pane
│       ├── HingedBayFoldDown: hinge cylinder + AnimatedHingePivot + DoubleSidedPanel
│       ├── HingedBayFoldUp: hinge cylinder + AnimatedHingePivot + DoubleSidedPanel
│       └── HingedBayGullWing: center bar + 2 hinge cylinders + 2 AnimatedHingePivots
└── Selection wireframe overlay (when selected, wireframe blue at 0.6 opacity)
```

### 4.3 Blueprint Mode (The "X-Ray")

> **Status: IMPLEMENTED** — CAD-style flat rendering with line weight differentiation.

When `mode === 'blueprint'`, the renderer switches entirely to `BlueprintRenderer.tsx`:
- All materials: `depthTest = false`
- All meshes: `renderOrder = 999`
- All geometry at `Y = 0.5` (above grid at `Y = 0.3`)
- Background: `#f0f2f5`

**CAD Line Weights:**

| Element            | Thickness | Color     | Material        |
|--------------------|-----------|-----------|-----------------|
| Structural wall    | 0.10      | `#1a1a1a` | `matWallSolid`  |
| Glass wall         | 0.04      | `#00bcd4` | `matWallGlass`  |
| Fold-down hinge    | 0.06      | `#e65100` | `matFoldDown`   |
| Fold-up hinge      | 0.06      | `#f9a825` | `matFoldUp`     |
| Gull-wing hinge    | 0.06      | `#d84315` | `matGull`       |
| Container border   | 0.08      | `#1a1a1a` | `matBorder`     |
| Selected border    | 0.08      | `#1565c0` | `matBorderSelected` |

**Deployed Flap Visualization:**
- Fold-down open: solid orange fill (opacity 0.12) extending outward by `dims.height`
- Fold-up open: yellow outline fill (opacity 0.20) + 3 dashed yellow stripes overhead at 30%/50%/70% of flap depth
- Gull-wing open: solid orange fill

**Planned Enhancement — Cut Planes:**
Render specific "Cut Planes" at `y = 1.5m` for each active level to show floor plans clearly in multi-story configurations.

### 4.4 The Furniture "Ghost" System

> **Status: PLANNED**

**Interaction:** Dragging a bed/sofa from the library does NOT spawn it immediately.

**Ghosting:** Creates a semi-transparent green mesh that snaps to the floor plane of the container under the mouse.

**Collision:** Furniture cannot be placed overlapping walls or other furniture.

### 4.5 Environment & Lighting System

**Sun Position** — Trigonometric solar angle model:
```typescript
const solarAngle = ((timeOfDay - 6) / 12) * Math.PI;
const elevation = Math.sin(solarAngle);
const azimuth = Math.cos(solarAngle);
// Rotated by northOffset
```

**Color Temperature Bands:**

| Time Range | Color     | Description        |
|------------|-----------|--------------------|
| 0-5        | `#0a0a2e` | Night (no light)   |
| 5-7        | `#ff6b35` | Dawn warm orange   |
| 7-9        | `#ffaa55` | Morning golden     |
| 9-16       | `#fff8f0` | Midday cool white  |
| 16-18      | `#ffaa55` | Afternoon golden   |
| 18-20      | `#ff6b35` | Dusk warm orange   |
| 20-21      | `#2244aa` | Twilight blue      |
| 21-24      | `#060614` | Night background   |

**Lighting Rig:**
- `DirectionalLight` — sun position, 2048x2048 shadow maps, intensity from sinusoidal curve
- `AmbientLight` — 25% of sun intensity, cool-tinted
- `HemisphereLight` — sky blue / warm ground, 15% of sun intensity
- `ContactShadows` — resolution 1024, blur 2.5, fade at 25m
- `Sky` (Drei) — Rayleigh/turbidity adjust with time of day

### 4.6 Camera System

**3D Mode:**
- Perspective camera: FOV 50, near 0.1, far 500
- OrbitControls: polar angle clamped to `[0.1, PI/2 - 0.05]`, distance `[3, 120]`

**Blueprint Mode** (`CameraController.tsx`):
- OrthographicCamera: `near = -10000`, `far = 10000` (nuclear clipping)
- OrbitControls: `enableRotate = false`, `screenSpacePanning = true`, zoom `[2, 200]`
- Auto-fit: `computeAutoFit()` calculates AABB of all containers with rotation support, returns center + zoom for ~80% viewport fill (`MARGIN_FACTOR = 1.25`)
- Frustum guard: `useFrame` checks centroid visibility, auto-corrects camera drift
- Triggers on: blueprint mode entry, container count change

---

## 5. USER INTERFACE (The "Studio" Layout)

### 5.1 Layout Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Header Toolbar (56px)                                       │
│  [ModuHome v1.0] | [Blueprint/3D] | [Rotate] [Delete] |     │
│                                    [Group] ... [Budget] [DL] │
├───────────┬──────────────────────────────────────────────────┤
│           │                                                  │
│ Library   │              R3F Canvas                          │
│ Sidebar   │                                    ┌───────────┐│
│ (220px)   │                                    │  Live BOM  ││
│           │                                    │ Steel: $X  ││
│ Tab 1:    │                                    │ Glass: $Y  ││
│ Structure │                                    │ Total: $Z  ││
│  20' Std  │                                    └───────────┘│
│  40' Std  │                                                  │
│  40' HC   │                                                  │
│           │         [BayContextMenu]                         │
│ Tab 2:    │                                                  │
│ Portals   │              ┌──────────────┐                    │
│ (planned) │              │  BottomDock   │                    │
│           │              │ [View][Time]  │                    │
│ Tab 3:    │              │ [Compass][$]  │                    │
│ Interior  │              └──────────────┘                    │
│ (planned) │                                    ┌────────────┐│
│           │                                    │Level Slicer││
│ Tab 4:    │                                    │ [Roof]     ││
│ Systems   │                                    │ [L2]       ││
│ (planned) │                                    │ [L1]       ││
│           │                                    │ [G]        ││
│           │                                    └────────────┘│
└───────────┴──────────────────────────────────────────────────┘
```

### 5.2 The Persistent Sidebar ("The Library")

> **Status: Tab 1 IMPLEMENTED, Tabs 2-4 PLANNED**

**Current (Palette.tsx):**
- Glass-morphism: `backdrop-filter: blur(20px) saturate(1.8)` on `rgba(255,255,255,0.72)`
- 220px width, Lucide icons: Package (20ft), Box (40ft), Warehouse (40ft HC)
- Hover lift: `translateY(-1px)`, blue border `#1565c0`, blue shadow
- Drag-to-place on `mousedown` → sets `dragContainer` in store

**Target Tabs:**

| Tab       | Contents                                          | Status    |
|-----------|---------------------------------------------------|-----------|
| Structure | 20ft, 40ft, 40ft HC containers                   | DONE      |
| Portals   | Windows, Doors, Folding Decks                     | PLANNED   |
| Interior  | Stairs, Kitchen, Bed, Bath, Sofa                  | PLANNED   |
| Systems   | Solar Panels, HVAC units (Roof mount)              | PLANNED   |

**Behavior:** Drag-and-drop with "Ghost" preview for all tabs.

### 5.3 The "Live BOM" (Bill of Materials)

> **Status: IMPLEMENTED** (`LiveBOM.tsx`)

**Location:** Top-right overlay (glass-morphism panel). Hidden when no containers exist.

**Current Data:**

| Field      | Source                         |
|------------|--------------------------------|
| Steel      | `estimate.breakdown.containers`|
| Glass      | `estimate.breakdown.modules`   |
| Cuts       | `estimate.breakdown.cuts`      |
| **Total**  | `estimate.breakdown.total`     |

**Planned Enhancements:**
- Steel Weight (kg)
- Glazing Area (sq m)
- "Download CSV" button
- Collapsible panel

### 5.4 The "Level Slicer"

> **Status: PLANNED**

**Location:** Right edge of screen.

**UI:** Vertical slider or radio buttons: `[Roof] [L2] [L1] [G]`

**Action:** Culls (hides) all geometry above the selected level to allow easy interior editing.

### 5.5 Bottom Dock (Implemented)

**Location:** Bottom-center, floating above canvas.

**Styling:** `bg-slate-900/85 backdrop-blur-xl`, rounded, dark glass panel.

**Tabs:**

| Button   | Expanded Panel                                              |
|----------|-------------------------------------------------------------|
| View     | Toggle 3D / Blueprint (also in header)                      |
| Time     | Slider 0-24h with formatted time display                    |
| Compass  | Slider 0-360° north offset                                  |
| Pricing  | Full breakdown with "Edit Rates" link to BudgetModal        |
| Project  | ExportImport component (JSON save/load)                     |

### 5.6 Bay Context Menu (Implemented)

**Trigger:** Click any bay in the 3D view.

**Display:** Floating at click coordinates, Lucide icon circles (40px).

**Options:** PanelSolid, PanelGlass, HingedWall (fold-down, fold-up, gull-wing), toggle open/close.

### 5.7 Design Tokens

```
Primary:    #1565c0
Surface:    #ffffff
Background: #f4f6f8
Border:     #cfd8dc
Text:       #37474f
Dark Text:  #263238
Muted:      #90a4ae
Label:      #78909c
```

---

## 6. STATE MANAGEMENT & PERSISTENCE

### 6.1 Store Architecture

Single Zustand store at `src/store/useStore.ts`. Flat structure with state + actions combined:

```
AppState
├── containers: Record<string, Container>
├── zones: Record<string, Zone>
├── environment: EnvironmentSettings
├── viewMode: ViewMode (Realistic3D | Blueprint)
├── pricing: PricingConfig
├── selection: string[]

UI State (transient — not persisted)
├── bayContextMenu: { visible, x, y, containerId, wall, bayIndex } | null
├── dragContainer: ContainerSize | null
├── dragWorldPos: { x, z } | null
```

### 6.2 Key Actions

| Action                    | Description                                               |
|---------------------------|-----------------------------------------------------------|
| `addContainer`            | Creates container via factory, adds to store              |
| `removeContainer`         | Removes container, cleans up zones and selection          |
| `updateContainerPosition` | Moves container to new position                           |
| `updateContainerRotation` | Rotates container (continuous radians)                    |
| `resizeContainer`         | Recreates container at new size, preserving id/rotation   |
| `toggleRoof`              | Toggles `roofRemoved` flag                                |
| `setBayModule`            | Replaces a single bay's module on a wall                  |
| `toggleBayOpen`           | Toggles `openAmount` between 0 and 1                     |
| `select`                  | Single or additive (shift-click) selection                |
| `createZone`              | Groups containers with name and ID list                   |
| `setTimeOfDay`            | Updates environment time (0-24)                           |
| `setNorthOffset`          | Updates north orientation (0-360°)                        |
| `getEstimate`             | Computes pricing by walking all containers/bays           |
| `exportState`             | Serializes to JSON                                        |
| `importState`             | Deserializes JSON back into store                         |

### 6.3 Persistence

**Auto-Save** (`useAutoSave()` in `page.tsx`):
```typescript
const STORAGE_KEY = "moduhome-project-v1";

// Restore on mount
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) useStore.getState().importState(saved);

// Save every 5 seconds
setInterval(() => {
  if (Object.keys(state.containers).length > 0) {
    localStorage.setItem(STORAGE_KEY, state.exportState());
  }
}, 5000);
```

**Manual Export/Import:**
- Export: `exportState()` → Blob → `moduhome-project.json` download
- Import: File upload → `importState(json)` (in `ExportImport.tsx`)

### 6.4 Pricing Engine

**Cost Calculation:**

```
For each container:
  + containerBase[size]                    ($2,500 / $4,200 / $5,000)
  For each non-solid bay:
    + cutFee                               ($500 per structural cut)
    + moduleCosts[moduleType]              ($1,200 glass, $2,800 hinge)
    + glassSurcharge (if glass)            ($350)
    + hingeMechanism (if hinge)            ($1,500)

Total = sum of all above
Estimate range = Total * 0.85  to  Total * 1.15
```

**Default Rates** (`src/config/pricing_config.json`):

```json
{
  "containerBase": { "20ft_standard": 2500, "40ft_standard": 4200, "40ft_high_cube": 5000 },
  "cutFee": 500,
  "moduleCosts": { "panel_solid": 0, "panel_glass": 1200, "hinged_wall": 2800 },
  "glassSurcharge": 350,
  "hingeMechanism": 1500
}
```

---

## 7. DRAG-AND-DROP SYSTEM

### 7.1 Flow

```
Palette.tsx (mousedown on container card)
  → setDragContainer(size) in store
  → Registers document-level mousemove/mouseup listeners
  → Renders fixed-position DOM ghost element tracking cursor

Scene.tsx > DragGhost (useFrame — runs every frame)
  → raycaster.setFromCamera(pointer, camera)
  → Intersects ground plane: THREE.Plane(Vector3(0,1,0), 0)
  → Snaps hit point to 1.5m grid
  → Stores snapped position in store.dragWorldPos
  → Renders 3D ghost at snapped position

Scene.tsx > DragGhost (mouseup)
  → Reads final dragWorldPos from store
  → Calls addContainer(dragContainer, { x, y: 0, z })
  → Clears dragContainer → ghost disappears
```

### 7.2 Ghost Visual

Two overlaid meshes at exact container dimensions:
- **Solid fill:** `#1565c0` at opacity 0.2
- **Wireframe:** `#1565c0` at opacity 0.6

---

## 8. RENDERING ARCHITECTURE

### 8.1 Dual Renderer Design

The application maintains two completely separate renderers that are **never mixed**:

```
SceneCanvas.tsx (Canvas, shadows, ACESFilmic)
└── Scene.tsx
    ├── CameraController (orthographic, blueprint mode only)
    ├── DragGhost (shared, both modes)
    ├── ViewMode === Blueprint
    │   ├── BlueprintRenderer.tsx
    │   │   ├── color background #f0f2f5
    │   │   ├── ambientLight 1.5
    │   │   ├── Grid (y=0.3, cellSize=1.5m, sectionSize=6.06m)
    │   │   ├── BlueprintContainer[] (flat planes at y=0.5)
    │   │   └── Deselect plane (invisible, 200x200)
    │   └── OrbitControls (enableRotate=false, screenSpacePanning)
    └── ViewMode === Realistic3D
        ├── SkyDome (day/night based on timeOfDay)
        ├── SunLight (directional + ambient + hemisphere)
        ├── Ground (grass plane + grid overlay)
        ├── ContactShadows
        ├── ContainerMesh[] (full PBR)
        ├── OrbitControls (full orbit, clamped)
        └── Deselect plane (invisible, 200x200)
```

### 8.2 SceneCanvas Configuration

```typescript
<Canvas
  shadows
  camera={{ position: [15, 12, 15], fov: 50, near: 0.1, far: 500 }}
  gl={{ antialias: true, toneMapping: 3 /* ACESFilmic */, toneMappingExposure: 1.0 }}
/>
```

Imported via `next/dynamic` with `ssr: false` — R3F requires client-only rendering.

---

## 9. CRITICAL CONSTRAINTS & RULES

1. **No `<Line>` in Blueprint mode** — Drei's Line component causes WebGL crashes. All lines are flat `<mesh>` with `planeGeometry`.

2. **No SSR for SceneCanvas** — R3F requires `dynamic(() => import(...), { ssr: false })`.

3. **Materials at module scope** — All `THREE.*Material` instances are declared outside components to prevent re-creation per render.

4. **Narrow Zustand selectors** — e.g., `useStore((s) => s.selection)` not `useStore((s) => s)` to avoid unnecessary re-renders.

5. **Physical correctness** — Fold-down walls fold OUTWARD (become walkable decks). Fold-up walls rotate UPWARD (become awnings). Inward folding is a critical failure.

6. **Blueprint always-on-top** — All blueprint materials use `depthTest: false` and meshes use `renderOrder: 999` to prevent z-fighting.

7. **Nuclear clipping** — OrthographicCamera uses `near: -10000, far: 10000` to eliminate all clipping edge cases.

8. **Icons over text** — Use Lucide React icons with hover tooltips, not text-heavy buttons.

9. **One-click actions** — Selecting "Fold Down" immediately deploys the animation. No confirmation dialogs.

---

## 10. FILE STRUCTURE

```
C:\MContainer\
├── CLAUDE.md                         # Project constitution & conventions
├── ARCHITECTURE_V1.md                # This document
├── package.json
├── tsconfig.json
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout (fonts, metadata)
│   │   ├── page.tsx                  # Main page + HeaderToolbar + useAutoSave
│   │   └── globals.css               # Tailwind imports, slider styles, CSS vars
│   ├── components/
│   │   ├── three/
│   │   │   ├── SceneCanvas.tsx       # R3F Canvas wrapper (dynamic, ssr: false)
│   │   │   ├── Scene.tsx             # View switch, sky, sun, ground, DragGhost
│   │   │   ├── ContainerMesh.tsx     # 3D PBR container + animated hinges
│   │   │   ├── BlueprintRenderer.tsx # 2D CAD flat-plane schematic
│   │   │   └── CameraController.tsx  # Orthographic camera + auto-fit + frustum guard
│   │   └── ui/
│   │       ├── Palette.tsx           # Glass-morphism library sidebar
│   │       ├── BayContextMenu.tsx    # Floating icon menu for bay editing
│   │       ├── BottomDock.tsx        # Environment / pricing dock bar
│   │       ├── LiveBOM.tsx           # Real-time Bill of Materials overlay
│   │       ├── BudgetModal.tsx       # Pricing rate editor modal
│   │       └── ExportImport.tsx      # JSON project export/import
│   ├── store/
│   │   └── useStore.ts              # Zustand store (all state + actions)
│   ├── types/
│   │   ├── container.ts             # Core type definitions & enums
│   │   └── factories.ts             # Module/container factory functions
│   └── config/
│       └── pricing_config.json      # Default pricing rates
```

---

## 11. EXECUTION ROADMAP

| Phase | Task                          | Description                                                         | Status      |
|-------|-------------------------------|---------------------------------------------------------------------|-------------|
| 1     | **Refactor Data Layer**       | Rewrite `useStore` to support new Container interface with Levels and Stacking. Add `level`, `stackedOn`, `supporting` fields. Migrate rotation to discrete 0/90/180/270. | DONE |
| 2     | **Physics Upgrade**           | Implement Y-Axis snap logic and Gravity Check. Add collision raycasts for hinge fold obstruction detection. | DONE |
| 3     | **Visual Overhaul**           | Replace geometry-based corrugation with procedural sine wave normal maps. Add chromatic aberration to glass. | DONE |
| 4     | **Interior System**           | Build Furniture registry (Stairs, Kitchen, Bed, Bath, Sofa). Implement "Snap-to-Floor" placement with collision avoidance. Add Library tabs 2-4. Furniture costs in pricing engine. | DONE |
| 5     | **Blueprint 2.0**             | Level Slicer UI with per-level culling. Multi-story blueprint rendering. Level filtering in both 3D and Blueprint views. | DONE |
| 6     | **Walkthrough Mode**          | First-person WASD + mouse look with wall collision. PointerLockControls, 1.7m eye height, AABB collision against container walls. Immersive mode hides all UI overlays. | DONE |
| 7     | **Systems Layer**             | Solar Array and HVAC roof-mount modules with 3D rendering. Thermal R-value per container in BayEditor. Systems tab in Library. | DONE |

### Completed Milestones

| Milestone                    | What Was Delivered                                                      |
|------------------------------|-------------------------------------------------------------------------|
| PBR Material System          | Dark Slate Blue steel, refractive glass, warm wood deck, corrugation ribs |
| Spring Animation             | 60fps exponential decay hinges (fold-down, fold-up, gull-wing)          |
| Blueprint CAD View           | Line-weight differentiation, deployed flap visualization, auto-fit camera |
| Drag-and-Drop                | Ghost preview, 1.5m grid snap, ground plane raycast                     |
| Glass-morphism UI            | Frosted sidebar, Live BOM overlay, dark bottom dock                     |
| Environment System           | Day/night sun cycle, color temperature, sky dome, contact shadows       |
| Persistence                  | localStorage auto-save/restore, JSON export/import                      |
| Pricing Engine               | Live BOM with container/module/cut breakdown, configurable rates        |

---

## 12. BUILD & RUN

```bash
npm run dev      # Development server at http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint
npx tsc --noEmit # Type-check without emitting
```

---

*ModuHome v1.0 — Technical Architecture & Specification — February 2026*
