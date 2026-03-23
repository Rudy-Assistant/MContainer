# SceneObject Interaction Depth — Design Spec

**Date:** 2026-03-23
**Status:** Design
**Scope:** Hover highlights, slot indicators, card-hover preview ghost, Tab cycling

---

## Problem Statement

Placed SceneObjects (doors, windows, lights, electrical) have no hover feedback, no slot visibility during placement, no preview-before-commit on card hover, and no keyboard navigation. Users must click blindly to discover what's interactive, guess where objects will land on a wall, and use the mouse exclusively to select objects.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hover highlight style | Emissive tint (cyan 0.15) | Zero extra geometry, consistent with existing HoverHighlight pattern, works with any mesh |
| Slot indicators | Thin white lines on wall face | Minimal visual noise, only shown during placement mode |
| Card hover ghost | Blue-tinted PlacementGhost variant | Reuses anchor math + positioning, distinct from green/red placement ghost |
| Tab cycling | Raw keydown in Scene.tsx | Follows existing hotkey pattern (no react-hotkeys-hook in project) |

---

## Feature 1: Hover Highlight on Placed SceneObjects

### Store Changes (uiSlice.ts)

New atom:
```ts
hoveredObjectId: string | null;
setHoveredObjectId: (id: string | null) => void;
```

### ContainerSkin.tsx — Pointer Handlers

On `onPointerEnter` / `onPointerMove` for voxel face meshes, after setting `hoveredVoxelEdge`, also check `findObjectAtFace()`. If an object exists at that face, call `setHoveredObjectId(objectId)`. On `onPointerLeave`, call `setHoveredObjectId(null)`.

### ContainerSkin.tsx — Emissive Tint Rendering

In the mesh rendering for placed objects (SceneObject meshes), read `hoveredObjectId` in `useFrame`:
- If `hoveredObjectId` matches the current object's ID: set `mesh.material.emissive` to `#00bcd4` at intensity 0.15
- Otherwise: reset emissive to black (0, 0, 0)

This runs per-frame (not via React state) to avoid re-render storms.

### HoverHighlight.tsx — Suppress When Object Hovered

When `hoveredObjectId` is truthy, HoverHighlight skips rendering its wall-face overlay. This prevents the yellow wall hover from competing with the cyan object glow on the same face.

Implementation: read `hoveredObjectId` from store; if truthy, return null early.

---

## Feature 2: Slot Boundary Indicators During Placement

### PlacementGhost.tsx — SlotIndicator Child

When `placementMode` is true and a wall face is hovered, render `N-1` thin vertical lines at slot boundary positions along the wall width. `N` = `FACE_SLOT_COUNT` from `src/utils/slotOccupancy.ts` (currently 3, so 2 divider lines).

Implementation:
- New `SlotIndicator` sub-component inside PlacementGhost.tsx
- Uses drei `<Line>` elements: white color, 0.3 opacity, positioned on the wall face plane
- Offset 0.001m forward from the wall to prevent z-fighting
- Slot positions calculated from voxel width / slot count
- The active form's `slotWidth` determines which group of slots is highlighted (slightly brighter lines bounding the occupied range)
- Only renders when `activePlacementFormId` is set and `hoveredVoxelEdge.face` is a wall direction (n/s/e/w)

---

## Feature 3: Card Hover → 3D Preview Ghost

### Store Changes (uiSlice.ts)

New atom:
```ts
hoveredFormId: string | null;
setHoveredFormId: (id: string | null) => void;
```

### BottomPanel.tsx — Card Hover Events

Add `onMouseEnter` / `onMouseLeave` to form card buttons:
- `onMouseEnter`: call `setHoveredFormId(formId)`
- `onMouseLeave`: call `setHoveredFormId(null)`

Only set when `activePlacementFormId` is null (placement mode not active — placement ghost takes priority).

### HoverPreviewGhost.tsx (New File)

New component, sibling to `PlacementGhost` in the scene graph. Renders when:
- `hoveredFormId` is set (user is hovering a card)
- `activePlacementFormId` is NOT set (placement mode inactive)
- `hoveredVoxelEdge` is set (cursor is over a voxel face in 3D)

