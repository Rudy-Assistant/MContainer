# ModuHome V1 → V2 Audit & Findings Report

**Date:** 2026-03-12
**Auditor:** Claude Code (Sprint 17 post-implementation)
**Scope:** Full application state, hover/selection system, architecture gap analysis

---

## 1. Executive Summary

ModuHome V1 (MContainer) is a browser-based 3D shipping container home designer built on Next.js 16 + React 19 + Three.js + Zustand 5. It has **227 passing unit tests**, **0 type errors**, and implements ~80% of the V2 feature set. However, several **fundamental interaction regressions** exist that block productive use:

1. **Hover highlights are barely visible** in the 3D viewport despite correct store state
2. **Wall face hover is limited to extension voxels** — body voxel wall faces (n/s/e/w) rarely fire
3. **Only `top` face detected** on body voxels from the default camera angle
4. **No visible 3D highlight** on hovered voxels at production opacity levels

The gap between V1 and V2 is significant in interaction architecture: V2 uses a single `ContainerInteractor` box with `normalToFaceKey()` math, while V1 uses per-face invisible hitbox meshes in `ContainerSkin.tsx`. V1's approach creates more hitbox meshes but has R3F raycast priority issues.

---

## 2. Architecture Comparison

### 2.1 Stack Differences

| Component | V1 (MContainer) | V2 (MHome) |
|-----------|-----------------|------------|
| Framework | Next.js 16.1.6 (App Router, SSR) | Vite 6.4.1 (SPA, no SSR) |
| State middleware | persist > temporal > plain zustand | persist > temporal > immer > zustand |
| Immer | NOT used | Immer 11.1.4 |
| Physics | NOT installed | @react-three/rapier 2.2.0 |
| CSG | NOT installed | @react-three/csg 4.0.0 |
| BVH | NOT installed | three-mesh-bvh 0.9.9 |
| Camera | drei CameraControls | camera-controls 3.1.0 (standalone) |
| Rendering | Per-voxel face meshes (ContainerSkin) | 6-panel shell (ContainerSurfaces) |
| Interaction | Per-face hitbox meshes (100+ per container) | Single ContainerInteractor box |

### 2.2 Rendering Architecture

**V1 (ContainerSkin):**
```
ContainerSkin
├── VoxelPopIn (mount animation)
│   └── AllLevel0Voxels (loop over 32 cells per level)
│       ├── VoxelGroup (per active voxel)
│       │   ├── SingleFace × 6 (visual + hitbox mesh each)
│       │   ├── VoxelEdgeStrip (hover highlight)
│       │   ├── HoverGlow (emissive overlay)
│       │   └── SelectionGlow (emissive overlay)
│       └── BaseplateCell (inactive extension voxels)
└── DollhouseCutaway
```

**V2 (ContainerSurfaces):**
```
ContainerSurfaces
├── 6 PlaneGeometry panels (floor, ceiling, 4 walls)
├── Painted face overlays (top/bottom only — wall overlays P0 missing!)
└── All meshes: raycast={() => {}}

ContainerInteractor (separate component)
├── Single invisible BoxGeometry (body dimensions only)
├── normalToFaceKey() → face from hit normal
├── pointToVoxelIndex() → voxel from hit point
└── ONLY raycast-enabled mesh per container
```

### 2.3 Key Architectural Decision

V2 made a deliberate choice: **one raycast target per container** (ContainerInteractor) that computes face/voxel from hit math. This eliminates R3F raycast priority issues but means **extension voxels are 2D-inspector-only** (the interactor box covers body dimensions only).

V1 uses the older approach: **many hitbox meshes** (SingleFace, EdgeStrip, BaseplateCell) each with their own pointer handlers. This creates more flexible per-face interaction but suffers from raycast occlusion and priority issues.

---

## 3. Hover System Diagnosis

### 3.1 Current State (Playwright Testing)

