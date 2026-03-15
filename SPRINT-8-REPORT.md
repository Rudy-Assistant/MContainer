# Sprint 8 Report — Hover Fix, Door States, Model Homes, Cross-View Verification

**Date:** 2026-03-12

---

## Stream 0: Hover Highlight Root Cause Isolation

**Problem:** Yellow hover wireframe not appearing in 3D view despite VoxelHoverHighlight component being present.

**Root cause:** Ceiling/edge hitbox `onPointerLeave` handlers were clearing `hoveredVoxel` immediately. When mouse transited between hitboxes within the same voxel (e.g., floor quad → edge strip), hover flashed null for one frame, preventing VoxelHoverHighlight from rendering.

**Fix:** Added `onLeaveEdge` debounced helper (250ms setTimeout) applied to all 11 leave handlers (8 edge strips, 2 ceiling/floor quads, 1 FPV hitbox). Enter handlers cancel pending leave timers via `clearTimeout(leaveTimerRef.current)`.

**Verification (Playwright):**
| Check | Status |
|---|---|
| Hover voxel 19 shows yellow wireframe | PASS |
| Hover follows mouse to voxel 18 | PASS |
| Hover + 2D grid highlight synced | PASS |
| Highlight disappears after leaving container | PASS |
| Hover + selection coexist | PASS |

**Files:** `src/components/objects/ContainerSkin.tsx` (11 leave handlers updated)

---

## Stream 1: Door State System

**New type:** `DoorState = 'closed' | 'open_swing' | 'open_slide'` in `src/types/container.ts`

**New field:** `Voxel.doorStates?: Partial<Record<keyof VoxelFaces, DoorState>>`

**Store action:** `toggleDoorState(containerId, voxelIndex, face)`
- Door: closed → open_swing → open_slide → closed
- Glass_Shoji: closed → open_slide → closed (no swing)
- Non-door faces: no-op
- Syncs `openFaces[face]` boolean

**3D rendering:** DoorFace component extended with dual animation:
- `rotRef` for swing (Y-axis rotation, -π/2)
- `slideRef` for slide (lateral translation)
- `doorState` prop threaded through SingleFace → FaceVisual → DoorFace

**Verification (Playwright):**
- Door face set on voxel 11 → `faces.n = 'Door'`
- Toggle 1 → `doorStates.n = 'open_swing'`, `openFaces.n = true`
- Toggle 2 → `doorStates.n = 'open_slide'`, `openFaces.n = true`
- Toggle 3 → `doorStates.n = 'closed'`, `openFaces.n = false`

**Files:** `src/types/container.ts`, `src/store/useStore.ts`, `src/components/objects/ContainerSkin.tsx`, `src/components/ui/FaceContextMenu.tsx`

---

## Stream 2: Model Home System

**New file:** `src/config/modelHomes.ts` — 6 pre-designed multi-container templates

| Model | Containers | Layout |
|---|---|---|
| Micro Studio | 1×20ft | Single open-plan |
| Modern 1-Bedroom | 2×40ft | Side-by-side (living + bedroom) |
| Family 2-Bedroom | 3×40ft | L-shape (living + 2 bedrooms) |
| Two-Story Modern | 2×40ft | Stacked (living below, bedroom above) |
| Entertainer's Dream | 2×40ft | Side-by-side (living + deck) |
| Family Compound | 4×40ft | 2×2 square (living + 3 bedrooms) |

**Store action:** `placeModelHome(modelId, origin?)` — spawns containers with roles, positions, and connections. Uses temporal pause/re-pause pattern. Triggers `refreshAdjacency()` via rAF.

**UI:** Model Homes gallery added to UserLibrary.tsx Saved tab with emoji icons, labels, and container counts.

**Verification (Playwright):**
- Modern 1-Bedroom placed: 2 containers with living_room + bedroom roles
- Adjacency: "2 shared wall(s) detected, 32 faces culled"
- Inspector shows Bedroom role badge

