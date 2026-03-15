# Execution Plan — "Lego Mode" UX Overhaul

> **Status:** Awaiting Approval
> **Scope:** 4 Phases — Clean Box Default, IsoEditor Sync, 3D Edge Hitboxes, Label Polish

---

## Phase 1: The "Clean Box" Default Spawn

### Problem
The app's Reset button currently loads the Great Room Demo (`createGreatRoomDemo()`), which spawns 12 containers with fully-deployed fold-down extensions. Even the `handleReset()` path in `page.tsx` calls `seedSingleContainer()` which spawns a clean box — but the header's **separate** Reset button explicitly calls `createGreatRoomDemo()`. There are **two different reset paths** producing confusing results.

Additionally, the `createDefaultVoxelGrid()` factory already sets deck rows (0, 3) to `active: false` and all walls to `PanelSolid`. So the *factory* is correct — the problem is the Great Room Demo auto-deploying extensions on every outer bay.

### Files to Modify

| File | Change |
|------|--------|
| `src/app/page.tsx` (line 378-382) | Change the Reset button to call `seedSingleContainer()` instead of `createGreatRoomDemo()` |
| `src/app/page.tsx` (line 403-410) | Ensure `seedSingleContainer()` wipes state cleanly (it already does) |
| `src/types/factories.ts` (line 120) | **Verify** `active: isCore` — this is already correct (deck rows inactive). No change needed. |
| `src/types/factories.ts` (line 155-158) | **Verify** all walls default to `createPanelSolid()` — already correct. No change needed. |

### Detailed Steps

1. **Unify reset paths**: In `TopToolbar` (the legacy `HeaderToolbar_LEGACY` at line 378), change:
   ```
   localStorage.removeItem(STORAGE_KEY);
   useStore.getState().createGreatRoomDemo();
   ```
   to call the same `seedSingleContainer()` logic that `handleReset()` uses. This requires either exporting `seedSingleContainer` or inlining the pattern.

2. **Keep `createGreatRoomDemo()` available** — don't delete it. Add a separate "Load Demo" button or move it into an import/export menu. The Great Room is still a valuable showcase, just not the default.

3. **Verify skeleton visibility**: When only core voxels are active (rows 1-2, cols 1-6), the `IsoSkeleton` corner posts and beams are fully visible because `ContainerSkin` only renders face panels *inside* each active voxel's bounds. The steel frame at the container perimeter is outside the core voxel boundaries. No change needed.

### Acceptance Criteria
- Fresh load (no localStorage) → single 40ft HC box, all walls `PanelSolid`, zero extensions
- Reset button → same clean box (not Great Room Demo)
- All 4 corner posts and perimeter beams visible
- Voxel grid: core cells active, all halo/deck cells inactive

---

## Phase 2: Live, Synced 3D Preview (IsoEditor)

### Problem
The IsoEditor has:
1. **Static camera** — hardcoded orthographic at `[dist, dist*0.65, dist]` (SE isometric). Doesn't track the main scene's orbit angle.
2. **Prop-based rendering** — receives `container` as a prop from `Sidebar.tsx`. If the parent re-renders, the preview updates. But since `IsoEditorCanvas` creates its own `Canvas`, there's no reactive binding to the Zustand store *inside* the canvas. The `container` object is stale if the parent doesn't re-render.
3. **No edge/extension interaction** — `ContainerSkin` is rendered but only for face painting, not edge highlighting.

### Approach: Store-Driven Rendering + Camera Broadcast

#### A. Fix Stale State — Read from Store, Not Props

| File | Change |
|------|--------|
| `src/components/ui/IsoEditor.tsx` (line 146-215) | Inside `IsoEditorCanvas`, read the container from the Zustand store via `useStore()` selector instead of relying on the prop. The prop container ID is used only to select the right container. |

**Why**: The current architecture passes a `Container` object as a prop. React Three Fiber's `Canvas` component creates a separate React tree (via `createRoot`). Props passed through this boundary are **not reactive** — they only update when the parent component re-renders. By reading from Zustand inside the Canvas tree, every store mutation (voxel paint, face change, etc.) triggers an immediate re-render.

**Implementation**:
```
// Inside IsoEditorCanvas, replace `container` prop usage with:
const container = useStore(s => s.containers[containerId]);
```
- Change `IsoEditorCanvas` to accept `containerId: string` instead of `container: Container`
- Both `ContainerSkin` and `IsoSkeleton` read from the store-derived container
- Halo detection (`hasHaloRows`, `hasHaloCols`) recalculates reactively

#### B. Camera Angle Sync — Broadcast from Main OrbitControls

