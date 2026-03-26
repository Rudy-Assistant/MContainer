# Sprint Handoff: UI Polish & Hotbar Absorption

**Date:** 2026-03-26
**Branch:** `master` (local only, no remote)
**Last commit:** `dd83cd0` — feat: polish UI — shared utilities, PresetCard icon prop, debug hover, BottomPanel guard

---

## What Was Done This Sprint

### 1. Hotbar Absorption into Left Panel
- Walls, Flooring, Ceiling tabs restructured: Category → Variant → Finish hierarchy
- `CategoryRow` and `VariantGrid` shared components created
- Surface category configs (`surfaceCategories.ts`) for walls, flooring, ceiling
- BottomPanel/CustomHotbar/RecentItemsBar hidden by default (`showHotbar: false`)
- Settings toggle to re-enable hotbar if needed

### 2. PresetCard Visual Upgrade
- Shared `PresetCard` component: square image area, highlight on image only, label below
- Hover: `scale(1.04)` + soft indigo-tinted shadow
- Select: indigo glow border + check badge + `selectPop` keyframe (scale 1.04→1.08→1.0)
- `icon`/`iconSize` props for emoji-based cards (eliminates wrapper div duplication)
- Bold text on hover AND select

### 3. Material-Accurate Ghost Preview
- `MaterialDef` type added to `container.ts`
- `ghostPreset` expanded with `materialMap`, `targetScope`, source union
- `createGhostMaterial` utility with WeakMap cache
- `PresetGhost` renders actual material clones at 30% opacity per face
- Ghost pop animation on click (scale 1.0→1.06→1.0, 200ms)
- Wired across ALL tabs: Block, Walls, Flooring, Ceiling

### 4. Gull-Wing Crash Fix
- Added `GullWingFace` renderer in ContainerSkin (hinged panels, 30deg open angle)
- Added `GullWingPanel` mesh in ContainerMesh
- Regression test added

### 5. Block Grid Edge Improvements
- Edge hotspots always visible (4px slate bars at 18% opacity)
- Hover: expand to 10px + bright amber (75% opacity)
- Selected face: expand to 10px + bright cyan (85% opacity)
- Cell borders: 4px thick on active face direction
- Both Detail and Simple (bay) grids updated
- Color legend removed from Block Grid

### 6. Code Quality Improvements
- `sectionHeaderStyle.ts` — shared section header style (5 files consolidated)
- `geometryCache.ts` — shared `getCachedPlane` (DebugOverlay + HoverPreviewGhost)
- VariantGrid `face` prop narrowed from `string` to `keyof VoxelFaces`
- DebugOverlay outer `<group>` replaced with fragment
- Sidebar: "Show preview" → "Show container preview", grid icon → Grid3x3
- Hover highlight on debug tiles (floor/wall/ceiling color-coded)
- Scoped `hoveredVoxelEdge` selector (per-container, no cross-container re-renders)

### 7. Hitbox Debug System (from prior sprint, carried forward)
- Stair voxel full-cube hitbox removed (blocked floor tiles)
- StampGhost uses `getVoxelLayout` for exact voxel dimensions
- Debug overlay hover highlights with face-coded materials

---

## Outstanding Issues for Next Sprint

### P0 — Bugs

| # | Issue | Root Cause | Files |
|---|-------|-----------|-------|
| 1 | **Frame mode materials don't update visually** | ContainerSkin/ContainerMesh not reactive to frame state changes | `FrameInspector.tsx`, `ContainerSkin.tsx`, `ContainerMesh.tsx` |
| 2 | **Frame mode should hide walls/ceiling** (view isolation) | Opacity isolation not wired into skin renderer | `ContainerSkin.tsx`, `ContainerMesh.tsx` |
| 3 | **Door flush positioning** (cosmetic) | Pivot offset calculations misaligned with wall face geometry | `ContainerSkin.tsx:542-617` |
| 4 | **Debug/Wireframe toggle missing from UI** | Removed during UI consolidation, no trigger mechanism | Toolbar component |

### P1 — Feature Gaps

