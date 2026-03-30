# ModuHome

A browser-based 3D architectural engine for designing shipping container homes. Users compose modular containers into multi-level structures, paint surfaces with real materials, place furniture, and visualize designs in real-time 3D — including first-person walkthroughs and blueprint mode.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see a 3D scene with a default shipping container ready to edit.

### Prerequisites

- Node.js 18+ (tested on v24)
- Windows recommended (paths in tooling assume Windows; adjust for Mac/Linux)

## Features

**3D Design Engine**
- Place and arrange 20ft, 40ft, and High Cube shipping containers on a 3D grid
- Stack containers up to 3 levels with automatic structural validation
- Drag-and-drop positioning with sticky snap alignment and adjacency auto-merge
- Real-time Bill of Materials (BOM) cost tracking

**Surface Materials**
- Per-voxel face painting — each of the 6 faces on each voxel can be independently styled
- 15+ surface types: Steel, Glass, Wood Deck, Concrete, Railing, Doors, Stairs, and more
- Theme system with Industrial, Japanese, and Desert presets
- PBR materials with metalness, roughness, and environment mapping

**Visualization Modes**
- **3D Orbit** — free camera with orbit, pan, and zoom
- **Blueprint** — orthographic top-down view for layout planning
- **First-Person Walkthrough** — WASD + mouse look with voxel collision, auto-tour, and pointer lock

**Environment**
- Dynamic sky with time-of-day sun orbit (0-24h)
- Directional shadow mapping with PCFSoft filtering
- Stars at night, atmospheric scattering during golden hour

**UI**
- 10-slot hotbar with keyboard shortcuts (1-9, 0)
- Inspector panel with 2D block grid (floor, ceiling, and frame views)
- Context menus, modals, and a sidebar with library/inspector modes
- Undo/redo with full temporal history

**Export**
- GLB model export
- Design sharing via compressed URL parameters

## Architecture

The application is built on:

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| 3D Rendering | Three.js 0.182, @react-three/fiber 9, @react-three/drei 10 |
| State | Zustand 5 (7 slices) + Immer + Zundo (undo/redo) + idb-keyval (persistence) |
| Validation | Zod 4 |
| Testing | Vitest, Playwright |

### Store Architecture

All business logic lives in 7 Zustand slices under `src/store/slices/`:

| Slice | Purpose |
|-------|---------|
| `containerSlice` | Add/remove/move/rotate/stack containers |
| `voxelSlice` | Voxel grid operations (faces, materials, groups) |
| `uiSlice` | View mode, modals, toolbar state |
| `selectionSlice` | Selected container, voxel, face, bay |
| `dragSlice` | Drag state, ghost transforms, snap points |
| `librarySlice` | User presets, favorites, collections |
| `sceneObjectSlice` | Furniture and fixture placement |

Middleware chain: Immer (inner) -> Zundo (temporal) -> Persist (outer, idb-keyval).

### Voxel Grid

Each container is divided into **32 voxels** (8 columns x 4 rows). Each voxel has 6 independently paintable faces (top, bottom, north, south, east, west). Body voxels (cols 1-6, rows 1-2) form the main interior. Extension voxels (border cols/rows) are optional deck/awning areas outside the steel frame.

### Project Structure

```
src/
  app/                    Next.js App Router entry point
  components/
    three/                3D scene graph, camera, lights, post-processing
    objects/              Container meshes, skins, ghosts, furniture renderers
    ui/                   Toolbar, sidebar, hotbar, inspector, modals (36 components)
  config/                 Themes, materials, presets, registries (30 files)
  store/
    useStore.ts           Store entry — middleware chain and types
    slices/               7 slice files — all business logic
  types/                  TypeScript type definitions
  hooks/                  Custom React hooks
  utils/                  Geometry, export, validation, spatial math
  Testing/                79 behavioral test files
```

## Scripts

```bash
npm run dev              # Start dev server (Next.js with webpack)
npm run build            # Production build
npm run test             # Run all tests (vitest)
npm run lint             # ESLint
npm run gates            # Acceptance gates (visual + functional)
npm run baselines        # Capture visual baselines for regression tests
npm run quality          # Generate quality assessment report
npm run test:e2e         # Playwright end-to-end tests
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| 1-9, 0 | Hotbar material slots |
| Tab, -, = | Switch hotbar rows |
| Alt+3 / Alt+4 | 3D / Blueprint view |
| F | First-person walkthrough |
| V | Cycle view modes |
| Left-drag | Move container |
| R / Q | Rotate container |
| Delete | Remove selected container |
| Alt+click | Eyedropper (sample material) |
| C | Clear face to default |
| E | Apply stamp/material |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| PgUp / PgDn | Level slicer (multi-level) |
| W/A/S/D, Q/Z | First-person movement (walkthrough mode only) |

## Testing

Tests are behavioral — they call real functions and assert on return values or state changes. No source-scanning tests.

```bash
npx vitest run                  # Run all 307 tests
npx vitest run --reporter=verbose  # Verbose output
npx tsc --noEmit                # Type check (must be 0 errors)
```

Test files live in `src/Testing/` (79 files covering store mutations, validation, spatial math, and rendering invariants).

## Documentation

| Document | Purpose |
|----------|---------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow, PR process, coding standards |
| [ONBOARDING.md](ONBOARDING.md) | New developer quick-start and key concepts |
| [MODUHOME-V1-ARCHITECTURE-v2.md](MODUHOME-V1-ARCHITECTURE-v2.md) | Architecture reference (source of truth) |
| [CURRENT-QUALITY-ASSESSMENT.md](CURRENT-QUALITY-ASSESSMENT.md) | Auto-generated feature quality ratings |
| [CLAUDE.md](CLAUDE.md) | AI assistant project instructions |

Sprint reports and handoff docs are in `docs/handoff/`.

## License

Private. All rights reserved.
