# Sprint 1 Findings — Adjacency Auto-Merge Code Reads

## CR1: V1's Existing Merge Tracking

**Files:** `src/store/useStore.ts` (lines 1404-1451), `src/store/spatialEngine.ts` (lines 312-486)

V1 already has a sophisticated adjacency system:
- `Container.mergedWalls: string[]` — format `"otherContainerId:wallSide"`, tracks which walls are adjacent
- `findAdjacentPairs(containers)` in spatialEngine.ts — O(n²) scan, `ADJACENCY_TOLERANCE = 0.15m`, same-Y-level check
- `refreshAdjacency()` — calls findAdjacentPairs, updates mergedWalls on each container, then calls `computeGlobalCulling()`
- `computeGlobalCulling()` — returns `globalCullSet: Set<string>` with entries like `"containerId:voxelIndex:faceDir"`
- **Current system is VISUAL ONLY** — globalCullSet suppresses rendering in ContainerSkin (line 1843: `if (globalCullSet.has(...)) return null`), but voxel face DATA is unchanged

**Gap:** No `_preMergeWalls` save/restore. No actual voxel face mutation. BOM and export see the original Solid_Steel faces, not Open.

## CR2: Container Position/Dimension Model

**File:** `src/types/container.ts` (lines 23-27, 120-124), `src/store/spatialEngine.ts` (lines 75-89)

- Position: `{ x, y, z }` + `rotation: number` (radians around Y)
- Dimensions: `length` = Z-axis, `width` = X-axis, `height` = Y-axis
- 40ft HC: 12.19m × 2.44m × 2.90m
- AABB: `getFootprint(c)` returns rotation-aware `{ minX, maxX, minZ, maxZ }`
- Y-axis stacking: position.y = bottom container height for level 1

## CR3: V1's Wall/Bay Model

**File:** `src/types/container.ts` (lines 39-249)

Two parallel systems:
1. **Bay modules** — `walls[WallSide].bays[i].module` (PanelSolid/PanelGlass/HingedWall/OpenVoid). Legacy wall-panel system for context menu module swaps.
2. **Voxel faces** — `voxelGrid[i].faces.{top,bottom,n,s,e,w}` (SurfaceType). Powers ContainerSkin rendering, the user-visible 3D view.

**For auto-merge:** Mutate voxel faces (what the user sees). Bay modules can remain as-is. The voxel grid boundary faces on shared walls are what need to change from Solid_Steel → Open.

Grid: 4 rows × 8 cols. Body: rows 1-2, cols 1-6. Extensions: row 0/3, col 0/7.

## CR4: V2's Auto-Merge Reference

**Files:** `C:\MHome\src\utils\adjacencyDetection.ts`, `C:\MHome\src\state\store.ts` (lines 86-223)

V2 algorithm:
1. `CONTACT_EPSILON = 0.001m`, default tolerance `0.05m`
2. Atomic pattern: `clearAllMerges(draft)` → mutate position → `recomputeAllMerges(draft)`
3. `clearAllMerges`: restores all Open faces from `_preMergeWalls` back to original surface
4. `recomputeAllMerges`: O(n²) pair scan → `mergeBoundaryVoxels` for each adjacent pair
5. `mergeBoundaryVoxels`: for each boundary voxel at the shared face, if `Solid_Steel` → save to `_preMergeWalls`, set to `Open`
6. `_preMergeWalls: Record<string, SurfaceType>` on each container, key format `"${voxelIndex}_${face}"`
7. Only merges `Solid_Steel` — preserves user-painted faces
8. On hydration: `rebuildMergeTracking` reconstructs `_preMergeWalls` from persisted Open faces

## CR5: V1's Action Trigger Points

**File:** `src/store/useStore.ts`

### Actions that DO call refreshAdjacency:
| Action | Line | Call |
|--------|------|------|
| addContainer | 718 | `requestAnimationFrame(() => get().refreshAdjacency())` |
| removeContainer | 770 | `requestAnimationFrame(() => get().refreshAdjacency())` |
| updateContainerPosition | 781 | `requestAnimationFrame(() => get().refreshAdjacency())` |
| updateContainerRotation | 792 | `requestAnimationFrame(() => get().refreshAdjacency())` |
| commitContainerDrag | 1833 | `requestAnimationFrame(() => get().refreshAdjacency())` |

### Actions that DO NOT call refreshAdjacency (GAPS):
| Action | Line | Issue |
|--------|------|-------|
| resizeContainer | 803 | Container footprint changes, adjacency invalid |
| stackContainer | 1325 | Y-position changes, stacking adjacency invalid |
| unstackContainer | 1373 | Y-position changes back to 0, adjacency invalid |