| File | Change |
|------|--------|
| `src/store/useStore.ts` | Add `cameraAzimuth: number` (radians) and `cameraElevation: number` to the store. Add `setCameraAngles(az, el)` action. NOT serialized to localStorage. |
| `src/components/three/Scene.tsx` (line 466) | Add a `ref` to the main `OrbitControls`. In a `useFrame` callback, read the controls' spherical angle and dispatch `setCameraAngles()` every frame (throttled to ~10fps to avoid perf overhead). |
| `src/components/ui/IsoEditor.tsx` (line 49-79) | In `CameraSetup`, subscribe to `cameraAzimuth` and `cameraElevation` from the store. Convert to Cartesian position: `x = dist * sin(el) * cos(az)`, `y = dist * cos(el)`, `z = dist * sin(el) * sin(az)`. Update the orthographic camera position every time these values change. |

**Throttle strategy**: Use a frame counter inside `useFrame`. Only write to the store every 6th frame (~10 updates/sec at 60fps). This prevents flooding the store with 60 camera updates per second while still feeling smooth in the preview.

**Fallback**: If the main scene is in Blueprint mode (top-down orthographic), the IsoEditor stays at its default SE isometric angle — no sync needed for top-down views.

#### C. OrbitControls Lock — Preview Orbits Independently

The IsoEditor already has its own `OrbitControls`. The sync only sets the *initial* angle when the main camera moves. The user can still freely orbit the preview independently. A small "sync" toggle button (🔗 icon) lets the user lock/unlock the angle link.

### Files Summary

| File | Lines Affected |
|------|---------------|
| `src/store/useStore.ts` | Add ~8 lines: `cameraAzimuth`, `cameraElevation`, `setCameraAngles` |
| `src/components/three/Scene.tsx` | Add ~15 lines: `useFrame` camera broadcast in `RealisticScene` |
| `src/components/ui/IsoEditor.tsx` | Refactor `CameraSetup` (~20 lines), change props to `containerId` (~5 lines) |
| `src/components/ui/Sidebar.tsx` | Change `<IsoEditor container={container} />` to `<IsoEditor containerId={container.id} />` (~1 line) |

### Acceptance Criteria
- Orbiting in main 3D view → IsoEditor preview rotates to match (same viewing angle)
- Painting a voxel face in the main view → preview updates instantly
- Activating a deck extension → preview shows it immediately
- IsoEditor can be orbited independently after unlinking

---

## Phase 3: "Lego" 3D Edge Hitboxes on Voxel Tiles

### Problem
Currently, the only way to configure voxel face surfaces is:
1. Select a brush in `MaterialPalette`, then click individual faces in `ContainerSkin`
2. Use the `CubeInspector` dropdown grid in the `MatrixEditor`

The user wants **direct 3D edge interaction** — hovering an edge of an extension tile highlights it and suggests what clicking will do. Left-click cycles through surface types. Right-click opens the fan menu for detailed customization.

### Architecture: VoxelEdgeHitbox Component Inside ContainerSkin

| File | Change |
|------|--------|
| `src/components/objects/ContainerSkin.tsx` | Add `VoxelEdgeHitbox` sub-component rendered alongside each `SingleFace` for active halo/deck voxels |

#### A. What Is an "Edge" in This Context?

Each active voxel tile has 6 faces (N/S/E/W/Top/Bottom). Each face is a `SingleFace` component — a flat plane.

An "edge" is the **border zone between two adjacent faces** — the thin strip where, for example, the North face meets the Top face, or the East face meets the North face. In Lego terms, these are the narrow ridges you snap onto.

For the user's purposes, we focus on the **4 vertical edges** of each tile (the NE, NW, SE, SW corners where side walls meet) plus the **4 horizontal top edges** where the top face meets each side wall. These 8 edges per tile give the user a grip to quickly cycle wall surfaces.

#### B. Hitbox Geometry

For each active deck/halo voxel (rows 0, 3 or cols 0, 7), render transparent `BoxGeometry` hitboxes along the perimeter edges:

- **Vertical edge hitboxes** (4 per voxel): Tall thin boxes at the 4 vertical corners
  - Geometry: `[EDGE_W, vHeight, EDGE_W]` where `EDGE_W = 0.08m` (thin but raycastable)
  - Positioned at the 4 corners of the voxel bounding box
  - These represent "wall posts" — clicking cycles the two adjacent wall faces

- **Horizontal top edge hitboxes** (4 per voxel): Flat thin boxes along each top perimeter edge
  - Geometry: `[faceWidth, EDGE_W, EDGE_W]` (N/S) or `[EDGE_W, EDGE_W, faceDepth]` (E/W)
  - Positioned at the top rim of each wall face
  - These represent "top rails" — clicking cycles the adjacent wall face surface

