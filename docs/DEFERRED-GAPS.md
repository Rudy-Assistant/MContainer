# Deferred Gaps — Remaining Work Items

> Updated 2026-05-02. Previously listed items have been resolved inline.

## 1. GLB Models for 27 Forms (Art Pipeline — code-side RESOLVED)

**Current state:** All 27 forms render as procedural placeholders. The renderer infrastructure for swapping any form to a Blender-authored GLB is fully wired (`SceneObjectRenderer.tsx` → `GlbFormMesh`, lines 109-140 + 260-368), including:
- `useGLTF` load via `<Suspense>` with `ProceduralFormMesh` fallback
- Per-instance scene clone (so multiple instances don't share materials)
- Mesh-name → skin-slot matching with material disposal on unmount
- Hover emissive propagation across all cloned meshes
- Conventions documented at `/public/models/forms/README.md` (file naming, mesh names per skin slot, dimension/triangle budgets, orientation)

**What's still needed:** Blender-authored `.glb` files placed at `/public/models/forms/{formId}.glb`. Once art exists, flipping a form to GLB is a one-line content change:
- Set `geometry: 'glb'` and `glbPath: '/models/forms/{formId}.glb'` in the form definition

**Files to modify (per form):** `src/config/forms/{doors,windows,lights,electrical}.ts`. **No code changes required.**

## 2. ~~Four Postprocessing Style Effects~~ RESOLVED

All 4 effects are implemented:
- `salt_frost` — HueSaturation desaturation + BrightnessContrast + Outline (layer 11)
- `soft_bloom` — Bloom with lowered luminance threshold (0.5)
- `dappled_light` — DappleGobo procedural gobo plane with leaf-pattern shadows
- `edge_glow` — Outline with style color (layer 12)

## 3. Bottom-Panel Layout Option (Design Decision)

**Current state:** FormCatalog is a fixed bottom bar. SkinEditor is a fixed left panel. The user flagged a potential future redesign to a Sims-style bottom panel that combines both.

**Status:** Design/UX decision, not a code gap. BottomPanel.tsx exists as a unified drawer.

## 4. Phase 4: Hinged Wall Animations

**Current state:** TODO in ContainerMesh.tsx line 2538. Legacy WallAssembly components disabled due to Z-fighting with ContainerSkin voxel faces.

**What's needed:** Rebuild hinged door/wall fold animations within the voxel-based rendering system (ContainerSkin is now sole authority for wall rendering).

## 5. Shelf Surface Category

**Current state:** Placeholder category in surfaceCategories.ts with empty variants array.

**What's needed:** Shelves are scene objects (wall-mounted furniture), not surface types. Requires scene object pipeline support for wall-mounted items with anchor type='face'.
