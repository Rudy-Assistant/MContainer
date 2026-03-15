# Sprint 2 Report — Visual Verification + UX Bug Diagnosis

**Date:** 2026-03-11

---

## Adjacency Auto-Merge Verification

**Result: WORKING**

Playwright MCP browser verification confirmed that Sprint 1's adjacency auto-merge renders correctly:
- Two 40ft HC containers placed flush along Z axis (z=0, z=2.44)
- `refreshAdjacency` detected 1 shared wall, culled 24 faces
- `_preMergeWalls` saved 6 Solid_Steel faces per container (body boundary voxels)
- Boundary faces mutated to Open in voxelGrid
- **Visually, the shared wall is invisible** — containers appear as one continuous structure

Screenshot: `sprint2-1b-adjacency-clean.png`

---

## Root Cause Analysis

### Bug 1: Extension Hover (MODERATE — DEFERRED)

**Root cause:** `BaseplateCell` hitbox is a 0.02m-tall floor slab at Y=0.015 with `userData: { isBay: true }`. It has no `containerId`, `voxelIndex`, or `face` data. Raycast only hits when camera looks nearly straight down. Active voxels have per-face edge strip hitboxes (n/s/e/w) at wall height with full identity data.

**Why not fixed:** Proper fix requires replicating the edge strip system from active voxels into BaseplateCell (~50 lines, exceeds 30-line sprint limit). The floor hitbox architecture is fundamentally incompatible with wall hover — it needs wall-height per-face hitbox meshes.

**Deferred to:** Sprint 3

### Bug 2: Voxel Preview Proportions (LOW — FIXED)

**Root cause:** `VoxelPreview3D.tsx` line 264-267 hardcoded dimensions (`nW=2.03, nH=2.90, nD=1.22`) matching only 40ft HighCube containers. 20ft containers show 2× wrong width, 40ft Standard shows wrong height.

**Fix:** Read `containerSize` from store, compute dimensions dynamically via `CONTAINER_DIMENSIONS[containerSize]`:
- `nW = dims.length / 6` (colPitch)
- `nH = dims.height` (vHeight)
- `nD = dims.width / 2` (rowPitch)

**File:** `src/components/ui/VoxelPreview3D.tsx`

### Bug 3: Scroll ↔ Hotbar Sync (LOW — FIXED)

**Root cause:** `handleEdgeWheel()` in ContainerSkin.tsx called `setVoxelFace()` to update the material but never called `setHoveredVoxelEdge()`. SmartHotbar reads `hoveredVoxelEdge` to know which face is being interacted with — without that update, the hotbar couldn't sync.

**Fix:** Added `store.setHoveredVoxelEdge({ containerId, voxelIndex, face })` after `setVoxelFace()` in `handleEdgeWheel`.

**File:** `src/components/objects/ContainerSkin.tsx`

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/objects/ContainerSkin.tsx` | Added `setHoveredVoxelEdge` call in `handleEdgeWheel` (1 line) |
| `src/components/ui/VoxelPreview3D.tsx` | Dynamic voxel dimensions from container spec (4 lines changed) |
| `MODUHOME-V1-ARCHITECTURE.md` | §8 Known Issues updated (3 resolved, 1 deferred with root cause), §9 Sprint History added |

---

## Verification

- `npx tsc --noEmit` → **0 errors**
- `npx vitest run` → **7 passed, 0 failed**
- Dev server: **http://localhost:3000** — running, app loads

## Screenshots

- `sprint2-1a-baseline.png` — Initial app load (1 container, all UI elements visible)
- `sprint2-1b-adjacency-clean.png` — Two containers flush, shared wall visually Open
- `sprint2-post-fix-baseline.png` — Post-fix app state (no regressions)