**Files:** `src/config/modelHomes.ts`, `src/store/useStore.ts`, `src/components/ui/UserLibrary.tsx`

---

## Stream 3: Cross-View Verification

| View | Status | Evidence |
|---|---|---|
| 3D (default) | PASS | Containers render with steel walls, frame, decking. Selection wireframe visible. |
| Blueprint (BP) | PASS | Top-down layout with labels, sizes, Floor/Ceiling toggle. |
| First Person (FP) | PASS | Crosshair, WASD hints, furniture labels visible. Sidebar hidden. |
| Theme: Industrial | PASS | Default steel grey tones |
| Theme: Japanese Modern | PASS | Dark tones applied to all containers |
| Theme: Desert Modern | PASS | Sandy/cream tones applied to all containers |

**Screenshots:** `sprint8-view-3D-default.png`, `sprint8-view-BP.png`, `sprint8-view-FP.png`, `sprint8-japanese-theme.png`, `sprint8-desert-theme.png`

---

## Stream 4: Test Expansion

**New test files:**
- `src/__tests__/hover-door.test.ts` — 12 tests (HOV-1..3, DOOR-1..6)
- `src/__tests__/model-homes.test.ts` — 8 tests (MH-1..8)

| Test | Description | Status |
|---|---|---|
| HOV-1 | setHoveredVoxelEdge populates store | PASS |
| HOV-2 | Clearing hover sets null | PASS |
| HOV-3 | Hover state no undo entries | PASS |
| DOOR-1 | Door cycles closed→swing→slide→closed | PASS |
| DOOR-2 | Door state on specific face | PASS |
| DOOR-3 | Glass_Shoji cycles closed→slide→closed | PASS |
| DOOR-4 | Door state persists (in containers) | PASS |
| DOOR-5 | Undo reverts door state | PASS |
| DOOR-6a | toggleDoorState syncs openFaces | PASS |
| DOOR-6b | Independent multi-face door states | PASS |
| DOOR-6c | DoorState type compiles | PASS |
| DOOR-6 | Non-door face ignores toggle | PASS |
| MH-1 | placeModelHome creates containers | PASS |
| MH-2 | Roles applied to each container | PASS |
| MH-3 | Positions at correct offsets | PASS |
| MH-4 | Creates undo history | PASS |
| MH-5 | Adjacency fires after placement | PASS |
| MH-6 | Stacked Y positions correct | PASS |
| MH-7 | Catalog has ≥6 entries | PASS |
| MH-8 | Unknown ID returns undefined | PASS |

---

## Final Verification

```
npx tsc --noEmit     → 0 errors
npx vitest run       → 17 test files, 150 tests passed
Playwright           → All cross-view + feature checks PASS
```

---

## Files Changed

| File | Change |
|---|---|
| `src/types/container.ts` | Added DoorState type, doorStates field on Voxel |
| `src/store/useStore.ts` | toggleDoorState action, placeModelHome action |
| `src/config/modelHomes.ts` | NEW — 6 model home templates |
| `src/components/objects/ContainerSkin.tsx` | Hover debounce (11 handlers), DoorFace slide animation, doorState prop threading |
| `src/components/ui/UserLibrary.tsx` | Model Homes gallery in Saved tab |
| `src/components/ui/FaceContextMenu.tsx` | Door toggle with state label |
| `src/__tests__/hover-door.test.ts` | NEW — 12 hover + door tests |
| `src/__tests__/model-homes.test.ts` | NEW — 8 model home tests |
| `MODUHOME-V1-ARCHITECTURE.md` | Updated §8 smart systems, added door/model/hover sections |

## Known Issues

- zundo pause/resume is NOT reference-counted. Inner resume breaks outer pause. Workaround: re-pause after every sub-action in placeModelHome.
- Cross-container staircase void still PARTIAL (deferred to Sprint 9).
- Smart placement auto-offset still NOT IMPL (deferred to Sprint 9).
