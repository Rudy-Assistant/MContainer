# ModuHome V1 — Developer Onboarding

## What is this?

A browser-based 3D shipping container home designer. Users place shipping containers, configure interiors (rooms, materials, furniture), stack multi-level structures, walk through in first-person, and export designs as GLB or JSON. Built on React + Three.js with a Zustand state store.

## Prerequisites

- Node.js 18+
- Windows (paths in CLAUDE.md assume Windows; adjust for Mac/Linux)

## Running locally

```bash
cd C:\MHome\MContainer
npm install
npm run dev
# Opens at localhost:3000
```

## Running tests

```bash
npx tsc --noEmit     # type check — must be 0 errors
npx vitest run       # behavioral tests — must be 243 pass
```

## Project structure

```
src/
  app/                  Next.js app router entry (page.tsx = main layout)
  components/
    objects/            ContainerSkin.tsx — the core per-voxel renderer (~2500 lines)
    three/              Scene.tsx, GroundManager, ContainerMesh, WalkthroughControls
    ui/                 SmartHotbar, Sidebar, TopToolbar, modals, context menus
  config/               themes, materialCache, groundPresets, pbrTextures, containerPresets
  hooks/                useInputHandler (keyboard), useHighlightState
  store/
    useStore.ts         Entry point — 252 lines, middleware chain only
    slices/             7 slice files — ALL business logic lives here
  types/                container.ts — the primary type definitions
  utils/                applyPalette, exportGLB, adjacencyDetection
  __tests__/            23 test files, 243 behavioral tests
```

## Key concepts

### Voxel Grid

Each shipping container is divided into a grid of **32 voxels** (8 columns × 4 rows) per level, with up to 2 levels (64 voxels total). Each voxel has 6 faces (top, bottom, north, south, east, west) that can be independently set to any `SurfaceType` — Open, Solid_Steel, Glass_Pane, Deck_Wood, Railing_Cable, Concrete, Door, Stairs, etc.

Body voxels (cols 1-6, rows 1-2) form the main container interior. Extension voxels (border cols/rows) are optional deck/awning halos outside the steel frame.

### Container Data Model

```ts
interface Container {
  id: string;
  size: ContainerSize;           // Standard20, Standard40, HighCube40
  position: { x, y, z };
  rotation: number;              // radians around Y axis
  voxelGrid: Voxel[];            // 64 voxels (32 per level × 2 levels)
  level: number;                 // stacking level (0 = ground)
  stackedOn: string | null;      // ID of container below
  supporting: string[];          // IDs of containers above
  walls: Record<WallSide, Wall>; // legacy bay wall system
  furniture: FurnitureItem[];    // placed GLB furniture
  // ... zones, mergedWalls, extensions, etc.
}
```

### Theme System

Three visual themes (Industrial, Japanese Modern, Desert Modern) each provide a complete `ThemeMaterialSet` of 9 PBR materials (steel, glass, wood, frame, etc.). Materials are built once at module load in `src/config/materialCache.ts` and shared across all components. Theme switching updates the materials in-place and triggers re-render.

### Store Slices

The Zustand store is composed of 7 slices, each owning a distinct domain:

| Slice | Domain |
|-------|--------|
| containerSlice | Container CRUD, zones, furniture, stacking, adjacency |
| voxelSlice | Face mutations, staircases, doors, modules, bucket tool |
| environmentSlice | Time of day, theme, view mode, camera, ground |
| uiSlice | Hover state, grab mode, face preview, hotbar tab |
| selectionSlice | Selection, brush, hotbar slots, clipboard |
| dragSlice | Container/furniture drag, context menus |
| librarySlice | Library, palettes, custom hotbar, export/import |

The middleware chain wraps all slices: `persist(temporal(slices))`. Undo tracks only containers/zones/furnitureIndex. Persistence includes those plus environment, pricing, library, and palettes.

### Rendering Pipeline

1. **Scene.tsx** sets up sky, lighting, fog, environment map, post-processing
2. **ContainerMesh.tsx** renders per-container: furniture GLBs, bay walls, highlights
3. **ContainerSkin.tsx** renders per-voxel: up to 6 face planes per voxel using materials from `materialCache.ts`, plus hitbox meshes for interaction
4. **GroundManager.tsx** renders the ground plane (solid color + displacement for grass, PBR textures for other presets)

## Before your first PR

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 243 pass
3. Open `localhost:3000` and manually verify your change looks correct in 3D view
4. Check `CLAUDE.md` for the full list of invariants and anti-patterns

## Reference docs

| Document | Purpose |
|----------|---------|
| `MODUHOME-V1-ARCHITECTURE-v2.md` | Full architecture reference (store, rendering, voxel model) |
| `CURRENT-QUALITY-ASSESSMENT.md` | Feature ratings with Playwright evidence |
| `DEAD-CODE-AUDIT.md` | File inventory — what's active, what's dead |
| `CLAUDE.md` | Development invariants, anti-patterns, keyboard controls |
| `ONBOARDING.md` | This file |