**Test method:** Systematic mouse sweep across 3D container (40ft High Cube at origin, default camera angle). Hover tracker installed via `window.__store.subscribe()`.

**Results from 15+ mouse positions:**

| Voxel Index | Row, Col | Type | Faces Detected |
|-------------|----------|------|----------------|
| 1 | R0, C1 | Extension (inactive) | n, w |
| 8 | R1, C0 | Extension (inactive) | n |
| 10 | R1, C2 | Body | top |
| 11 | R1, C3 | Body | top |
| 12 | R1, C4 | Body | top |
| 13 | R1, C5 | Body | top |
| 19 | R2, C3 | Body | top (no face) |
| 21 | R2, C5 | Body | top |
| 22 | R2, C6 | Body | top |

**Key findings:**
- **Body voxels: ONLY `top` face detected.** No `n`, `s`, `e`, `w` wall faces were hit on any body voxel from the default camera angle.
- **Extension voxels: wall faces (`n`, `w`) detected** — BaseplateCell wall hitboxes work for extensions.
- **Several body voxels never hit:** indices 9, 14, 17, 18, 20 were not reached (could be camera angle limitation).
- **`hoveredVoxelEdge` often null** for body voxels — the edge strip hitboxes are not firing even when `hoveredVoxel` is set.

### 3.2 Root Cause Analysis

The hover event flow in V1:

```
Pointer event on canvas
  → R3F raycaster intersects ALL meshes with raycast handlers
    → Closest hit wins (depth-based)
      → If SingleFace hitbox: setHoveredVoxel({ containerId, index })
      → If VoxelEdgeStrip: setHoveredVoxelEdge({ containerId, voxelIndex, face })
      → If BaseplateCell wall face: setHoveredVoxel + setHoveredVoxelEdge
```

**Problem 1: Edge strips are thin and hard to hit.** VoxelEdgeStrip geometry is a narrow rail at the edge of each voxel face. From the default camera angle (front-east quadrant, looking down), the front wall's edge strips are nearly edge-on and barely intersectable. The `top` face hitbox (ceiling quad) is a large horizontal plane that dominates raycasting.

**Problem 2: VoxelHoverHighlight filters on `hoveredVoxel.isExtension`.** Line 2419:
```typescript
if (hoveredVoxel && hoveredVoxel.containerId === container.id && !hoveredVoxel.isExtension && hoveredVoxel.index !== undefined)
```
This check works (isExtension is undefined for body hovers, so `!undefined === true`), but the highlight only renders when `hoveredVoxelEdge` provides a face — and edge is often null for body voxels.

**Problem 3: Highlight opacity too low.** After Sprint 17 color tuning, floor highlight is 0.2 opacity and wall highlight is 0.15 opacity. These are nearly invisible against the dark steel container material, especially in the Playwright headless renderer.

### 3.3 Comparison with SS50 (Working State)

Screenshot SS50 shows the app with clearly visible:
- Cyan selection highlight on a body voxel (floor fill visible)
- Yellow hover indicator on a different voxel
- Cyan edge line on the selected wall face
- 3D voxel preview in inspector

This working state had:
- **Higher highlight opacity** (the cyan fill is clearly visible)
- **Edge strips that were being hit** (wall face hover was working)
- **Debug hitboxes were tuned** for reliable intersection

### 3.4 Recommended Fixes

1. **Increase highlight opacity** back to visible levels: floor 0.3, wall 0.25 (V2 uses 0.3/0.15)
2. **Ensure edge strips have sufficient thickness** — they may need to be wider to be hittable from typical camera angles
3. **Consider V2's approach**: single ContainerInteractor box with `normalToFaceKey()` math instead of per-face hitbox meshes
4. **The wireframe outline should always render** on hover (currently conditional on isHovered which excludes selection)

---

## 4. Feature Status Matrix

### 4.1 Production Features (Working)