| # | Issue | Status | Files |
|---|-------|--------|-------|
| 5 | **Block tab isometric previews** — cards use emoji icons, should show material-accurate R3F thumbnails | `BlockThumbnailRenderer.tsx` created but not wired to BlockTab | `BlockTab.tsx`, `BlockThumbnailContext.tsx` |
| 6 | **GLB models for 27 forms** — all render as procedural boxGeometry | Art pipeline blocker | `SceneObjectRenderer.tsx`, `/public/models/forms/` |
| 7 | **Multi-select in Block Grid** — Shift+Click row, Ctrl+Click toggle | Not started | `MatrixEditor.tsx` |
| 8 | **Grid orientation mismatch** — "S Deck 1" vs user expects "S Deck 3" nearest camera | FRONT/BACK labels added, numbering unchanged | `bayGroups.ts` |

### P2 — Phase 2 Completion (57 unchecked tasks)

The full Frame Mode system has a detailed plan at `docs/superpowers/plans/2026-03-20-phase2-completion.md` covering:
- Frame material/shape registries
- Frame data model types (`ElementConfig`)
- Frame store actions (`setFrameDefaults`, overrides, batch)
- UI slice extension (frameMode, selectedFrameElement)
- View isolation pure function + rendering
- Frame toggle button, inspector, 2D overlay
- Frame element interaction (hover/click handlers)
- Railing merge verification
- Bay mode rendering tests

### P3 — Deferred Gaps

| # | Gap | Effort | Notes |
|---|-----|--------|-------|
| 1 | 4 postprocessing style effects (salt_frost, soft_bloom, dappled_light, edge_glow) | High | Requires shader programming |
| 2 | Bottom-panel layout decision (dual-panel vs Sims-style drawer) | Design | UX decision needed |

---

## Critical Invariants

1. **Never mutate refs inside Zustand selectors** — causes render loop crashes
2. **`selectedFace` is orthogonal to `selectedElements`** — `setSelectedElements` must NOT clear `selectedFace` unless sel is null
3. **MatrixEditor owns the spatial grid** — all voxel layout calculations go through `getVoxelLayout`
4. **PresetCard convention** — square image area, highlight on image only, label below and outside border
5. **Zustand selectors with middleware** — no `equalityFn` 2nd arg; use `useShallow` + `useRef` dedup
6. **Floor-based hitbox paradigm** — vertical wall meshes use `raycast={nullRaycast}`; selection happens via floor-level edge strips

---

## Key Files Map

```
src/components/ui/finishes/
  PresetCard.tsx          — Shared card (icon/content/label, hover/select/pop)
  CategoryRow.tsx         — Type category selector (Wall/Door/Window/etc.)
  VariantGrid.tsx         — Variant cards with ghost preview + apply
  sectionHeaderStyle.ts   — Shared header style constant
  BlockThumbnailRenderer.tsx — R3F offscreen canvas (created, not wired)
  BlockThumbnailContext.tsx  — React context for thumbnail cache

src/components/objects/
  HoverPreviewGhost.tsx   — StampGhost + PresetGhost + 3D pop animation
  ContainerSkin.tsx       — All surface renderers (GullWingFace added)

src/components/three/
  DebugOverlay.tsx        — Floor tile wireframes + hover highlights
  ContainerMesh.tsx       — Frame elements, GullWingPanel

src/utils/
  geometryCache.ts        — Shared THREE.PlaneGeometry cache
  ghostMaterial.ts        — createGhostMaterial with WeakMap cache

src/store/slices/
  uiSlice.ts              — showHotbar, previewCollapsed, ghostPreset, ghostPop
  selectionSlice.ts       — selectedFace, hoveredVoxelEdge
```

---

## How to Verify

```bash
npx tsc --noEmit          # Zero errors
npx vitest run            # 495+ tests pass
npm run dev               # Start dev server on localhost:3000
```

1. Load app → no hotbar visible at bottom
2. Click container → Inspector opens with tabs (Container/Block/Flooring/Walls/Ceiling/Elec.)
3. Walls tab → Category row (Wall/Door/Window/Railing/Stairs/Shelf/Open) → Variant cards → Material/Color
4. Hover variant → ghost preview appears on selected face in 3D
5. Click variant → pop animation, face updates
6. Toggle grid (Grid3x3 icon) → Block Grid with visible edge strips
7. Hover edge → expands to amber bar; click → selects face with cyan highlight
