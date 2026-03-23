# Deferred Gaps — Unified Placeable Object System

> These items were explicitly deferred during the Form+Skin sprint (March 2026).
> Future sprints should pick these up.

## 1. GLB Models for 27 Forms (Art Pipeline)

**Current state:** All 27 forms render as procedural `<boxGeometry>` placeholders in `SceneObjectRenderer.tsx`.

**What's needed:** Blender-authored `.glb` models for each form, placed in `/public/models/forms/`. Each `FormDefinition` already has a `geometry: 'procedural' | 'glb'` field and optional `glbPath`. Switching a form to GLB requires:
- Set `geometry: 'glb'` and `glbPath` in the form definition
- Add `useGLTF` loading in `SceneObjectMesh` (conditional on `form.geometry`)
- Apply skin materials to GLB mesh children (match skin slot IDs to mesh names)

**Files to modify:** `src/components/objects/SceneObjectRenderer.tsx`, `src/config/forms/*.ts`

## 2. Four Postprocessing Style Effects

**Current state:** These 4 effects are no-ops in `src/utils/styleEffects.ts` (switch cases with `break` only).

| Effect | Requires |
|--------|----------|
| `salt_frost` | Edge-detect shader pass — white blend on exterior frame edges |
| `soft_bloom` | Per-fixture bloom threshold override in `@react-three/postprocessing` |
| `dappled_light` | Gobo/cookie texture applied to `SunLight` shadow camera |
| `edge_glow` | Emissive channel mapped to edge geometry UVs on frame meshes |

**Files to modify:** `src/utils/styleEffects.ts`, `src/components/three/PostProcessingStack.tsx`, `src/components/three/SunLight.tsx`

## 3. Bottom-Panel Layout Option

**Current state:** FormCatalog is a fixed bottom bar (`position: fixed, bottom: 80px`). SkinEditor is a fixed left panel. The user flagged a potential future redesign to a Sims-style bottom panel that combines both.

**Decision point:** Whether to keep the current dual-panel (left + bottom) or merge into a single bottom drawer. This is a design/UX decision, not a code gap.

**Files affected:** `src/components/ui/FormCatalog.tsx`, `src/components/ui/SkinEditor.tsx`, `src/app/page.tsx`
