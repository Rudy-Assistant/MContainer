# Design Spec: P0 Bugfix Sprint

**Date:** 2026-03-26
**Scope:** 3 P0 bugs from sprint-ui-polish-handoff.md
**Approach:** Sequential — Item 1 before Item 2 (dependency), Item 3 independent

---

## Sprint Items

| # | Priority | Item | Type |
|---|----------|------|------|
| 1 | P0 | Frame mode material reactivity | Bug |
| 2 | P0 | Frame mode view isolation (frame-only) | Bug |
| 3 | P0 | Door flush positioning | Bug |

**Already complete (removed from scope):**
- P0 #4 (debug/wireframe toggle) — already working in TopToolbar
- P1 #5 (block thumbnails) — already wired: BlockThumbnailRenderer wraps FinishesPanel, BlockTab uses useBlockThumbnail
- P1 #7 (multi-select) — already implemented: MatrixEditor has lastClickedRef, Shift+Click range, Ctrl+Click toggle
- P1 #8 (grid orientation) — already fixed: bayGroups.ts uses `3 - i` pattern, nearest = "Deck 3"
- P1 #6 (GLB models) — art pipeline blocker, not code work

---

## 1. Frame Mode Material Reactivity

### Problem

`ContainerSkin.tsx:~3451` hardcodes pole material to `mFrame` (theme default) or selection highlight material. The `poleOverride` is fetched from state but only `.visible` is checked — `.material` is ignored entirely. Same issue for rails.

Additionally, the `onPointerOut` handler (~line 3470) resets hover state with `mesh.material = mFrame`, which must also use the resolved material instead.

### Root Cause

The rendering loop reads frame overrides but never maps material names to Three.js materials. The cascade defined in `frameMaterials.ts` (`resolveFrameProperty()`) is not called during rendering.

### Design

1. Add a material name → Three.js material lookup function in `materialCache.ts` (or inline in ContainerSkin):

   | Frame Material Name | ThemeMaterialSet Key |
   |---------------------|---------------------|
   | `'Steel'` | `steel` |
   | `'Wood'` | `wood` |
   | `'Concrete'` | `concrete` |
   | `'Aluminum'` | `frame` (generic frame material — aluminum is the default frame appearance) |

2. In the pole rendering loop in `ContainerSkin.tsx`, after fetching `poleOverride`:
   - Call `resolveFrameProperty()` to get the resolved material name (element override > container defaults > theme default)
   - Map through the lookup table above to get a Three.js material
   - Apply as the pole mesh material instead of hardcoded `mFrame`

3. Material priority for rendering:
   ```
   isSelected ? frameSelectMat : isHovered ? frameHoverMat : resolvedMaterial
   ```

4. Fix the `onPointerOut` handler (~line 3470) to restore `resolvedMaterial` instead of `mFrame`

5. Fix the `onPointerOver` cross-pole transition (~line 3462): when the pointer moves directly from one pole to another, the handler resets the previously-hovered pole to `mFrame`. This must also restore `resolvedMaterial` for that pole. Change `hoveredPoleRef` from `useRef<THREE.Mesh | null>(null)` to `useRef<{ mesh: THREE.Mesh; material: THREE.Material } | null>(null)`. Then the cross-pole reset becomes:
   ```ts
   if (hoveredPoleRef.current && hoveredPoleRef.current.mesh !== mesh) {
     hoveredPoleRef.current.mesh.material = hoveredPoleRef.current.material;
   }
   hoveredPoleRef.current = { mesh, material: resolvedMaterial };
   ```
   Note: `onPointerOut` (step 4) uses `resolvedMaterial` directly from its closure scope — it captures the correct per-pole value from the render loop iteration, so no ref lookup is needed there.

6. **Rails — deferred entirely to Phase 2.** Investigation found that frame rail meshes (horizontal members between poles) are **not yet rendered** in ContainerSkin. Only surface railings (`RailingCable`/`RailingGlass`) exist as face-type renderers — these are surface types, not frame elements. The store infrastructure exists (`container.railOverrides`, `container.frameDefaults.railMaterial`, `resolveFrameProperty` for rails) but there are no frame rail mesh elements to apply materials to. Both rail visual material wiring and rail interactivity are deferred to the Phase 2 frame completion sprint when frame rail meshes are added.

### Files

- `ContainerSkin.tsx` — pole/rail rendering (~lines 3440-3490), including `onPointerOut` handler
- `frameMaterials.ts` — `resolveFrameProperty()` (already exists)
- `materialCache.ts` — add `getFrameThreeMaterial(name: PoleMaterial | RailMaterial, theme: ThemeId): THREE.Material` lookup helper

### Tests