| Feature | V1 Status | V2 Status | Notes |
|---------|-----------|-----------|-------|
| Container CRUD | PRODUCTION | PRODUCTION | Add, remove, rename, resize |
| Voxel face painting | PRODUCTION | PRODUCTION | 16 SurfaceTypes, hotbar presets |
| Container stacking | PRODUCTION | PRODUCTION | Multi-level with ceiling/floor propagation |
| Adjacency auto-merge | PRODUCTION | PRODUCTION | Solid_Steel→Open, preserves user-painted |
| Extension auto-door | PRODUCTION | N/A | Sprint 16: deck→Door, interior→Open |
| Undo/redo | PRODUCTION | PRODUCTION | zundo temporal, 50 snapshots |
| IDB persistence | PRODUCTION | PRODUCTION | Zod validation on hydration |
| 3 PBR themes | PRODUCTION | PRODUCTION | Industrial, Japanese, Desert |
| Theme textures | PRODUCTION | PRODUCTION | 11 PBR texture directories |
| Furniture GLB loading | PRODUCTION | PARTIAL | 30 Kenney GLBs (V1), colored boxes (V2 P0) |
| BOM cost tracking | PRODUCTION | PRODUCTION | Structure/Envelope/Interior |
| Model homes | PRODUCTION | N/A | 6 pre-designed templates |
| Container roles | PRODUCTION | N/A | Assign semantic roles |
| Module presets | PRODUCTION | N/A | Kitchen, Bathroom, etc. hotbar |
| JSON export/import | PRODUCTION | PRODUCTION | Full state serialization |
| Sun/sky system | PRODUCTION | PRODUCTION | Time-of-day orbit, shadows |
| User library | PRODUCTION | N/A | Save blocks, containers, home designs |

### 4.2 Functional but Degraded

| Feature | Issue |
|---------|-------|
| 3D hover highlights | Store state correct, visual highlights too subtle/invisible |
| Wall face hover | Edge strips not reliably hit from default camera angle |
| Selection highlights | Wireframe visible but fill opacity may be too low |
| Furniture placement | GLB Y-offset was doubled (fixed Sprint 17) |
| First-person view | PointerLock error in headless (non-blocking) |

### 4.3 Not Implemented (V2 Targets)

| Feature | V2 Status | V1 Gap |
|---------|-----------|--------|
| CSG window/door cutouts | 10 todo tests, no implementation | @react-three/csg not installed |
| Walkthrough mode (WASD) | 11 todo tests, bvhecctrl not mounted | Partial (PointerLockControls exists) |
| Props system (3D objects) | Interface+actions exist, no rendering | Not started |
| Eyedropper tool | Type exists, no implementation | Not started |
| Glass MeshPhysicalMaterial | P0 — currently MeshStandard opacity:0.4 | Same issue in V1 |
| Orthographic blueprint | Not started | Not started |
| Rapier wall collision | Not installed | Not installed |
| Per-voxel wall overlays | P0 — store works, no 3D visual | V1 has per-face rendering |

---

## 5. Smart Systems Status

| System | Status | Implementation |
|--------|--------|---------------|
| Adjacency auto-merge | PRODUCTION | `refreshAdjacency` + `_preMergeWalls` tracking |
| Extension auto-door | PRODUCTION | `_applyExtensionDoors` / `_restoreExtensionDoors` |
| Staircase auto-void | FUNCTIONAL | Intra-container works; cross-container partial |
| Smart placement | FUNCTIONAL | Auto-offset on overlap (4 directions + stack) |
| Smart railing | FUNCTIONAL | `applySmartRailing` detects exposed edges |
| Door state cycles | FUNCTIONAL | `toggleDoorState`: closed→open_swing→open_slide |
| Context-aware UI | NOT IMPL | Hotbar doesn't filter by raycaster target |
| CSG morphing | NOT IMPL | @react-three/csg not installed |
| RevoluteJoint doors | NOT IMPL | State cycle only, no physics hinge |

---

## 6. Test Infrastructure

### 6.1 Unit Tests (Vitest)