Logic mirrors PlacementGhost but with key differences:
- **Color**: blue tint (`#3b82f6`) instead of green/red
- **Opacity**: 0.25 (more subtle than placement ghost's 0.4)
- **No slot validation**: doesn't check occupancy — it's a preview, not a placement attempt
- **No click interception**: purely visual, doesn't affect any click handlers
- **Anchor type check**: still validates that the hovered face matches the form's anchorType (wall form only previews on walls, ceiling form only on ceilings)

When the user clicks a card (entering placement mode), `hoveredFormId` clears via `setHoveredFormId(null)` in the card click handler, and `activePlacementFormId` takes over — seamless transition from preview to placement.

### Scene Graph Mounting

In the scene root (Scene.tsx or wherever PlacementGhost is mounted), add `<HoverPreviewGhost />` as a sibling:
```tsx
<PlacementGhost />
<HoverPreviewGhost />
```

---

## Feature 4: Tab Cycling Through Placed Objects

### Scene.tsx — Keydown Handler

Add a `Tab` / `Shift+Tab` handler to the existing `keydown` listener in Scene.tsx:

1. On `Tab` press: `e.preventDefault()` (suppress browser focus cycling)
2. Get current container ID from `selection[0]` or `selectedVoxel?.containerId`
3. If no container selected, no-op
4. Gather all SceneObject IDs whose `anchor.containerId` matches
5. Sort alphabetically (deterministic within session)
6. Find current `selectedObjectId` in the sorted list
7. `Tab`: advance index +1 (wrap around). `Shift+Tab`: advance -1 (wrap around)
8. Call `selectObject(nextId)` — mutual exclusion clears voxel selection

Edge cases:
- No objects in container → no-op
- One object → re-selects same (no-op visually)
- No object currently selected → select first in sorted list
- Stale `selectedObjectId` (deleted object) → start from beginning

---

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `src/store/slices/uiSlice.ts` | Modify | Add `hoveredObjectId` + setter, `hoveredFormId` + setter |
| `src/components/objects/ContainerSkin.tsx` | Modify | Set `hoveredObjectId` on pointer events; emissive tint in useFrame |
| `src/components/ui/HoverHighlight.tsx` | Modify | Skip rendering when `hoveredObjectId` is truthy |
| `src/components/objects/PlacementGhost.tsx` | Modify | Add `SlotIndicator` child with boundary lines |
| `src/components/objects/HoverPreviewGhost.tsx` | **Create** | Card-hover preview ghost (blue tint, passive, no validation) |
| `src/components/ui/BottomPanel.tsx` | Modify | `onMouseEnter`/`onMouseLeave` on cards → `setHoveredFormId` |
| `src/components/three/Scene.tsx` | Modify | Tab/Shift+Tab keydown handler for object cycling |
| `src/Testing/object-interaction.test.ts` | **Create** | Tests for hover atoms, Tab cycling logic, mutual exclusion |

**2 new store atoms. 1 new component file. 1 new test file. 6 modified files.**

---

## Testing Strategy

1. **Store atom tests** — `setHoveredObjectId` / `setHoveredFormId` set and clear correctly
2. **Tab cycling unit tests** — given a set of sceneObjects, verify next/prev index calculation, wrap-around, empty-set no-op, stale-ID recovery
3. **Mutual exclusion** — `hoveredObjectId` truthy suppresses HoverHighlight (test the skip logic)
4. **Hover→placement transition** — setting `activePlacementFormId` while `hoveredFormId` is set: verify `hoveredFormId` gets cleared in the click handler
5. **Existing test suite** — all 676 tests must continue passing
6. **Browser verification** — hover a placed door (cyan glow), enter placement mode (slot lines visible), hover a card without clicking (blue ghost in 3D), Tab through objects

## Out of Scope

- Multi-object hover (only one object highlighted at a time)
- Drag-to-reposition placed objects
- Object-to-object snapping
- Hover preview for furniture (only SceneObject forms)
- Custom highlight colors per category