**Simplification**: For the initial implementation, we focus on the **4 side-face edge strips** rather than corner posts. Each strip runs along the outer edge of a SingleFace and is slightly wider than the face itself to be easily targetable.

#### C. New Component: `VoxelEdgeStrip`

```
Props:
  - face: 'n' | 's' | 'e' | 'w'
  - voxelIndex: number
  - containerId: string
  - faceWidth: number
  - faceHeight: number
  - position: [x, y, z]  // same as parent SingleFace position
```

**Rendering**:
- Transparent `BoxGeometry` strip along the outer perimeter of the face
- Width: `EDGE_STRIP_W = 0.06m` — just thick enough to catch the cursor
- Material: `mHit` (invisible, raycastable) by default

**Hover behavior** (`onPointerEnter`):
- Set `hoveredEdge` in store: `{ containerId, voxelIndex, face }`
- Render a glowing cyan strip (`MeshBasicMaterial`, color `#00bcd4`, opacity 0.6) replacing the invisible hitbox
- Also apply a subtle glow on the adjacent `SingleFace` (pass `edgeHovered` prop down)

**Left-click** (`onClick`):
- Cycle the face surface through: `Solid_Steel → Glass_Pane → Railing_Cable → Railing_Glass → Deck_Wood → Open → Solid_Steel`
- Uses existing `setVoxelFace(containerId, voxelIndex, face, nextSurface)` store action
- Instant — no menu, no confirmation

**Right-click** (`onContextMenu`):
- Prevent default browser menu
- Open the `BayContextMenu` fan menu at `(e.nativeEvent.clientX, e.nativeEvent.clientY)`
- Pass the voxel context so the menu shows surface type options instead of bay module options
- Reuse existing `openBayContextMenu` or add a parallel `openVoxelContextMenu` action

#### D. Integration Into ContainerSkin Render Loop

Inside the `VoxelFaceGroup` component (which renders all 6 faces of one voxel), after each `SingleFace`:

```
// Pseudocode inside VoxelFaceGroup render:
for each face in [n, s, e, w]:
  <SingleFace ... />
  {isHaloVoxel && <VoxelEdgeStrip face={face} ... />}
```

Only render edge strips on halo/deck voxels (rows 0, 3 and cols 0, 7) — core voxels don't need exposed edges because their faces are interior walls.

#### E. Store Changes

| File | Change |
|------|--------|
| `src/store/useStore.ts` | Add `hoveredVoxelEdge: { containerId: string; voxelIndex: number; face: keyof VoxelFaces } \| null` |
| `src/store/useStore.ts` | Add `setHoveredVoxelEdge(edge)` action |
| `src/store/useStore.ts` | Add `cycleVoxelFace(containerId, voxelIndex, face)` action — cycles through SurfaceType enum |

The `cycleVoxelFace` action:
```
const SURFACE_CYCLE: SurfaceType[] = [
  'Solid_Steel', 'Glass_Pane', 'Railing_Cable', 'Railing_Glass', 'Deck_Wood', 'Open'
];

cycleVoxelFace(containerId, index, face) {
  const grid = containers[containerId].voxelGrid;
  const current = grid[index].faces[face];
  const nextIdx = (SURFACE_CYCLE.indexOf(current) + 1) % SURFACE_CYCLE.length;
  setVoxelFace(containerId, index, face, SURFACE_CYCLE[nextIdx]);
}
```

### Files Summary

| File | Lines Added/Modified |
|------|---------------------|
| `src/components/objects/ContainerSkin.tsx` | ~80 new lines: `VoxelEdgeStrip` component + integration in `VoxelFaceGroup` |
| `src/store/useStore.ts` | ~15 new lines: `hoveredVoxelEdge`, `setHoveredVoxelEdge`, `cycleVoxelFace` |

### Acceptance Criteria
- Hovering near the edge of a deck extension tile → cyan glow strip appears on that edge
- Left-clicking the edge → the adjacent wall face cycles to the next surface type (visible change)
- Right-clicking the edge → fan menu opens at cursor position with surface options
- Edge strips only appear on halo/deck voxels, not core interior cells
- Works in both main 3D view AND IsoEditor preview (since both use `ContainerSkin`)

---

## Phase 4: Floating Text Polish — CAD-Style Label