| Metric | Count |
|--------|-------|
| Test files | 21 |
| Passing tests | 227 |
| Source-scanning tests | 0 |
| Tautological tests | 2 |
| Net behavioral tests | 225 |
| Store actions tested | 51 of 143 (36%) |
| Store actions untested | 92 (64%) |

### 6.2 Test Coverage Gaps

| Domain | Tested Actions | Untested Actions |
|--------|---------------|-----------------|
| Container CRUD | 8 | ~5 (rename, resize, etc.) |
| Voxel painting | 8 | ~15 (cycleVoxelFace, stampArea, etc.) |
| Selection | 5 | ~8 (toggleVoxelInSelection, etc.) |
| Camera/View | 6 | ~12 (setCameraAngles, savedCamera, etc.) |
| Drag | 0 | ~8 (startContainerDrag, commit, cancel) |
| Furniture | 3 | ~4 (moveFurniture, setDragFurniture) |
| Zones | 0 | ~6 (createZone, addContainerToZone, etc.) |
| Hotbar | 0 | ~6 (setHotbar, setActiveCustomSlot, etc.) |
| Library | 0 | ~8 (saveBlockToLibrary, loadHomeDesign, etc.) |

### 6.3 E2E Tests (Playwright)

19 Playwright E2E checks exist but were not run in this audit due to Chrome session conflicts. The E2E suite covers basic container operations and rendering.

---

## 7. Code Quality

### 7.1 Codebase Size

| File | Lines | Role |
|------|-------|------|
| `src/store/useStore.ts` | 3,529 | Main store (143 actions) |
| `src/components/objects/ContainerSkin.tsx` | 2,561 | Per-voxel face rendering + hitboxes |
| `src/components/three/ContainerMesh.tsx` | 2,542 | Bay walls, furniture, hover highlights |
| `src/components/three/Scene.tsx` | ~1,500 | Scene setup, ghost planes, drag |
| Total source | ~33,000 | 84 .ts/.tsx files |

**Note:** CLAUDE.md claims the store is "37K lines" — actual measured size is 3,529 lines. The 37K figure is incorrect and should be updated.

### 7.2 Dead Code

11 files (~1,785 lines) identified as potentially dead:
- `src/systems/InteractionManager.ts` — legacy bay interaction, may conflict with voxel system
- Several unused utility files from early development
- ContainerMesh.tsx bay rendering code (~1,000 lines) that duplicates ContainerSkin functionality

### 7.3 Dual Data Model

Both bay modules (`Container.walls[side].bays[]`) and voxel grid (`Container.voxelGrid`) exist. **Voxel grid is the rendering source of truth.** Bay modules exist for structural/pricing calculations but are NOT synced with voxel state. This creates confusion and potential inconsistency.

---

## 8. Known Regressions (Sprint 17)

### 8.1 Fixed This Sprint

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| SSR "document is not defined" | THREE.TextureLoader at module scope | Lazy `getTextureLoader()` + SSR guard |
| Hover highlights invisible | Extension voxel `active:false` filter + no floor/wall meshes | Extension mapping + floor/wall overlay meshes |
| GLB furniture double Y-offset | `FurniturePiece` +height/2 AND `GLBModel` +scaledHeight/2 | Removed redundant GLBModel offset |

### 8.2 Outstanding Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| Wall face hover unreliable | HIGH | Edge strip hitboxes too thin to intersect from default camera angle. Only `top` face detected on body voxels. |
| Highlight opacity too low | MEDIUM | Floor=0.2, wall=0.15 opacity nearly invisible against dark steel. Should be 0.3/0.25. |
| PointerLock error badge | LOW | "Unable to use Pointer Lock API" in headless/Playwright. Non-blocking. |
| Store size claim incorrect | LOW | CLAUDE.md says 37K lines, actual is 3,529. |

---

## 9. Voxel Grid Reference

