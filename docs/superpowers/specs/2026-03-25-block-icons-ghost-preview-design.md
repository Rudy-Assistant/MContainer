# Block Icons & Material Ghost Preview — Design Spec

**Date:** 2026-03-25
**Status:** Approved
**Sprint:** Block Visual Fidelity + Ghost Preview

## Problem

1. **Gull-Wing crash:** Selecting the Gull-Wing block preset causes the 3D scene to go black. While `GullWingFace` and `HingedBayGullWing` components exist in the codebase, the crash persists — likely a runtime error in the transition/animation path or a missing material. This needs investigation and a regression test.

2. **Block card icons use flat color approximations:** Current `IsometricVoxelSVG` renders isometric line drawings with flat fills from `surfaceColorMap.ts`. While the colors correspond to surface types, they don't show actual PBR material textures (steel corrugation, wood grain, glass refraction, etc.). Users can't visually preview what a preset will look like before clicking.

3. **No material-accurate ghost preview:** Hovering a preset card shows generic blue-tinted planes instead of the actual materials that would be applied. No visual confirmation of what "clicking" will produce.

4. **No click confirmation in 3D:** Applying a preset has no visual feedback in the scene — materials just swap silently.

## Scope

- Investigate and fix Gull-Wing crash + add regression test
- Replace SVG block icons with R3F OffscreenCanvas thumbnails using real PBR materials
- Material-accurate ghost preview on hover across ALL tabs (Block, Walls, Flooring, Ceiling)
- Pop-and-shrink click confirmation in both the card UI and the 3D scene

## Types

### MaterialDef

```typescript
// src/types/container.ts
interface MaterialDef {
  surfaceType: SurfaceType;
  /** Key into _themeMats texture cache (e.g., 'steelCorrugated', 'oakPlanks') */
  textureId?: string;
  /** Hex color override (e.g., '#78716c' for custom paint) */
  color?: string;
  /** Finish metadata — doorStyle, glassTint, etc. */
  finishMeta?: Record<string, string>;
}
```

Added to `src/types/container.ts` alongside existing `SurfaceType` and `VoxelFaces`.

## Design

### 1. Gull-Wing Crash Investigation + Fix

**Approach:** Investigate the runtime error that causes the black screen when Gull-Wing is applied. The `GullWingFace` component exists at ContainerSkin.tsx:519 and is mapped at lines 892/1299. The crash may be in:
- Missing material in `_themeMats` for the Gull-Wing surface
- Animation/transition code throwing during fold-out
- `HingedBayGullWing` geometry generation failing for certain voxel configurations

**Deliverables:**
- Root cause identified and fixed
- Regression test: apply Gull-Wing preset → verify scene doesn't go black
- If the mesh is incomplete (e.g., no animation), add basic open-position rendering

**Files:** `ContainerSkin.tsx`, `ContainerMesh.tsx` (investigate + fix)

### 2. Block Card Thumbnails via OffscreenCanvas

**Approach:** R3F OffscreenCanvas renders — pixel-perfect PBR material matching with cached snapshots.

**Architecture:**
- New component `BlockThumbnailRenderer` — a hidden R3F `<Canvas>` (128×128) using `frameloop="never"` and `gl={{ preserveDrawingBuffer: true }}` (required for `toDataURL`)
- Uses the same material factories as ContainerSkin (steel corrugation, wood deck, glass, etc.) scaled to a single voxel in isometric view
- On mount (and when theme/materials change), renders all ~8 presets sequentially, captures each via `gl.toDataURL()`, stores in a `Map<presetId, string>`
- Exposed via React context: `useBlockThumbnail(presetId)` returns the cached data URL
- BlockTab's PresetCard uses `content={<img src={thumbnail} />}` instead of `IsometricVoxelSVG`
- Cache invalidates when the active material theme changes (Zustand selector on theme ID)

**Canvas requirements:**
- `frameloop="never"` — manual render per preset only
- `gl={{ preserveDrawingBuffer: true }}` — required for `toDataURL()` to return non-blank
- Single secondary WebGL context (note: browsers limit to 8-16 contexts; dispose renderer on unmount)

**Per-preset rendering:**
- Camera at standard isometric angle (matching VoxelPreview3D)
- Single voxel box with the preset's 6 face materials applied
- Open faces: rendered as wireframe/transparent (dotted-line convention)
- Directional + ambient lighting (consistent across all cards)
- ~50ms per capture × 8 presets = ~400ms total on first load, then cached

**Files:**
- New: `src/components/ui/finishes/BlockThumbnailRenderer.tsx`
- New: `src/components/ui/finishes/BlockThumbnailContext.tsx`
- Modified: `src/components/ui/finishes/BlockTab.tsx` (consume thumbnails)

### 3. Material-Accurate Ghost Preview System

**Current state:** `PresetGhost` in `HoverPreviewGhost.tsx` renders flat blue/glass-tinted planes via `_ghostMats.solid` and `_ghostMats.glass`.

**Store changes:**
- `ghostPreset` gains a `materialMap` field: `Record<keyof VoxelFaces, MaterialDef>` — each face maps to a `MaterialDef` (defined in Types section above)
- `ghostPreset.source` union expanded to `'block' | 'container' | 'walls' | 'flooring' | 'ceiling'`
- Tab components set `ghostPreset` with the full material definition on hover