- Unit test: `resolveFrameProperty` returns override > default > theme fallback
- Unit test: material name mapping covers all 4 pole materials and 3 rail materials
- Browser: set pole material to "Wood" in FrameInspector → pole visually changes to wood material
- Browser: hover pole → cyan highlight → move away → restores wood material (not steel)
- Browser: move cursor directly from one pole to another → first pole restores its correct material
- Browser: set rail material to "Concrete" → rail visually changes (no hover/click interaction expected)

---

## 2. Frame Mode View Isolation

### Problem

When `frameMode === true`, walls and ceilings remain fully opaque, obscuring the frame structure (poles/rails). Users cannot see or interact with the frame clearly.

### Design

When `frameMode === true`:
- **Wall faces** (north, south, east, west): **not rendered** — skip in face rendering loop
- **Ceiling faces** (top): **not rendered**
- **Floor faces** (bottom): **rendered normally** — provides spatial reference
- **Poles and rails**: **rendered at full opacity**, fully interactable

Implementation: Add early-continue in the face rendering loop in `ContainerSkin.tsx`:
```
if (frameMode && (face === 'north' || face === 'south' || face === 'east' || face === 'west' || face === 'top')) continue;
```

No material cloning needed. This is a pure rendering skip.

**Note on ContainerMesh.tsx:** The handoff lists `ContainerMesh.tsx` as a relevant file, but ContainerMesh handles hover highlight meshes and frame element interaction — not face surface rendering. The face skip only needs to happen in ContainerSkin where wall/ceiling geometry is emitted. ContainerMesh's hover highlights will naturally have nothing to highlight when no wall faces exist. No changes needed in ContainerMesh.

### Dependency

Must be implemented after Item 1 (material reactivity) so that frame elements display their correct materials when walls are hidden.

### Files

- `ContainerSkin.tsx` — face rendering loop (where wall/ceiling `<mesh>` elements are generated)

### Tests

- Browser: toggle frameMode on → walls and ceiling disappear, only floor + poles/rails visible
- Browser: toggle frameMode off → walls/ceilings reappear with correct materials
- Browser: floor remains visible in both modes
- Browser: poles/rails remain interactable (hover/click) in frame mode

---

## 3. Door Flush Positioning

### Problem

`DoorFace` component in `ContainerSkin.tsx` (starts at ~line 572, not 542 as originally noted — line 542 is `GullWingFace`) renders the door panel recessed inside the door frame.

### Root Cause

The door panel geometry uses `d * 0.6` for depth (line ~630):
```jsx
geometry={isNS ? getBox(doorW, h * 0.95, d * 0.6) : getBox(d * 0.6, h * 0.95, doorW)}
```

Where `d = PANEL_THICK = 0.06` meters. This makes the door panel 0.036m thick while the door frame is the full 0.06m. The door is recessed 0.012m (12mm) on each side — visibly not flush with the wall.

### Design

Change the door panel depth from `d * 0.6` to `d * 0.95` on line ~630:
```jsx
// Before:
geometry={isNS ? getBox(doorW, h * 0.95, d * 0.6) : getBox(d * 0.6, h * 0.95, doorW)}

// After (0.95 = 1.5mm reveal for professional framing gap):
geometry={isNS ? getBox(doorW, h * 0.95, d * 0.95) : getBox(d * 0.95, h * 0.95, doorW)}
```

This makes the door panel nearly the same thickness as the wall, with a 1.5mm reveal (professional framing gap) on each side. The door will sit flush with the wall surface when closed.

### Verification

Test with all door types that use this component:
- Single swing (default): door closed = flush, door open = hinge on wall edge
- Slide: door closed = flush, door open = slides along wall plane
- Double/pocket/barn variations if they share DoorFace

### Files

- `ContainerSkin.tsx` — `DoorFace` component (~line 572-648), specifically the door panel geometry depth (line ~630)

### Tests

- Browser: place a door → closed state sits flush with wall surface
- Browser: open door → hinge point stays on wall edge, no gap visible
- Browser: test both N/S and E/W wall orientations

---

## Critical Invariants (from handoff)

These must not be violated during implementation:

1. **Never mutate refs inside Zustand selectors** — causes render loop crashes
2. **`selectedFace` is orthogonal to `selectedElements`** — `setSelectedElements` must NOT clear `selectedFace` unless sel is null
3. **MatrixEditor owns the spatial grid** — all voxel layout calculations go through `getVoxelLayout`
4. **PresetCard convention** — square image area, highlight on image only, label below
5. **Zustand selectors with middleware** — no `equalityFn` 2nd arg; use `useShallow` + `useRef` dedup
6. **Floor-based hitbox paradigm** — vertical wall meshes use `raycast={nullRaycast}`

## Verification Plan

For each item:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all tests pass
3. Browser verification per item's specific checks
4. Final full walkthrough after all 3 items complete