### Problem
The current label uses `<Text>` from drei positioned at `[0, dims.height + 3.4, 0]` — a massive 3.4m offset above the container top. For a 40ft HC container (2.9m tall), this puts the label at **6.3m above ground**, floating absurdly high. It also uses `depthTest={false}` which means it renders through all geometry, creating visual clutter when viewing from below or through other containers.

### Approach: Anchored Billboard at Container Top Edge

| File | Change |
|------|--------|
| `src/components/three/ContainerMesh.tsx` (lines 2533-2565) | Replace the `<Text>` pair with an `<Html>` component from drei, anchored to the container's top-center |

#### A. Position Fix

Move from `Y = dims.height + 3.4` to `Y = dims.height + 0.15` — just 15cm above the roof plate. This keeps the label close to the container like a CAD annotation.

#### B. Switch to `<Html>` for Better Control

Replace `<Text>` (SDF text rendered in WebGL) with `<Html>` (DOM overlay from drei). Benefits:
- **`occlude`** prop — label hides behind geometry instead of rendering through everything
- **`distanceFactor`** prop — text scales proportionally with distance (closer = larger, farther = smaller)
- **Crisp text** — DOM rendering is always pixel-perfect, no SDF artifacts
- **CSS styling** — can use `backdrop-filter: blur()` for glassmorphic label backgrounds

#### C. Detailed Implementation

```jsx
<Html
  position={[0, dims.height + 0.15, 0]}
  center
  distanceFactor={8}
  occlude="blending"
  style={{
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  }}
>
  <div style={{
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(8px)',
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.15)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1px',
  }}>
    <span style={{ color: '#fff', fontSize: '11px', fontWeight: 600 }}>
      {container.name}
    </span>
    <span style={{ color: '#94a3b8', fontSize: '9px' }}>
      {dims.length.toFixed(1)} × {dims.width.toFixed(1)} × {dims.height.toFixed(1)} m
    </span>
  </div>
</Html>
```

#### D. Visibility Rules (Unchanged)
- Only show when `isSelected || hovered` (same conditional as current)
- `pointerEvents: 'none'` prevents label from blocking 3D raycasting

#### E. Fallback if `occlude` Causes Performance Issues
If `occlude="blending"` is too expensive (it re-renders to a depth buffer), fall back to `occlude={false}` and keep `depthTest={false}` on the underlying material. The key visual improvement is still the position fix (from +3.4m to +0.15m) and the glassmorphic styling.

### Files Summary

| File | Lines Modified |
|------|---------------|
| `src/components/three/ContainerMesh.tsx` (lines 2533-2565) | Replace ~30 lines of `<Text>` with ~25 lines of `<Html>` |

### Acceptance Criteria
- Label appears directly above the container roof (not floating 3.4m above)
- Label text is crisp at all zoom levels
- Label has a subtle dark glassmorphic background
- Label hides behind other containers when occluded (or blends gracefully)
- Label does not interfere with 3D clicking/hovering

---

## Execution Order & Dependencies

```
Phase 1 (Clean Box)      ← Independent, do first
Phase 4 (Label Polish)   ← Independent, can parallel with Phase 1
Phase 2 (IsoEditor Sync) ← Depends on nothing, but do after Phase 1 so testing starts clean
Phase 3 (Edge Hitboxes)  ← Most complex, do last. Benefits from Phase 2 (live preview shows edges)
```

**Estimated file changes**: 4 files modified, 0 new files created.

| File | Phases |
|------|--------|
| `src/app/page.tsx` | Phase 1 |
| `src/store/useStore.ts` | Phase 2, Phase 3 |
| `src/components/ui/IsoEditor.tsx` | Phase 2 |
| `src/components/ui/Sidebar.tsx` | Phase 2 |
| `src/components/three/Scene.tsx` | Phase 2 |
| `src/components/objects/ContainerSkin.tsx` | Phase 3 |
| `src/components/three/ContainerMesh.tsx` | Phase 4 |

---

## Risk Mitigations

1. **IsoEditor Canvas isolation**: R3F `Canvas` creates a separate React tree. Reading from Zustand inside it is safe (Zustand uses external subscriptions, not React context). No bridge or portal needed.

2. **Camera sync perf**: Throttling to ~10fps prevents store spam. The IsoEditor's `useLayoutEffect` on `cameraAzimuth` change is cheap — just a `camera.position.set()` call.

3. **Edge hitbox z-fighting**: The edge strips use `depthWrite: false` and are slightly offset outward from the face plane (by `EDGE_STRIP_W / 2`), preventing z-fighting with the `SingleFace` geometry.

4. **`<Html>` occlude perf**: If profiling shows `occlude="blending"` drops FPS, we fall back to `occlude={false}` — the position and style improvements still deliver 90% of the visual fix.
