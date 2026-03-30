# Deferred Gaps — Remaining Work Items

> Updated 2026-03-30. Previously listed items have been resolved inline.

## 1. GLB Models for 27 Forms (Art Pipeline)

**Current state:** All 27 forms render as procedural `<boxGeometry>` placeholders in `SceneObjectRenderer.tsx`.

**What's needed:** Blender-authored `.glb` models for each form, placed in `/public/models/forms/`. Each `FormDefinition` already has a `geometry: 'procedural' | 'glb'` field and optional `glbPath`. Switching a form to GLB requires:
- Set `geometry: 'glb'` and `glbPath` in the form definition
- Add `useGLTF` loading in `SceneObjectMesh` (conditional on `form.geometry`)
- Apply skin materials to GLB mesh children (match skin slot IDs to mesh names)

**Files to modify:** `src/components/objects/SceneObjectRenderer.tsx`, `src/config/forms/*.ts`

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