```
Level 0 (ground floor): indices 0-31
Level 1 (second floor): indices 32-63

Per level (8 cols × 4 rows = 32 voxels):

     Col: 0    1    2    3    4    5    6    7
Row 0:   [0]  [1]  [2]  [3]  [4]  [5]  [6]  [7]    ← Extension (ext_n)
Row 1:   [8]  [9]  [10] [11] [12] [13] [14] [15]   ← Body (cols 1-6) / Ext (cols 0,7)
Row 2:   [16] [17] [18] [19] [20] [21] [22] [23]   ← Body (cols 1-6) / Ext (cols 0,7)
Row 3:   [24] [25] [26] [27] [28] [29] [30] [31]   ← Extension (ext_s)

Body voxels (active by default): 9-14, 17-22 (12 per level, 24 total)
Extension voxels (inactive by default): 0-8, 15-16, 23-31 (20 per level, 40 total)
Corner voxels: 0, 7, 24, 31 (per level)
```

Each voxel has 6 faces: `top`, `bottom`, `n`, `s`, `e`, `w`
- `top`/`bottom` = ceiling/floor (horizontal)
- `n`/`s` = north/south walls (along width/Z axis)
- `e`/`w` = east/west walls (along length/X axis)

---

## 10. Recommendations for Contributors

### 10.1 Getting Started

```bash
cd C:\MHome\MContainer
npm install
npm run dev          # Start dev server on port 3000
npx tsc --noEmit     # Type check (must be 0 errors)
npx vitest run       # Unit tests (227 must pass)
```

### 10.2 Key Files to Read First

1. `CLAUDE.md` — Project rules and anti-patterns
2. `MODUHOME-V1-ARCHITECTURE-v2.md` — Current architecture (rebuilt from code audit)
3. `src/store/useStore.ts` — Central store (all state + 143 actions)
4. `src/types/container.ts` — Data model types
5. `src/components/objects/ContainerSkin.tsx` — 3D voxel rendering + hitboxes
6. `src/components/three/ContainerMesh.tsx` — Bay walls, furniture, hover highlights

### 10.3 Critical Rules

1. **Never refactor or split the store** — it works, add to it
2. **Never use `useStore(s => s)`** — subscribes to entire state, kills FPS
3. **No inline objects/arrays in useStore selectors** — infinite re-render
4. **Browser-verify all UX changes** — `tsc` + tests passing ≠ working
5. **If it breaks, revert immediately** — working app > broken improvements
6. **Run `/simplify` after implementation** — catches dead code and reuse opportunities

### 10.4 Priority Work Items

| Priority | Task | Effort |
|----------|------|--------|
| P0 | Fix wall face hover on body voxels (edge strip thickness or ContainerInteractor approach) | Medium |
| P0 | Increase hover highlight opacity to visible levels (0.3/0.25) | Trivial |
| P1 | Upgrade glass to MeshPhysicalMaterial with transmission | Small |
| P1 | Clean up dead code (11 files, ~1,785 lines) | Small |
| P1 | Test remaining 92 untested store actions | Large |
| P2 | Implement CSG window/door cutouts | Large |
| P2 | Implement proper walkthrough mode with WASD | Medium |
| P2 | Resolve dual data model (bay modules vs voxel grid) | Large |

---

## 11. Sprint 17 Changes Summary

| Stream | What Changed | Files |
|--------|-------------|-------|
| Stream 0 | SSR TextureLoader fix | ContainerSkin.tsx |
| Stream 1 | Hover highlight: floor/wall overlays + extension voxel mapping + geometry cache | ContainerMesh.tsx |
| Stream 2 | GLB furniture double Y-offset fix | ContainerMesh.tsx |
| Stream 3 | Test quality audit (225 real behavioral tests) | SPRINT-17-TEST-AUDIT.md |
| Colors | Unified highlight palette: amber hover (#ffcc00), cyan select (#00bcd4) | ContainerMesh.tsx, ContainerSkin.tsx |

---

*Generated by Claude Code — Sprint 17 post-implementation audit, 2026-03-12*
