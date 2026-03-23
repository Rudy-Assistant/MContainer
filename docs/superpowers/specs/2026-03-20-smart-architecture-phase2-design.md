# Smart Architecture Phase 2: Railing Smart Consequences — Design Spec

## Goal

Extend the Smart Architecture system with automatic railing placement on fall-hazard edges, smart corner pole placement at roof boundaries, wall-side bay group interaction in Simple mode, and staircase railing extension. All smart behaviors respect user overrides and support undo/redo.

## Context

Phase 1 (Sprint 17) established the pattern: `applyStairsFromFace` records face changes in `_smartStairChanges`, `removeStairs` reverses them, and undo/redo works automatically via Zustand temporal snapshots. Phase 2 extends this pattern to railings and poles.

### Existing Systems

- **Bay Groups** (`src/config/bayGroups.ts`): 15 groups covering 32 voxels — 4 corners, 6 extension sides, 2 extension ends, 3 body quads
- **Railing Autotiling** (`ContainerSkin.tsx`): `adjHasRailing()` + `connectedStart`/`connectedEnd` suppress shared posts between adjacent railing runs
- **WU-10 Pillars** (`ContainerSkin.tsx`): `pillarPositions` useMemo computes convex outer corners of voxels with ceilings
- **Smart Stair Tracking** (`voxelSlice.ts`): `_smartStairChanges.changedFaces` maps `"voxelIndex:face"` to original surface for reversal (stored on Voxel, persisted as part of voxelGrid)

### Tracking Pattern Differences

Two existing patterns for ephemeral/tracked state:

1. **Container-level ephemeral** (`_preMergeWalls`, `_preExtensionDoors`): Stripped from persist via `partialize` destructuring in `useStore.ts`. Recomputed on hydration.
2. **Voxel-level tracking** (`_smartStairChanges`): Persisted as part of `voxelGrid` (not stripped). Tracks per-stair changes for individual removal.

Phase 2's `_smartRailingChanges` uses pattern 1 (container-level, stripped from persist, recomputed on hydration) because railing changes span multiple voxels and are recomputable from grid state.

## Architecture

**Hybrid approach:**
- **Railings**: Store-driven smart changes with tracking (extends Phase 1 pattern). Railings are user-facing data that affects BOM, can be overridden, and need undo/redo.
- **Poles**: Render-computed placement from roof topology, with store records for per-pole user customization (show/hide, material, shape).
- **Independence**: Poles react to roofs (ceiling exists). Railings react to falls (open-air + exposed edge). Different triggers, different systems.
- **Ownership priority**: Stair tracking (`_smartStairChanges`) takes precedence over railing auto-compute (`_smartRailingChanges`). `recomputeSmartRailings` skips voxels where `voxelType === 'stairs'` entirely, since stair railings are owned by the stair system.

---

## Work Item 1: Wall-Side Bay Group Hover & Selection

### Problem

In Simple mode, hovering a wall edge highlights only a single voxel's face. The bay group infrastructure exists but wall faces don't trigger proper bay-group-wide wall highlighting.

### Design

**Three parts:**

#### 1a. Edge strip hover triggers bay group wall highlight

When an edge strip hitbox fires `onPointerEnter` in Simple mode:
- Set `hoveredBayGroup` with the voxel's bay indices (already happens)
- Set `hoveredVoxelEdge` with the face direction (already happens)

The 3D highlight (`VoxelHoverHighlight` in ContainerMesh.tsx) must render a wall-face overlay spanning the **full bay group width** on the hovered side, not just single-voxel width. Compute the merged AABB of bay group voxels and render the wall overlay at the appropriate face of that AABB.

#### 1b. Bay group wall painting

When `activeBrush` is set and the user clicks a wall edge in Simple mode, paint that face on **all voxels in the bay group**:
- Get bay indices via `getBayIndicesForVoxel()`
- For each voxel in the bay group, call `setVoxelFace(containerId, idx, faceName, activeBrush)`
- All voxels are painted (this is an explicit user action). `setVoxelFace` already sets `userPaintedFaces[face] = true` on each painted voxel.

#### 1c. Selection flow

Clicking a wall edge in Simple mode selects the entire bay group (via `setSelectedVoxels`) and records the hovered face direction for the highlight.

### Files Changed

- `src/components/three/ContainerMesh.tsx` — VoxelHoverHighlight: bay group wall overlay
- `src/components/objects/ContainerSkin.tsx` — handleClick: bay group wall painting
- `src/store/slices/uiSlice.ts` — no new state needed (uses existing hoveredBayGroup + hoveredVoxelEdge)

---

## Work Item 2: Block Grid Bay Mode in Simple

### Problem

The 2D Block Grid shows 32 individual voxel cells regardless of mode. In Simple mode it should show 15 bay cells.