**Ghost renderer changes:**
- Replace flat materials with dynamically created transparent clones of actual scene materials
- New utility `createGhostMaterial(baseMaterial: THREE.Material): THREE.Material` — clones the material, sets `transparent: true`, `opacity: 0.30`, `depthWrite: false`
- Cache keyed by the `THREE.Material` object reference (WeakMap), not string ID. This ensures theme changes automatically invalidate stale clones — when `_themeMats` creates new material instances on theme switch, the WeakMap entries for old materials are GC'd, and new clones are created on next access.
- Each face panel in the pool gets its correct ghost material from `materialMap[face]`
- Open faces: no panel rendered (current behavior)
- Pulse animation: opacity oscillates 0.22–0.34 on all active ghost materials
- Pool size remains `GHOST_POOL_SIZE = 48` (8 voxels × 6 faces). If pool is exhausted, remaining faces are silently skipped (acceptable — only occurs with 8+ simultaneously ghosted voxels)

**Tab integration (all tabs):**
- **Block tab:** `ghostPreset.materialMap` populated from the preset's full face definitions; `source: 'block'`
- **Walls tab:** On variant hover, `materialMap` has the hovered surface on the selected face only; `source: 'walls'`
- **Flooring tab:** `materialMap.bottom` gets the hovered floor material; `source: 'flooring'`
- **Ceiling tab:** `materialMap.top` gets the hovered ceiling material; `source: 'ceiling'`

**Files:**
- Modified: `src/components/objects/HoverPreviewGhost.tsx` (PresetGhost rewrite)
- Modified: `src/store/slices/uiSlice.ts` (ghostPreset type expansion + source union)
- Modified: `src/types/container.ts` (MaterialDef interface)
- Modified: `src/components/ui/finishes/BlockTab.tsx` (set materialMap on hover)
- Modified: `src/components/ui/finishes/VariantGrid.tsx` (set materialMap on hover)
- Modified: `src/components/ui/finishes/FlooringTab.tsx` (set materialMap on hover)
- Modified: `src/components/ui/finishes/CeilingTab.tsx` (set materialMap on hover)

### 4. Pop-and-Shrink Click Confirmation in 3D Scene

**Interaction flow:**
1. **Idle** — Voxel shows current materials at full opacity
2. **Hover card** — Ghost panels appear on affected faces at ~30% opacity with the hovered material's texture, pulsing gently
3. **Click card** — Three simultaneous effects:
   - PresetCard plays existing `selectPop` keyframe (scale 1.04 → 1.08 → 1.0, 200ms)
   - 3D ghost panels do a matching pop (scale 1.0 → 1.06 → 1.0, 200ms ease-out), then snap to full opacity as preset is applied
   - Structural changes (Gull-Wing hinges, stairs) begin geometry transition during pop, completing over 300ms
4. **Selected at rest** — Ghost cleared, real materials at full opacity, card shows check badge

**Implementation:**
- New Zustand fields: `ghostPopActive: boolean` and `ghostPopStartTime: number`
- `ghostPopActive` is set `true` by a Zustand action `triggerGhostPop()` which also records `ghostPopStartTime = performance.now()`
- The pop timer is driven by `PresetGhost`'s `useFrame` loop: each frame checks `performance.now() - ghostPopStartTime`. When elapsed >= 200ms, the `useFrame` callback calls `clearGhostPop()` (a store action that sets `ghostPopActive: false`). This keeps the timer in the render loop, not a `setTimeout`, avoiding React 19 strict mode issues.
- After pop completes, `applyBlockConfig`/`paintFace` applies the actual preset → ContainerSkin re-renders → ghost auto-hides

**Files:**
- Modified: `src/store/slices/uiSlice.ts` (ghostPopActive + ghostPopStartTime fields, triggerGhostPop/clearGhostPop actions)
- Modified: `src/components/objects/HoverPreviewGhost.tsx` (pop animation in useFrame)

## Critical Invariants

- `selectedFace` is orthogonal to `selectedElements` — ghost preview must not conflate them
- Never mutate refs inside Zustand selectors
- MatrixEditor owns the spatial grid — ghost preview reads but never writes grid state
- Ghost material clones use WeakMap keying — theme changes invalidate automatically via GC
- OffscreenCanvas renderer must be disposed when BlockThumbnailRenderer unmounts (prevent context leak)
- `ghostPopActive` timer runs in `useFrame`, not `setTimeout` (React 19 strict mode safe)

## Testing

- Unit: `MaterialDef` interface matches expected shape with all optional fields
- Unit: ghost material clone creates transparent copy with correct opacity (0.30)
- Unit: `createGhostMaterial` WeakMap cache returns same clone for same material, new clone for new material
- Unit: BlockThumbnailRenderer produces valid data URLs for all presets
- Unit: Gull-Wing surface type renders without throwing
- Unit: `ghostPopActive` lifecycle — `triggerGhostPop` sets true + startTime, `clearGhostPop` sets false
- Unit: `ghostPreset.source` accepts all values: `'block' | 'container' | 'walls' | 'flooring' | 'ceiling'`
- Visual/Playwright: select container → Block tab → hover preset → verify ghost appears on 3D voxel with material texture
- Visual/Playwright: click Gull-Wing → verify scene doesn't go black
- Visual/Playwright: verify block card thumbnails show PBR material textures, not flat-fill SVGs
- Visual/Playwright: click a block preset → verify pop-and-shrink animation plays in 3D scene