### Design

When `designComplexity === 'simple'`:
- Block Grid renders 15 bay cells using the bay group grid layout (gridRow, gridCol, rowSpan, colSpan from `computeBayGroups()`)
- Each bay cell shows the dominant surface type for that group's visible faces
- Clicking a bay cell's edge selects that bay's wall side
- Clicking a bay cell's interior selects the bay group (floor/ceiling)

When a bay is selected, the detail preview panel (right side) shows the individual voxels within that bay for fine-tuning without switching to Detail mode.

### Files Changed

- `src/components/ui/BlockGrid.tsx` (or equivalent 2D grid component)
- `src/config/bayGroups.ts` — no changes (data already sufficient)

### Testing

- Bay cell count: 15 cells in Simple mode, 32 in Detail mode
- Bay cell edge click: sets `selectedVoxels` to correct bay indices AND records face direction
- Bay cell interior click: sets `selectedVoxels` to correct bay indices (floor/ceiling)
- Dominant surface: bay group with mixed face types returns most frequent surface
- Grid layout: CSS grid positions match bay group `gridRow`/`gridCol`/`rowSpan`/`colSpan`
- Detail preview: selecting a bay shows individual voxel breakdown in the preview panel

---

## Work Item 3: Smart Corner Poles

### Problem

The WU-10 pillar system misses some 90° roof boundary corners. Poles also have no store representation for user customization.

### Design

#### 3a. Placement algorithm (render-computed)

Fix the `pillarPositions` useMemo to find ALL 90° corners of the roof boundary:

**Definition:** A "roof boundary edge" is an edge between a voxel with `top !== 'Open'` (has ceiling) and either an inactive voxel, the grid boundary, or a voxel with `top === 'Open'` (no ceiling).

**Algorithm:** For each corner vertex in the grid, check the 4 voxels that share that vertex. Out-of-bounds cells count as "unroofed" (they don't exist). A pole is placed when exactly one or three of the surrounding voxels are "roofed" — this captures all convex AND concave 90-degree corners of the roof boundary.

The existing WU-10 check ("both lateral neighbors inactive") only catches convex corners where both adjacent cells are empty. The corrected algorithm also handles:
- L-shaped roofs (inside corners)
- U-shaped roofs
- Roof edges adjacent to open-air decks
- Grid boundary corners (e.g., a single roofed voxel at grid corner has 1 roofed + 3 out-of-bounds "unroofed" = 1 of 4 → pole placed at all 4 corners)

**Excluded:** Diagonal checkerboard pattern (2 roofed voxels diagonally opposite = count of 2, no pole). This is a rare configuration and not a standard architectural corner.

#### 3b. Store representation

New fields on `ContainerState`:

```typescript
poleDefaults: {
  material: string;  // default: 'frame'
  shape: string;     // default: 'cylinder'
}

poleOverrides: Record<string, PoleConfig>
// Key: "l{level}r{row}c{col}_{corner}" e.g. "l0r1c2_ne"
// Level component included for multi-level containers
```

```typescript
interface PoleConfig {
  visible?: boolean;   // default: true (inherit)
  material?: string;   // default: inherit from poleDefaults
  shape?: string;      // default: inherit from poleDefaults
}
```

#### 3c. Render flow

1. `useMemo` computes positions from roof topology → array of `{ level, row, col, corner, px, py, pz }`
2. For each position, look up `poleOverrides[key]`
3. If `visible === false`, skip
4. Resolve material: `override.material ?? poleDefaults.material ?? 'frame'`
5. Resolve shape: `override.shape ?? poleDefaults.shape ?? 'cylinder'`
6. Render with resolved config

#### 3d. Store actions

- `setPoleDefaults(containerId, defaults)` — set container-level pole style
- `setPoleOverride(containerId, poleKey, config)` — override individual pole
- `clearPoleOverride(containerId, poleKey)` — revert to container defaults

#### 3e. Independence from railings

Poles check for **roof** (ceiling exists at vertex), NOT railings. A voxel with a ceiling at the grid boundary gets a pole regardless of what's on its walls.

### Files Changed

- `src/components/objects/ContainerSkin.tsx` — fix pillarPositions algorithm, add override lookup
- `src/types/container.ts` — `PoleConfig` interface, new fields on `ContainerState`
- `src/store/slices/voxelSlice.ts` — new actions: setPoleDefaults, setPoleOverride, clearPoleOverride
- `src/store/useStore.ts` — no changes (actions live in voxelSlice)

---

## Work Item 4: Auto-Railing on Fall Hazard Edges

### Problem

When a voxel becomes a fall hazard (open-air with an exposed edge), no railing is automatically placed.

### Design

#### 4a. Trigger condition (per-face)

A face should auto-get `Railing_Cable` when ALL of:
- Voxel is active
- Voxel has `top === 'Open'` (no ceiling — open-air)
- Voxel is NOT a stair (`voxelType !== 'stairs'`) — stair railings owned by stair system (Work Item 5)
- The face direction leads to a fall: no active neighbor, or neighbor is inactive, or grid boundary
- `userPaintedFaces[face]` is NOT true (user hasn't manually set it)

**Cross-container note:** `recomputeSmartRailings` operates per-container only, checking the container's own voxel grid boundaries. Cross-container adjacency is handled by the merge system (`_preMergeWalls`), which sets wall faces based on contact. If a fall hazard exists at a merged container boundary, the merge system will have already set it appropriately, and auto-railing will not override merged faces (they're tracked separately).

#### 4b. Store tracking

New field on `ContainerState`:

```typescript
_smartRailingChanges: Record<string, SurfaceType>
// Key: "voxelIndex:face" → original surface before auto-railing
// Excluded from persist via partialize destructuring (same as _preMergeWalls)
// Included in temporal (undo/redo)
// Recomputed on hydration via recomputeSmartRailings call in onRehydrateStorage
```

#### 4c. Recompute function

`recomputeSmartRailings(draft, containerId)` — pure function on Immer draft:

1. **Scan all non-stair voxels** for fall hazard faces (per 4a conditions)
2. **Add new auto-railings:** For faces that SHOULD have railing but don't:
   - Record original surface in `_smartRailingChanges["idx:face"]`
   - Set face to `Railing_Cable`
3. **Remove stale auto-railings:** For faces that HAVE auto-railing tracking but NO LONGER need it (ceiling added, neighbor activated):
   - Restore original surface from tracking
   - Remove tracking entry
4. **Respect user overrides:** Skip any face with `userPaintedFaces[face] === true`
5. **Clean up user-overridden tracking:** If a face is in `_smartRailingChanges` but now has `userPaintedFaces[face] === true`, remove the tracking entry (user has taken ownership)

#### 4d. Trigger points

Call `recomputeSmartRailings` at the end of these store actions:
- `setVoxelActive` (voxel activated/deactivated)
- `setVoxelFace` (any face change — ceiling changes create/remove fall hazards; wall face changes mark userPaintedFaces which cleans up tracking)
- `addContainer` / `removeContainer`
- `stackContainer` / `unstackContainer`
- `applyStairsFromFace` / `removeStairs` (stairs create new fall hazards)
- `applyModule` / `stampBlock` (overwrite all 6 faces, may change ceiling state)
- `applyContainerPreset` / `applyContainerRole` (reset entire voxel grids)

#### 4e. Undo/redo

Works automatically — store mutations create temporal snapshots.

#### 4f. BOM

Auto-railings are real voxel face data in the store. BOM counts them correctly with no changes.

#### 4g. Hydration

Wire `recomputeSmartRailings` call in `useStore.ts` `onRehydrateStorage` callback, after `rebuildMergeTracking`, for all containers. This rebuilds the tracking map from persisted voxel state.

### Files Changed

- `src/types/container.ts` — `_smartRailingChanges` on ContainerState
- `src/store/slices/voxelSlice.ts` — `recomputeSmartRailings` function, integrate into trigger actions
- `src/store/useStore.ts` — exclude `_smartRailingChanges` from persist partialize (alongside `_preMergeWalls` and `_preExtensionDoors`); wire hydration recompute in `onRehydrateStorage`

---

## Work Item 5: Staircase Railing Extension

### Problem

Phase 1 adds railings around the upper hole but not along the stair run itself. External staircases need railings on exposed sides.

### Design

#### 5a. Per-face fall detection for stair voxels

After `applyStairsFromFace` sets up the stair geometry, check the **two lateral faces** of each stair voxel (perpendicular to ascending direction):

- **Open side** (no active neighbor, or grid boundary) → set `Railing_Cable`
- **Wall-adjacent side** (active neighbor with solid wall face like `Solid_Steel`) → leave as-is
- **Entry/exit faces** (ascending direction and its opposite) → already handled by Phase 1

#### 5b. Integration with existing tracking

Record lateral railing changes in the existing `_smartStairChanges.changedFaces` map on the lower stair voxel. This means `removeStairs` reverses them automatically — no new tracking structure needed.

**Ownership rule:** Because stair lateral railings are tracked in `_smartStairChanges`, and `recomputeSmartRailings` (Work Item 4) skips voxels where `voxelType === 'stairs'`, there is no double-tracking conflict. The stair system owns all railing decisions for stair voxels.

#### 5c. Example

Stair ascending north, entry from south:
- East face of both stair voxels: no neighbor → auto `Railing_Cable`, recorded in changedFaces
- West face: active neighbor with `Solid_Steel` → no railing
- South face: entry → `Open` (existing Phase 1 logic)
- North face: exit → `Open` (existing Phase 1 logic)

### Files Changed

- `src/store/slices/voxelSlice.ts` — extend `applyStairsFromFace` with lateral face checks after existing stair setup

---

## Work Item 6: Adjacent Railing Merge Verification

### Problem

The `connectedStart`/`connectedEnd` autotiling exists but needs verification for edge cases.

### Design

**Verification pass (not a new system):**

1. **Cross-bay-group connections** — Painting a bay group's north face in Simple mode sets railings on all voxels in that group. Verify adjacent bay groups auto-connect at shared voxel boundaries (e.g., voxels 11→12 boundary between body quads).

2. **Mixed railing types** — `adjHasRailing` currently returns true for BOTH Cable and Glass. Verify that different railing types do NOT suppress shared posts (Cable next to Glass should keep both end posts). Fix `adjHasRailing` to check for matching type if needed.

3. **Auto-railing connections** — After `recomputeSmartRailings` sets railings on adjacent fall-hazard voxels, verify render-time autotiling connects them seamlessly.

### Files Changed

- `src/components/objects/ContainerSkin.tsx` — fix `adjHasRailing` if mixed-type check is missing
- `src/__tests__/` — new test file for railing merge verification

---

## Implementation Order

```
Item 1 (Wall hover/selection) ──┐
Item 2 (Block Grid bay mode) ───┤── Independent UI work
                                │
Item 3 (Smart corner poles) ────┤── Independent (poles react to roofs)
                                │
Item 4 (Auto-railing) ──────────┤── Core smart railing system
Item 5 (Stair railing ext) ─────┤── Extends Item 4 + Phase 1
Item 6 (Merge verification) ────┘── Verify after Items 4-5
```

Items 1-3 can be implemented in parallel. Items 4→5→6 are sequential.

## Testing Strategy

All tests are behavioral (TDD per project rules):

- **Item 1**:
  - Hovering edge in Simple mode sets `hoveredBayGroup` with correct bay indices
  - Bay group wall painting applies `activeBrush` to all voxels in the group
  - Bay group wall highlight spans full group width on hovered side
  - Clicking wall edge in Simple mode selects entire bay group

- **Item 2**:
  - Block Grid renders 15 bay cells in Simple mode, 32 in Detail mode
  - Bay cell edge click sets `selectedVoxels` to correct bay indices + records face direction
  - Bay cell interior click selects bay group for floor/ceiling
  - Dominant surface calculation for mixed-face bay groups returns most frequent surface
  - Grid layout positions match bay group `gridRow`/`gridCol`/`rowSpan`/`colSpan`
  - Detail preview shows individual voxel breakdown when bay is selected

- **Item 3**:
  - Rectangular roof (all voxels roofed): poles at all 4+ corners
  - L-shaped roof: poles at convex AND concave corners
  - U-shaped roof: correct corner count
  - Single roofed voxel at grid corner: 4 poles
  - Override inheritance: container default → per-pole override
  - Hidden pole: `visible: false` suppresses rendering

- **Item 4**:
  - Auto-railing on voxel activation (open-air + exposed edge)
  - Auto-railing removed when ceiling added
  - Auto-railing removed when neighbor activated
  - `userPaintedFaces` preservation (manual paint not overridden)
  - User-painting a tracked face cleans up tracking entry
  - Stair voxels excluded from auto-railing scan
  - Hydration recomputes auto-railings correctly

- **Item 5**:
  - Lateral railing on exposed stair sides
  - Wall-adjacent stair side stays clear
  - Removal cascade via `removeStairs` reverses lateral railings
  - Both stair voxels (upper + lower) get lateral railing checks

- **Item 6**:
  - Cross-bay railing connection (shared post suppressed)
  - Mixed-type non-connection (Cable next to Glass keeps both end posts)
  - Auto-railing connections (adjacent fall-hazard voxels connect seamlessly)

## Type Changes Summary

```typescript
// New on ContainerState
poleDefaults: { material: string; shape: string };
poleOverrides: Record<string, PoleConfig>;
_smartRailingChanges: Record<string, SurfaceType>;

// New interface
interface PoleConfig {
  visible?: boolean;
  material?: string;
  shape?: string;
}
```

## Persistence & Undo

| Field | Persisted | Temporal (undo) | Hydration |
|-------|-----------|-----------------|-----------|
| `poleDefaults` | Yes | Yes | Loaded from persist |
| `poleOverrides` | Yes | Yes | Loaded from persist |
| `_smartRailingChanges` | No (stripped in partialize) | Yes | Recomputed via `recomputeSmartRailings` in `onRehydrateStorage` |
