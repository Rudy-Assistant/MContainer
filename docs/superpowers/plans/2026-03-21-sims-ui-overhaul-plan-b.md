# Sims-Style UI Overhaul — Plan B: Finishes, Rendering & Fixtures

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the FaceFinish data model (from Plan A) into the rendering pipeline and build the full Finishes panel UI with inline color picker, light fixture meshes, and electrical plate meshes.

**Architecture:** Add `getMaterialForFace()` resolver to materialCache.ts that overrides theme materials when faceFinishes are present. Build FinishesPanel.tsx as a contextual sidebar component that adapts to the selected face's structural type (wall/window/door/floor/ceiling). Add procedural 3D meshes for light fixtures and electrical plates that render when faceFinishes specify them. All changes are additive — existing rendering is unchanged when faceFinishes are absent.

**Tech Stack:** React 19, Zustand 5, TypeScript, Three.js (R3F), @react-three/fiber v9

**Spec:** `docs/superpowers/specs/2026-03-21-sims-style-ui-overhaul-design.md`
**Plan A:** `docs/superpowers/plans/2026-03-21-sims-ui-overhaul-plan-a.md` (completed)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/config/materialCache.ts` | Modify | Add `getMaterialForFace()` resolver + paint material cache |
| `src/components/ui/FinishesPanel.tsx` | Create | Contextual finish UI for wall/window/door/floor/ceiling faces |
| `src/components/ui/ColorPicker.tsx` | Create | Inline hue/saturation/hex color picker |
| `src/components/ui/Sidebar.tsx` | Modify | Replace Plan B stub with real FinishesPanel |
| `src/components/objects/ContainerSkin.tsx` | Modify | Pass faceFinish to SingleFace, wire getMaterialForFace into renderVisual |
| `src/components/objects/LightFixture.tsx` | Create | Procedural 3D light fixture meshes (pendant/flush/track/recessed) |
| `src/components/objects/ElectricalPlate.tsx` | Create | Procedural 3D wall switch/outlet plate meshes |
| `src/config/finishPresets.ts` | Create | Finish option catalogs (materials, paints, tints, frame colors, etc.) |
| `src/Testing/material-resolution.test.ts` | Create | Tests for getMaterialForFace |
| `src/Testing/finishes-panel.test.ts` | Create | Tests for FinishesPanel contextual rendering |
| `src/Testing/light-fixture.test.ts` | Create | Tests for light fixture data/store integration |

---

### Task 1: Finish Option Presets Catalog

**Files:**
- Create: `src/config/finishPresets.ts`
- Create: `src/Testing/finish-presets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/Testing/finish-presets.test.ts
import { describe, it, expect } from 'vitest';
import {
  EXTERIOR_MATERIALS, PAINT_COLORS, GLASS_TINTS,
  FRAME_COLORS, DOOR_STYLES, LIGHT_FIXTURES, LIGHT_COLORS,
  ELECTRICAL_TYPES, FLOOR_MATERIALS, CEILING_MATERIALS,
  getFinishOptionsForFace,
} from '../config/finishPresets';
import type { SurfaceType } from '../types/container';

describe('finishPresets', () => {
  it('EXTERIOR_MATERIALS has at least 4 entries', () => {
    expect(EXTERIOR_MATERIALS.length).toBeGreaterThanOrEqual(4);
    expect(EXTERIOR_MATERIALS[0]).toHaveProperty('id');
    expect(EXTERIOR_MATERIALS[0]).toHaveProperty('label');
    expect(EXTERIOR_MATERIALS[0]).toHaveProperty('color');
  });

  it('PAINT_COLORS has 14 preset colors + no-paint option', () => {
    expect(PAINT_COLORS.length).toBeGreaterThanOrEqual(14);
    PAINT_COLORS.forEach(c => {
      expect(c).toHaveProperty('hex');
      expect(c).toHaveProperty('label');
    });
  });

  it('getFinishOptionsForFace returns wall options for Solid_Steel', () => {
    const opts = getFinishOptionsForFace('Solid_Steel' as SurfaceType, 'n');
    expect(opts.exteriorMaterial).toBe(true);
    expect(opts.interiorPaint).toBe(true);
    expect(opts.electrical).toBe(true);
    expect(opts.glassTint).toBe(false);
  });

  it('getFinishOptionsForFace returns window options for Window_Standard', () => {
    const opts = getFinishOptionsForFace('Window_Standard' as SurfaceType, 'n');
    expect(opts.frameColor).toBe(true);
    expect(opts.glassTint).toBe(true);
    expect(opts.exteriorMaterial).toBe(false);
  });

  it('getFinishOptionsForFace returns door options for Door', () => {
    const opts = getFinishOptionsForFace('Door' as SurfaceType, 'n');
    expect(opts.doorStyle).toBe(true);
    expect(opts.frameColor).toBe(true);
  });

  it('getFinishOptionsForFace returns ceiling options for top face', () => {
    const opts = getFinishOptionsForFace('Solid_Steel' as SurfaceType, 'top');
    expect(opts.lightFixture).toBe(true);
    expect(opts.lightColor).toBe(true);
    expect(opts.ceilingMaterial).toBe(true);
  });

  it('getFinishOptionsForFace returns floor options for bottom face', () => {
    const opts = getFinishOptionsForFace('Deck_Wood' as SurfaceType, 'bottom');
    expect(opts.floorMaterial).toBe(true);
    expect(opts.electrical).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/finish-presets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement finishPresets.ts**

```ts
// src/config/finishPresets.ts
import type { SurfaceType, VoxelFaces } from '../types/container';

export interface MaterialPreset {
  id: string;
  label: string;
  color: string;    // hex color for preview swatch
  icon?: string;
}

export interface ColorPreset {
  hex: string;
  label: string;
}

// ── Exterior wall materials ──
export const EXTERIOR_MATERIALS: MaterialPreset[] = [
  { id: 'steel',    label: 'Steel',    color: '#708090' },
  { id: 'wood',     label: 'Wood',     color: '#8B7355' },
  { id: 'concrete', label: 'Concrete', color: '#A9A9A9' },
  { id: 'bamboo',   label: 'Bamboo',   color: '#D4B896' },
];

// ── Interior paint colors (14 presets from spec) ──
export const PAINT_COLORS: ColorPreset[] = [
  { hex: '#FAF9F6', label: 'White' },
  { hex: '#F5F0EB', label: 'Warm White' },
  { hex: '#EDE8E0', label: 'Cream' },
  { hex: '#E8DDD0', label: 'Linen' },
  { hex: '#D5C4A1', label: 'Sand' },
  { hex: '#C4B39C', label: 'Beige' },
  { hex: '#A0937D', label: 'Taupe' },
  { hex: '#8B7D6B', label: 'Mocha' },
  { hex: '#6B7F6B', label: 'Sage' },
  { hex: '#4A5D4A', label: 'Forest' },
  { hex: '#B8C4C4', label: 'Silver' },
  { hex: '#8E9E9E', label: 'Slate' },
  { hex: '#5C6B6B', label: 'Charcoal' },
  { hex: '#3A3A3A', label: 'Carbon' },
];

// ── Glass tints ──
export const GLASS_TINTS: ColorPreset[] = [
  { hex: '#FFFFFF', label: 'Clear' },
  { hex: '#696969', label: 'Smoke' },
  { hex: '#4A90D9', label: 'Blue' },
  { hex: '#2F4F4F', label: 'Privacy' },
];

// ── Frame colors (window/door) ──
export const FRAME_COLORS: ColorPreset[] = [
  { hex: '#1A1A1A', label: 'Black' },
  { hex: '#FFFFFF', label: 'White' },
  { hex: '#8B6914', label: 'Bronze' },
  { hex: '#C4A882', label: 'Natural' },
];

// ── Door styles ──
export const DOOR_STYLES: MaterialPreset[] = [
  { id: 'swing',   label: 'Swing',   color: '#8B7355' },
  { id: 'sliding', label: 'Sliding', color: '#708090' },
  { id: 'barn',    label: 'Barn',    color: '#A0522D' },
];

// ── Light fixtures (ceiling) ──
export const LIGHT_FIXTURES: MaterialPreset[] = [
  { id: 'none',     label: 'None',      color: '#333333' },
  { id: 'pendant',  label: 'Pendant',   color: '#FFD700' },
  { id: 'flush',    label: 'Flush',     color: '#F0E68C' },
  { id: 'track',    label: 'Track',     color: '#C0C0C0' },
  { id: 'recessed', label: 'Recessed',  color: '#FFFACD' },
];

// ── Light colors (id=semantic key stored in faceFinish.lightColor, hex=preview swatch) ──
export const LIGHT_COLORS: MaterialPreset[] = [
  { id: 'warm',     label: 'Warm White', color: '#FFE4B5' },
  { id: 'cool',     label: 'Cool White', color: '#F0F8FF' },
  { id: 'daylight', label: 'Daylight',   color: '#FFFFF0' },
  { id: 'amber',    label: 'Amber',      color: '#FFBF00' },
];

// ── Electrical types ──
export const ELECTRICAL_TYPES: MaterialPreset[] = [
  { id: 'none',          label: 'None',          color: '#333333' },
  { id: 'switch',        label: 'Switch',        color: '#F5F5F5' },
  { id: 'double_switch', label: 'Double Switch', color: '#F5F5F5' },
  { id: 'outlet',        label: 'Outlet',        color: '#F5F5F5' },
  { id: 'dimmer',        label: 'Dimmer',        color: '#F5F5F5' },
];

// ── Floor materials ──
export const FLOOR_MATERIALS: MaterialPreset[] = [
  { id: 'oak_wood',    label: 'Oak Planks',       color: '#A0785A' },
  { id: 'concrete',    label: 'Polished Concrete', color: '#A9A9A9' },
  { id: 'bamboo',      label: 'Bamboo',            color: '#D4B896' },
  { id: 'hinoki',      label: 'Hinoki Cedar',      color: '#F5E6C8' },
  { id: 'tatami',      label: 'Tatami',            color: '#C8D5A0' },
  { id: 'tile',        label: 'Tile',              color: '#E0D5C5' },
];

// ── Ceiling materials ──
export const CEILING_MATERIALS: MaterialPreset[] = [
  { id: 'steel',   label: 'Steel',   color: '#708090' },
  { id: 'open',    label: 'Open',    color: '#333333' },
  { id: 'plaster', label: 'Plaster', color: '#F5F5F5' },
];

// ── Contextual options resolver ──

export interface FinishOptions {
  exteriorMaterial: boolean;
  interiorPaint: boolean;
  glassTint: boolean;
  frameColor: boolean;
  doorStyle: boolean;
  lightFixture: boolean;
  lightColor: boolean;
  electrical: boolean;
  floorMaterial: boolean;
  ceilingMaterial: boolean;
}

const WALL_SURFACES = new Set<string>([
  'Solid_Steel', 'Wall_Washi', 'Wood_Hinoki', 'Concrete', 'Deck_Wood',
]);
const WINDOW_SURFACES = new Set<string>([
  'Window_Standard', 'Window_Half', 'Window_Sill', 'Window_Clerestory',
  'Glass_Pane', 'Glass_Shoji',
]);

export function getFinishOptionsForFace(
  surface: SurfaceType,
  face: keyof VoxelFaces | string,
): FinishOptions {
  const isTop = face === 'top';
  const isBottom = face === 'bottom';
  const isWallFace = !isTop && !isBottom;
  const isWall = WALL_SURFACES.has(surface);
  const isWindow = WINDOW_SURFACES.has(surface);
  const isDoor = surface === 'Door';

  return {
    exteriorMaterial: isWallFace && isWall,
    interiorPaint:    isWallFace && isWall,
    glassTint:        isWallFace && isWindow,
    frameColor:       isWallFace && (isWindow || isDoor),
    doorStyle:        isWallFace && isDoor,
    lightFixture:     isTop,
    lightColor:       isTop,
    electrical:       isWallFace && (isWall || isWindow || isDoor),
    floorMaterial:    isBottom,
    ceilingMaterial:  isTop,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/finish-presets.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/finishPresets.ts src/Testing/finish-presets.test.ts
git commit -m "feat: add finish option presets catalog and contextual resolver"
```

---

### Task 2: getMaterialForFace Resolver

**Files:**
- Modify: `src/config/materialCache.ts` (add getMaterialForFace + paint cache)
- Create: `src/Testing/material-resolution.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/Testing/material-resolution.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { getMaterialForFace, _themeMats } from '../config/materialCache';
import type { FaceFinish } from '../types/container';

describe('getMaterialForFace', () => {
  it('returns theme steel material when no finish override', () => {
    const mat = getMaterialForFace('Solid_Steel', undefined, 'industrial');
    expect(mat).toBe(_themeMats.industrial.steel);
  });

  it('returns theme glass material for Glass_Pane with no finish', () => {
    const mat = getMaterialForFace('Glass_Pane', undefined, 'industrial');
    expect(mat).toBe(_themeMats.industrial.glass);
  });

  it('returns theme wood material for Deck_Wood with no finish', () => {
    const mat = getMaterialForFace('Deck_Wood', undefined, 'industrial');
    expect(mat).toBe(_themeMats.industrial.wood);
  });

  it('applies paint color override — returns cloned material', () => {
    const mat = getMaterialForFace('Solid_Steel', { paint: '#FF0000' }, 'industrial');
    expect(mat).not.toBe(_themeMats.industrial.steel);
    expect((mat as THREE.MeshStandardMaterial).color.getHexString()).toBe('ff0000');
  });

  it('does NOT mutate singleton when applying paint', () => {
    const originalHex = _themeMats.industrial.steel.color.getHexString();
    getMaterialForFace('Solid_Steel', { paint: '#00FF00' }, 'industrial');
    expect(_themeMats.industrial.steel.color.getHexString()).toBe(originalHex);
  });

  it('caches paint materials — same input returns same instance', () => {
    const a = getMaterialForFace('Solid_Steel', { paint: '#0000FF' }, 'industrial');
    const b = getMaterialForFace('Solid_Steel', { paint: '#0000FF' }, 'industrial');
    expect(a).toBe(b);
  });

  it('applies tint to glass material', () => {
    const mat = getMaterialForFace('Glass_Pane', { tint: '#696969' }, 'industrial');
    expect(mat).not.toBe(_themeMats.industrial.glass);
    expect((mat as THREE.MeshPhysicalMaterial).color.getHexString()).toBe('696969');
  });

  it('resolves material override for wood exterior', () => {
    const mat = getMaterialForFace('Solid_Steel', { material: 'wood' }, 'industrial');
    expect(mat).toBe(_themeMats.industrial.wood);
  });

  it('resolves material override for concrete exterior', () => {
    const mat = getMaterialForFace('Solid_Steel', { material: 'concrete' }, 'industrial');
    expect(mat).toBe(_themeMats.industrial.concrete);
  });

  it('falls back to steel when material id is unknown', () => {
    const mat = getMaterialForFace('Solid_Steel', { material: 'unobtanium' }, 'industrial');
    expect(mat).toBe(_themeMats.industrial.steel);
  });

  it('paint takes precedence over material override', () => {
    const mat = getMaterialForFace('Solid_Steel', { material: 'wood', paint: '#FF0000' }, 'industrial');
    expect((mat as THREE.MeshStandardMaterial).color.getHexString()).toBe('ff0000');
  });

  it('applies frame color for window frames', () => {
    const mat = getMaterialForFace('Window_Standard', { frameColor: '#1A1A1A' }, 'industrial');
    // Frame color creates a cloned frame material with the specified color
    expect(mat).not.toBe(_themeMats.industrial.frame);
    expect((mat as THREE.MeshStandardMaterial).color.getHexString()).toBe('1a1a1a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/material-resolution.test.ts`
Expected: FAIL — `getMaterialForFace` not exported.

- [ ] **Step 3: Implement getMaterialForFace in materialCache.ts**

Add at the bottom of `src/config/materialCache.ts`:

```ts
import type { FaceFinish, SurfaceType } from '../types/container';

// ── Paint material cache (avoids cloning on every frame) ──
const _paintCache = new Map<string, THREE.MeshStandardMaterial>();
const _tintCache = new Map<string, THREE.MeshPhysicalMaterial>();
const _frameColorCache = new Map<string, THREE.MeshStandardMaterial>();

/** Map material id from FaceFinish.material to a ThemeMaterialSet key */
const MATERIAL_ID_MAP: Record<string, keyof ThemeMaterialSet> = {
  steel: 'steel',
  wood: 'wood',
  concrete: 'concrete',
  bamboo: 'wood',  // bamboo uses wood material with different color (future: dedicated)
};

/** Map SurfaceType to default ThemeMaterialSet key */
function surfaceToMatKey(surface: SurfaceType): keyof ThemeMaterialSet {
  switch (surface) {
    case 'Solid_Steel':
    case 'Half_Fold':
    case 'Gull_Wing':
      return 'steel';
    case 'Glass_Pane':
    case 'Glass_Shoji':
      return 'glass';
    case 'Window_Standard':
    case 'Window_Half':
    case 'Window_Sill':
    case 'Window_Clerestory':
      return 'frame';
    case 'Deck_Wood':
    case 'Wood_Hinoki':
      return 'wood';
    case 'Concrete':
      return 'concrete';
    case 'Railing_Cable':
      return 'rail';
    case 'Railing_Glass':
      return 'railGlass';
    case 'Door':
    case 'Wall_Washi':
      return 'wood';
    default:
      return 'steel';
  }
}

/**
 * Resolve the THREE.Material for a face, considering faceFinish overrides.
 *
 * Priority (highest to lowest):
 * 1. paint → clone base material, set color
 * 2. tint → clone glass material, set color (glass surfaces only)
 * 3. frameColor → clone frame material, set color (window/door surfaces only)
 * 4. material → resolve from MATERIAL_ID_MAP
 * 5. theme default for SurfaceType
 */
export function getMaterialForFace(
  surface: SurfaceType,
  finish: FaceFinish | undefined,
  theme: ThemeId,
): THREE.Material {
  const mats = _themeMats[theme];
  const baseKey = surfaceToMatKey(surface);
  const baseMat = mats[baseKey];

  if (!finish) return baseMat;

  // Paint override (highest priority for visual)
  if (finish.paint) {
    const cacheKey = `${theme}:${baseKey}:paint:${finish.paint}`;
    let cached = _paintCache.get(cacheKey);
    if (!cached) {
      cached = (baseMat as THREE.MeshStandardMaterial).clone();
      cached.color = new THREE.Color(finish.paint);
      _paintCache.set(cacheKey, cached);
    }
    return cached;
  }

  // Tint override (glass surfaces)
  if (finish.tint && (baseKey === 'glass' || baseKey === 'railGlass')) {
    const cacheKey = `${theme}:${baseKey}:tint:${finish.tint}`;
    let cached = _tintCache.get(cacheKey);
    if (!cached) {
      cached = (baseMat as THREE.MeshPhysicalMaterial).clone();
      cached.color = new THREE.Color(finish.tint);
      _tintCache.set(cacheKey, cached);
    }
    return cached;
  }

  // Frame color override (window/door frame material)
  if (finish.frameColor && (baseKey === 'frame' || surface === 'Door')) {
    const frameMat = mats.frame;
    const cacheKey = `${theme}:frame:color:${finish.frameColor}`;
    let cached = _frameColorCache.get(cacheKey);
    if (!cached) {
      cached = frameMat.clone();
      cached.color = new THREE.Color(finish.frameColor);
      _frameColorCache.set(cacheKey, cached);
    }
    return cached;
  }

  // Material override (steel → wood, etc.)
  if (finish.material) {
    const overrideKey = MATERIAL_ID_MAP[finish.material];
    if (overrideKey) return mats[overrideKey];
    // Unknown material id → fall back to default
    return baseMat;
  }

  return baseMat;
}

/** Clear paint/tint caches — call when theme materials are rebuilt */
export function clearFinishMaterialCaches() {
  for (const mat of _paintCache.values()) mat.dispose();
  for (const mat of _tintCache.values()) mat.dispose();
  for (const mat of _frameColorCache.values()) mat.dispose();
  _paintCache.clear();
  _tintCache.clear();
  _frameColorCache.clear();
}
```

Also add a call to `clearFinishMaterialCaches()` inside the existing `rebuildThemeMaterials` function. Place it AFTER the disposal loop completes (after line 209, before the `applyQualityTextures` call on line 210):

```ts
  // After: for (const matSet of oldMats) { ... dispose ... }
  clearFinishMaterialCaches();
  // Before: applyQualityTextures(quality, invalidate);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/material-resolution.test.ts`
Expected: All 12 tests PASS.

- [ ] **Step 5: Run full suite**

Run: `cd /c/MHome/MContainer && npx vitest run && npx tsc --noEmit`
Expected: All tests pass, 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add src/config/materialCache.ts src/Testing/material-resolution.test.ts
git commit -m "feat: add getMaterialForFace resolver with paint/tint/frame caching"
```

---

### Task 3: Wire getMaterialForFace into ContainerSkin Rendering

**Files:**
- Modify: `src/components/objects/ContainerSkin.tsx`

This task passes `faceFinish` data through to `SingleFace` and uses `getMaterialForFace` in the `renderVisual()` function to override the hardcoded material selections.

- [ ] **Step 1: Read the SingleFace component and FaceProps interface**

Read `src/components/objects/ContainerSkin.tsx` lines 850-920 (FaceProps interface) and lines 1074-1113 (renderVisual function). Note the current hardcoded material assignments.

- [ ] **Step 2: Add faceFinish to FaceProps interface**

Find the `FaceProps` interface (near the `SingleFace` function, around line 850). It should look something like:

```ts
interface FaceProps {
  dir: keyof VoxelFaces;
  surface: SurfaceType;
  colPitch: number;
  // ...etc
}
```

Add these two fields to FaceProps:
```ts
faceFinish?: FaceFinish;
theme: ThemeId;
```
Import `FaceFinish` from `../../types/container` and `ThemeId` from `../../config/themes` at the top of the file.

In the `SingleFace` function signature, destructure `faceFinish` and `theme` (aliased as `activeTheme` for clarity in renderVisual):
```ts
function SingleFace({
  dir, surface, faceFinish, theme: activeTheme, colPitch, rowPitch, ...
}: FaceProps) {
```

- [ ] **Step 3: Pass faceFinish and theme from voxel data to SingleFace**

In the voxel rendering loop (around line 2368 where `<SingleFace>` is rendered), the voxel is already available. Add:

```tsx
<SingleFace
  key={`face-${dir}`}
  dir={dir}
  surface={surface}
  faceFinish={voxel.faceFinishes?.[dir]}   // ← ADD THIS
  theme={currentTheme}                      // ← ADD THIS (already in scope from parent)
  colPitch={voxW}
  // ...rest of props unchanged
/>
```

- [ ] **Step 4: Wire getMaterialForFace into renderVisual()**

In `SingleFace`, destructure `faceFinish` from props. In the `renderVisual()` function (line 1074), import and use `getMaterialForFace`:

Add at the top of ContainerSkin.tsx:
```ts
import { getMaterialForFace } from '../../config/materialCache';
```

In `SingleFace`, add `faceFinish` to the destructured props.

Then in `renderVisual()`, replace the hardcoded material usage for `Solid_Steel` walls:

**Before** (line 1097):
```tsx
case "Solid_Steel":   return <SteelFace w={bW} h={bH} d={bD} />;
```

**After:**
```tsx
case "Solid_Steel": {
  if (faceFinish?.paint || faceFinish?.material) {
    const mat = getMaterialForFace('Solid_Steel', faceFinish, activeTheme);
    return <mesh geometry={getBox(bW, bH, bD)} material={mat} castShadow receiveShadow raycast={nullRaycast} />;
  }
  return <SteelFace w={bW} h={bH} d={bD} />;
}
```

Similarly for glass surfaces with tint — modify `GlassFace` to accept an optional `glassMat` prop:

First, update the `GlassFace` function signature (around line 272) to accept an optional material override:
```tsx
function GlassFace({
  w, h, d, isNS, glassMat,
}: { w: number; h: number; d: number; isNS: boolean; glassMat?: THREE.MeshPhysicalMaterial }) {
```

Then replace the hardcoded `mGlass` usage inside GlassFace with `glassMat ?? mGlass`. There are two `<mesh ... material={mGlass} ...>` elements (N/S and E/W branches) — change both to `material={glassMat ?? mGlass}`.

Then in `renderVisual()`:
**Before:**
```tsx
case "Glass_Pane":    return <GlassFace w={bW} h={bH} d={bD} isNS={isNS} />;
```

**After:**
```tsx
case "Glass_Pane": {
  const tintMat = faceFinish?.tint
    ? getMaterialForFace('Glass_Pane', faceFinish, activeTheme) as THREE.MeshPhysicalMaterial
    : undefined;
  return <GlassFace w={bW} h={bH} d={bD} isNS={isNS} glassMat={tintMat} />;
}
```

And for horizontal faces (floors/ceilings) with paint:
**Before** (line 1085):
```tsx
const panelMat = mSteel;
```

**After:**
```tsx
const panelMat = faceFinish?.paint || faceFinish?.material
  ? getMaterialForFace('Solid_Steel', faceFinish, activeTheme) as THREE.MeshStandardMaterial
  : mSteel;
```

For Window surfaces with frameColor:
**Before:**
```tsx
case "Window_Standard":
case "Window_Sill":
case "Window_Clerestory":
case "Window_Half": {
  const profile = WINDOW_PROFILES[surface];
  return <WindowFace w={bW} h={bH} d={bD} isNS={isNS} sillRatio={profile.sillRatio} headRatio={profile.headRatio} />;
}
```

**After** — modify `WindowFace` to accept an optional `frameMat` prop (similar to GlassFace's `glassMat`):
```tsx
case "Window_Standard":
case "Window_Sill":
case "Window_Clerestory":
case "Window_Half": {
  const profile = WINDOW_PROFILES[surface];
  const frameMat = faceFinish?.frameColor
    ? getMaterialForFace(surface, faceFinish, activeTheme) as THREE.MeshStandardMaterial
    : undefined;
  return <WindowFace w={bW} h={bH} d={bD} isNS={isNS} sillRatio={profile.sillRatio} headRatio={profile.headRatio} frameMat={frameMat} />;
}
```
Then update `WindowFace` to accept `frameMat?: THREE.MeshStandardMaterial` and use `frameMat ?? mFrame` for frame meshes inside the component.

For Door with doorStyle and frameColor:
**Before:**
```tsx
case "Door": return <DoorFace w={bW} h={bH} d={bD} isNS={isNS} isOpen={isOpen} doorState={doorState} doorConfig={doorConfig} />;
```

**After:**
```tsx
case "Door": {
  // doorStyle override from faceFinish (swing/sliding/barn)
  const effectiveDoorConfig = faceFinish?.doorStyle
    ? { ...doorConfig, type: faceFinish.doorStyle as 'swing' | 'sliding' | 'barn' }
    : doorConfig;
  // Frame/door color override
  const doorMat = faceFinish?.frameColor
    ? getMaterialForFace('Door', faceFinish, activeTheme) as THREE.MeshStandardMaterial
    : undefined;
  const doorEl = <DoorFace w={bW} h={bH} d={bD} isNS={isNS} isOpen={isOpen} doorState={doorState} doorConfig={effectiveDoorConfig} doorMat={doorMat} />;
  if (faceFinish?.electrical && faceFinish.electrical !== 'none') {
    return <>{doorEl}<ElectricalPlate type={faceFinish.electrical} dir={dir as 'n'|'s'|'e'|'w'} /></>;
  }
  return doorEl;
}
```
Then update `DoorFace` to accept `doorMat?: THREE.MeshStandardMaterial` and use `doorMat ?? mWood` for the door panel mesh.

**NOTE:** `activeTheme` is already available in the component scope — it's the theme state from the store. Find where `syncThemeMats` is called (the parent component passes theme). You may need to thread theme through SingleFace props or read it via `useStore((s) => s.theme)` in the parent and pass it down.

- [ ] **Step 5: Run TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Run all tests**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass (including existing ContainerSkin tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/objects/ContainerSkin.tsx
git commit -m "feat: wire getMaterialForFace into ContainerSkin rendering pipeline"
```

---

### Task 4: Inline Color Picker Component

**Files:**
- Create: `src/components/ui/ColorPicker.tsx`

- [ ] **Step 1: Create ColorPicker component**

```tsx
// src/components/ui/ColorPicker.tsx
"use client";

import { useState, useCallback, useRef, useEffect } from 'react';

interface ColorPickerProps {
  color: string;             // current hex color
  onChange: (hex: string) => void;
  onClose?: () => void;
}

export default function ColorPicker({ color, onChange, onClose }: ColorPickerProps) {
  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(100);
  const [val, setVal] = useState(100);
  const [hexInput, setHexInput] = useState(color);
  const satValRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingSV = useRef(false);
  const draggingH = useRef(false);

  // Parse incoming color to HSV on mount/change
  useEffect(() => {
    setHexInput(color);
    const [h, s, v] = hexToHsv(color);
    setHue(h);
    setSat(s);
    setVal(v);
  }, [color]);

  const emitColor = useCallback((h: number, s: number, v: number) => {
    const hex = hsvToHex(h, s, v);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const handleSVPointer = useCallback((e: React.PointerEvent | PointerEvent) => {
    const rect = satValRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const newSat = Math.round(x * 100);
    const newVal = Math.round((1 - y) * 100);
    setSat(newSat);
    setVal(newVal);
    emitColor(hue, newSat, newVal);
  }, [hue, emitColor]);

  const handleHuePointer = useCallback((e: React.PointerEvent | PointerEvent) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newHue = Math.round(x * 360);
    setHue(newHue);
    emitColor(newHue, sat, val);
  }, [sat, val, emitColor]);

  // Global pointer events for drag
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (draggingSV.current) handleSVPointer(e);
      if (draggingH.current) handleHuePointer(e);
    };
    const onUp = () => { draggingSV.current = false; draggingH.current = false; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [handleSVPointer, handleHuePointer]);

  const handleHexSubmit = () => {
    const clean = hexInput.startsWith('#') ? hexInput : '#' + hexInput;
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      onChange(clean);
      const [h, s, v] = hexToHsv(clean);
      setHue(h); setSat(s); setVal(v);
    }
  };

  return (
    <div style={{
      padding: '8px', background: 'var(--card-bg, #f1f5f9)',
      borderRadius: 8, border: '1px solid var(--border, #e2e8f0)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {/* Saturation/Value square */}
      <div
        ref={satValRef}
        onPointerDown={(e) => { draggingSV.current = true; handleSVPointer(e); }}
        style={{
          width: '100%', aspectRatio: '1', borderRadius: 4, cursor: 'crosshair',
          position: 'relative', overflow: 'hidden',
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`,
        }}
      >
        <div style={{
          position: 'absolute',
          left: `${sat}%`, top: `${100 - val}%`,
          width: 12, height: 12, borderRadius: '50%',
          border: '2px solid white', boxShadow: '0 0 2px rgba(0,0,0,0.5)',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        }} />
      </div>

      {/* Hue strip */}
      <div
        ref={hueRef}
        onPointerDown={(e) => { draggingH.current = true; handleHuePointer(e); }}
        style={{
          width: '100%', height: 14, borderRadius: 3, cursor: 'pointer',
          position: 'relative',
          background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        }}
      >
        <div style={{
          position: 'absolute',
          left: `${(hue / 360) * 100}%`, top: '50%',
          width: 10, height: 14, borderRadius: 2,
          border: '2px solid white', boxShadow: '0 0 2px rgba(0,0,0,0.5)',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
          background: `hsl(${hue}, 100%, 50%)`,
        }} />
      </div>

      {/* Hex input */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim, #64748b)' }}>Hex:</span>
        <input
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={handleHexSubmit}
          onKeyDown={(e) => { if (e.key === 'Enter') handleHexSubmit(); }}
          style={{
            flex: 1, fontSize: 11, padding: '2px 6px', borderRadius: 4,
            border: '1px solid var(--border, #e2e8f0)',
            background: 'var(--surface-alt, #fff)', color: 'var(--text-main, #374151)',
            fontFamily: 'monospace',
          }}
        />
        {onClose && (
          <button onClick={onClose} style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            border: '1px solid var(--border, #e2e8f0)', background: 'none',
            color: 'var(--text-dim, #64748b)', cursor: 'pointer',
          }}>Done</button>
        )}
      </div>
    </div>
  );
}

// ── HSV ↔ Hex helpers ──

function hexToHsv(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return [Math.round(h), Math.round(s), Math.round(v)];
}

function hsvToHex(h: number, s: number, v: number): string {
  const sn = s / 100, vn = v / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vn - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ColorPicker.tsx
git commit -m "feat: add inline ColorPicker component with HSV picker and hex input"
```

---

### Task 5: FinishesPanel Component

**Files:**
- Create: `src/components/ui/FinishesPanel.tsx`
- Create: `src/Testing/finishes-panel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/Testing/finishes-panel.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';
import { getFinishOptionsForFace } from '../config/finishPresets';

// Test the store integration that FinishesPanel relies on
function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

function addTestContainer() {
  return useStore.getState().addContainer('40ft_hc', { x: 0, y: 0, z: 0 });
}

describe('FinishesPanel store integration', () => {
  beforeEach(() => resetStore());

  it('setFaceFinish with paint updates voxel and adds recent item', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { paint: '#FF0000' });
    useStore.getState().addRecentItem({ type: 'finish', value: 'paint:#FF0000', label: 'Red Paint' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n?.paint).toBe('#FF0000');
    expect(useStore.getState().recentItems[0].value).toBe('paint:#FF0000');
  });

  it('setFaceFinish with material updates voxel', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { material: 'wood' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n?.material).toBe('wood');
  });

  it('setFaceFinish with electrical updates voxel', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { electrical: 'outlet' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n?.electrical).toBe('outlet');
  });

  it('setFaceFinish with light fixture on ceiling', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'top', { light: 'pendant', lightColor: 'warm' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.top?.light).toBe('pendant');
    expect(v.faceFinishes?.top?.lightColor).toBe('warm');
  });

  it('setFaceFinish with door style', () => {
    const id = addTestContainer();
    // First set the face to Door type
    useStore.getState().setVoxelFace(id, 9, 'n', 'Door');
    useStore.getState().setFaceFinish(id, 9, 'n', { doorStyle: 'barn' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n?.doorStyle).toBe('barn');
  });

  it('clearFaceFinish removes all finish data for face', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { paint: '#FF0000', electrical: 'outlet' });
    useStore.getState().clearFaceFinish(id, 9, 'n');
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes (store actions already exist)**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/finishes-panel.test.ts`
Expected: All 6 tests PASS (store actions from Plan A). If `setVoxelFace` fails, check the correct action name — it may be `paintFace`.

- [ ] **Step 3: Create FinishesPanel component**

```tsx
// src/components/ui/FinishesPanel.tsx
"use client";

import { useState, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { useSelectionTarget, type FaceKey } from '@/hooks/useSelectionTarget';
import {
  EXTERIOR_MATERIALS, PAINT_COLORS, GLASS_TINTS,
  FRAME_COLORS, DOOR_STYLES, LIGHT_FIXTURES, LIGHT_COLORS,
  ELECTRICAL_TYPES, FLOOR_MATERIALS, CEILING_MATERIALS,
  getFinishOptionsForFace,
  type MaterialPreset, type ColorPreset,
} from '@/config/finishPresets';
import type { FaceFinish, SurfaceType, VoxelFaces } from '@/types/container';
import ColorPicker from './ColorPicker';

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
  color: 'var(--text-dim, #64748b)', letterSpacing: '0.05em', marginBottom: 6,
};

const SECTION_STYLE: React.CSSProperties = { marginBottom: 12 };

export default function FinishesPanel() {
  const target = useSelectionTarget();
  const setFaceFinish = useStore((s) => s.setFaceFinish);
  const clearFaceFinish = useStore((s) => s.clearFaceFinish);
  const addRecentItem = useStore((s) => s.addRecentItem);
  const [colorPickerField, setColorPickerField] = useState<string | null>(null);

  // Derive containerId, voxelIndex, face from target
  let containerId = '';
  let voxelIndex = 0;
  let face: FaceKey | null = null;
  let indices: number[] = [];

  if (target.type === 'face') {
    containerId = target.containerId;
    voxelIndex = target.index;
    face = target.face;
    indices = [voxelIndex];
  } else if (target.type === 'bay-face') {
    containerId = target.containerId;
    voxelIndex = target.indices[0];
    face = target.face;
    indices = target.indices;
  }

  if (!face || !containerId) return null;

  // Read current voxel data via reactive selector (not getState — must re-render on change)
  const surface = useStore((s) => {
    const v = s.containers[containerId]?.voxelGrid?.[voxelIndex];
    return v?.faces[face!] as SurfaceType | undefined;
  });
  const currentFinish = useStore((s) => {
    const v = s.containers[containerId]?.voxelGrid?.[voxelIndex];
    return v?.faceFinishes?.[face!];
  });

  if (!surface) return null;
  const opts = getFinishOptionsForFace(surface, face);

  const applyFinish = (patch: Partial<FaceFinish>) => {
    for (const idx of indices) {
      setFaceFinish(containerId, idx, face!, patch);
    }
  };

  const clearAll = () => {
    for (const idx of indices) {
      clearFaceFinish(containerId, idx, face!);
    }
  };

  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{ ...LABEL_STYLE, fontSize: 11, marginBottom: 10 }}>
        {face.toUpperCase()} Face — {surface.replace(/_/g, ' ')}
      </div>

      {/* Exterior Material */}
      {opts.exteriorMaterial && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Exterior Material</div>
          <MaterialGrid
            items={EXTERIOR_MATERIALS}
            activeId={currentFinish?.material}
            onSelect={(id, label) => {
              applyFinish({ material: id });
              addRecentItem({ type: 'finish', value: `material:${id}`, label });
            }}
          />
        </div>
      )}

      {/* Interior Paint */}
      {opts.interiorPaint && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Interior Paint</div>
          <SwatchRow
            colors={PAINT_COLORS}
            activeHex={currentFinish?.paint}
            onSelect={(hex, label) => {
              applyFinish({ paint: hex });
              addRecentItem({ type: 'finish', value: `paint:${hex}`, label });
            }}
            onCustom={() => setColorPickerField('paint')}
          />
          {colorPickerField === 'paint' && (
            <ColorPicker
              color={currentFinish?.paint || '#FFFFFF'}
              onChange={(hex) => applyFinish({ paint: hex })}
              onClose={() => setColorPickerField(null)}
            />
          )}
        </div>
      )}

      {/* Glass Tint */}
      {opts.glassTint && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Glass Tint</div>
          <SwatchRow
            colors={GLASS_TINTS}
            activeHex={currentFinish?.tint}
            onSelect={(hex, label) => {
              applyFinish({ tint: hex });
              addRecentItem({ type: 'finish', value: `tint:${hex}`, label });
            }}
          />
        </div>
      )}

      {/* Frame Color */}
      {opts.frameColor && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Frame Color</div>
          <SwatchRow
            colors={FRAME_COLORS}
            activeHex={currentFinish?.frameColor}
            onSelect={(hex, label) => {
              applyFinish({ frameColor: hex });
              addRecentItem({ type: 'finish', value: `frame:${hex}`, label });
            }}
            onCustom={() => setColorPickerField('frameColor')}
          />
          {colorPickerField === 'frameColor' && (
            <ColorPicker
              color={currentFinish?.frameColor || '#1A1A1A'}
              onChange={(hex) => applyFinish({ frameColor: hex })}
              onClose={() => setColorPickerField(null)}
            />
          )}
        </div>
      )}

      {/* Door Style */}
      {opts.doorStyle && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Door Style</div>
          <MaterialGrid
            items={DOOR_STYLES}
            activeId={currentFinish?.doorStyle}
            onSelect={(id, label) => {
              applyFinish({ doorStyle: id });
              addRecentItem({ type: 'finish', value: `door:${id}`, label });
            }}
          />
        </div>
      )}

      {/* Floor Material */}
      {opts.floorMaterial && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Flooring Material</div>
          <MaterialGrid
            items={FLOOR_MATERIALS}
            activeId={currentFinish?.material}
            onSelect={(id, label) => {
              applyFinish({ material: id });
              addRecentItem({ type: 'finish', value: `floor:${id}`, label });
            }}
          />
        </div>
      )}

      {/* Ceiling Material */}
      {opts.ceilingMaterial && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Ceiling Material</div>
          <MaterialGrid
            items={CEILING_MATERIALS}
            activeId={currentFinish?.material}
            onSelect={(id, label) => {
              applyFinish({ material: id });
              addRecentItem({ type: 'finish', value: `ceil:${id}`, label });
            }}
          />
        </div>
      )}

      {/* Light Fixture */}
      {opts.lightFixture && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Lighting</div>
          <MaterialGrid
            items={LIGHT_FIXTURES}
            activeId={currentFinish?.light || 'none'}
            onSelect={(id, label) => {
              applyFinish({ light: id });
              addRecentItem({ type: 'finish', value: `light:${id}`, label });
            }}
          />
        </div>
      )}

      {/* Light Color (stores semantic key: 'warm'|'cool'|'daylight'|'amber') */}
      {opts.lightColor && currentFinish?.light && currentFinish.light !== 'none' && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Light Color</div>
          <MaterialGrid
            items={LIGHT_COLORS}
            activeId={currentFinish?.lightColor || 'warm'}
            onSelect={(id, label) => applyFinish({ lightColor: id })}
          />
        </div>
      )}

      {/* Electrical */}
      {opts.electrical && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Electrical</div>
          <MaterialGrid
            items={ELECTRICAL_TYPES}
            activeId={currentFinish?.electrical || 'none'}
            onSelect={(id, label) => {
              applyFinish({ electrical: id });
              addRecentItem({ type: 'finish', value: `elec:${id}`, label });
            }}
          />
        </div>
      )}

      {/* Clear all finishes */}
      {currentFinish && (
        <button
          onClick={clearAll}
          style={{
            width: '100%', padding: '6px', borderRadius: 6, fontSize: 10, fontWeight: 600,
            border: '1px solid var(--border, #e2e8f0)', background: 'none',
            color: 'var(--text-dim, #64748b)', cursor: 'pointer',
            marginTop: 4,
          }}
        >
          Reset to Theme Default
        </button>
      )}
    </div>
  );
}

// ── Sub-components ──

function MaterialGrid({ items, activeId, onSelect }: {
  items: MaterialPreset[];
  activeId?: string;
  onSelect: (id: string, label: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id, item.label)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '6px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 9,
            border: `2px solid ${activeId === item.id ? 'var(--accent, #3b82f6)' : 'var(--border, #e2e8f0)'}`,
            background: activeId === item.id ? 'var(--accent-bg, rgba(59,130,246,0.08))' : 'var(--card-bg, #f1f5f9)',
            color: 'var(--text-main, #374151)',
            transition: 'border-color 100ms',
          }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: 4,
            background: item.color, border: '1px solid rgba(0,0,0,0.1)',
          }} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function SwatchRow({ colors, activeHex, onSelect, onCustom }: {
  colors: ColorPreset[];
  activeHex?: string;
  onSelect: (hex: string, label: string) => void;
  onCustom?: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {colors.map((c) => (
        <button
          key={c.hex}
          onClick={() => onSelect(c.hex, c.label)}
          title={c.label}
          style={{
            width: 24, height: 24, borderRadius: 4, cursor: 'pointer',
            background: c.hex,
            border: `2px solid ${activeHex === c.hex ? 'var(--accent, #3b82f6)' : 'rgba(0,0,0,0.15)'}`,
            padding: 0,
          }}
        />
      ))}
      {onCustom && (
        <button
          onClick={onCustom}
          title="Custom color"
          style={{
            width: 24, height: 24, borderRadius: 4, cursor: 'pointer',
            background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
            border: '2px solid var(--border, #e2e8f0)', padding: 0,
            fontSize: 12, color: '#fff', fontWeight: 700, textShadow: '0 0 2px rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          +
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/FinishesPanel.tsx src/Testing/finishes-panel.test.ts
git commit -m "feat: add FinishesPanel with contextual material/paint/tint/electrical UI"
```

---

### Task 6: Wire FinishesPanel into Sidebar

**Files:**
- Modify: `src/components/ui/Sidebar.tsx`

- [ ] **Step 1: Replace the Plan B stub with FinishesPanel**

In `src/components/ui/Sidebar.tsx`, find the stub (around line 534-543):

```tsx
) : (target.type === "face" || target.type === "bay-face") ? (
  <div style={{ padding: "12px", color: "#94a3b8", fontSize: 12 }}>
    <div style={{ fontWeight: 600, marginBottom: 8, textTransform: "uppercase", fontSize: 10 }}>
      Finishes
    </div>
    <p>Face finish options coming soon.</p>
    <p style={{ fontSize: 11 }}>
      Selected: {target.face} face
    </p>
  </div>
```

Replace with:

```tsx
) : (target.type === "face" || target.type === "bay-face") ? (
  <FinishesPanel />
```

Add the import at the top of Sidebar.tsx:

```ts
import FinishesPanel from "@/components/ui/FinishesPanel";
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Run all tests**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Sidebar.tsx
git commit -m "feat: wire FinishesPanel into sidebar contextual area"
```

---

### Task 7: Light Fixture Meshes

**Files:**
- Create: `src/components/objects/LightFixture.tsx`
- Create: `src/Testing/light-fixture.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/Testing/light-fixture.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

function addTestContainer() {
  return useStore.getState().addContainer('40ft_hc', { x: 0, y: 0, z: 0 });
}

describe('Light fixture integration', () => {
  beforeEach(() => resetStore());

  it('setting light fixture stores the value on top face finish', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'top', { light: 'pendant' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.top?.light).toBe('pendant');
  });

  it('setting light color stores the value', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'top', { light: 'flush', lightColor: 'warm' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.top?.lightColor).toBe('warm');
  });

  it('clearing finish removes light fixture', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'top', { light: 'track' });
    useStore.getState().clearFaceFinish(id, 9, 'top');
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.top).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test — should pass (store actions exist)**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/light-fixture.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 3: Create LightFixture component**

```tsx
// src/components/objects/LightFixture.tsx
"use client";

import * as THREE from 'three';
import { useMemo } from 'react';
import type { FaceFinish } from '../../types/container';

const LIGHT_MAT = new THREE.MeshStandardMaterial({
  color: 0xf5f5f0, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide,
});
const METAL_MAT = new THREE.MeshStandardMaterial({
  color: 0x404040, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide,
});
const BULB_MAT = new THREE.MeshStandardMaterial({
  color: 0xfff8e7, emissive: 0xfff8e7, emissiveIntensity: 0.8,
});

const LIGHT_COLOR_MAP: Record<string, string> = {
  warm: '#FFE4B5',
  cool: '#F0F8FF',
  daylight: '#FFFFF0',
  amber: '#FFBF00',
};

// Shared geometries (module singletons)
const _pendantCylinder = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8);
const _pendantCone = new THREE.ConeGeometry(0.12, 0.1, 12, 1, true);
const _flushDisc = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 16);
const _trackRail = new THREE.BoxGeometry(0.6, 0.02, 0.03);
const _spotCone = new THREE.ConeGeometry(0.04, 0.06, 8);
const _recessedRing = new THREE.TorusGeometry(0.08, 0.015, 8, 24);
const _bulbSphere = new THREE.SphereGeometry(0.03, 8, 8);

interface LightFixtureProps {
  type: string;         // 'pendant' | 'flush' | 'track' | 'recessed'
  lightColor?: string;  // 'warm' | 'cool' | 'daylight' | 'amber'
  colPitch: number;
  rowPitch: number;
  vHeight: number;
}

export default function LightFixture({ type, lightColor, colPitch, rowPitch, vHeight }: LightFixtureProps) {
  const color = LIGHT_COLOR_MAP[lightColor || 'warm'] || '#FFE4B5';
  const intensity = 2.0;

  // Hanging offset from ceiling center (top face is at +vOffset)
  const ceilingY = 0; // relative to face group position (already at ceiling)

  switch (type) {
    case 'pendant':
      return (
        <group position={[0, ceilingY, 0]}>
          {/* Cord */}
          <mesh geometry={_pendantCylinder} material={METAL_MAT} position={[0, -0.075, 0]} raycast={() => {}} />
          {/* Shade */}
          <mesh geometry={_pendantCone} material={LIGHT_MAT} position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]} raycast={() => {}} />
          {/* Bulb */}
          <mesh geometry={_bulbSphere} material={BULB_MAT} position={[0, -0.18, 0]} raycast={() => {}} />
          {/* Light */}
          <pointLight color={color} intensity={intensity} distance={vHeight * 2} position={[0, -0.2, 0]} />
        </group>
      );

    case 'flush':
      return (
        <group position={[0, ceilingY, 0]}>
          {/* Flush disc on ceiling */}
          <mesh geometry={_flushDisc} material={LIGHT_MAT} position={[0, -0.015, 0]} raycast={() => {}} />
          <pointLight color={color} intensity={intensity * 0.8} distance={vHeight * 1.5} position={[0, -0.05, 0]} />
        </group>
      );

    case 'track':
      return (
        <group position={[0, ceilingY, 0]}>
          {/* Rail */}
          <mesh geometry={_trackRail} material={METAL_MAT} position={[0, -0.01, 0]} raycast={() => {}} />
          {/* 3 spot cones along the rail */}
          {[-0.2, 0, 0.2].map((x, i) => (
            <group key={i} position={[x, -0.04, 0]}>
              <mesh geometry={_spotCone} material={METAL_MAT} rotation={[0, 0, 0]} raycast={() => {}} />
              <pointLight color={color} intensity={intensity * 0.6} distance={vHeight * 2} position={[0, -0.06, 0]} />
            </group>
          ))}
        </group>
      );

    case 'recessed':
      return (
        <group position={[0, ceilingY, 0]}>
          {/* Recessed ring */}
          <mesh geometry={_recessedRing} material={METAL_MAT} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => {}} />
          <pointLight color={color} intensity={intensity * 0.7} distance={vHeight * 1.5} position={[0, -0.02, 0]} />
        </group>
      );

    default:
      return null;
  }
}
```

- [ ] **Step 4: Wire LightFixture into ContainerSkin's renderVisual()**

In `SingleFace.renderVisual()`, after the ceiling/top face rendering block (around line 1082-1094), add light fixture rendering:

When the face is `top` and `faceFinish?.light` exists and is not `'none'`:

```tsx
// Inside renderVisual(), after the ceiling panel mesh for isHoriz && dir === 'top':
{faceFinish?.light && faceFinish.light !== 'none' && dir === 'top' && (
  <LightFixture
    type={faceFinish.light}
    lightColor={faceFinish.lightColor}
    colPitch={colPitch}
    rowPitch={rowPitch}
    vHeight={vHeight}
  />
)}
```

Import at top of ContainerSkin.tsx:
```ts
import LightFixture from './LightFixture';
```

**Implementation note:** The `renderVisual()` function currently returns a single JSX element. To add LightFixture alongside the ceiling mesh, wrap them in a fragment:

```tsx
if (isHoriz) {
  // ... existing floor/ceiling rendering ...
  const ceilingMesh = <mesh geometry={...} material={panelMat} ... />;
  if (dir === 'top' && faceFinish?.light && faceFinish.light !== 'none') {
    return (
      <>
        {ceilingMesh}
        <LightFixture type={faceFinish.light} lightColor={faceFinish.lightColor}
          colPitch={colPitch} rowPitch={rowPitch} vHeight={vHeight} />
      </>
    );
  }
  return ceilingMesh;
}
```

- [ ] **Step 5: Run TypeScript check + tests**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/objects/LightFixture.tsx src/Testing/light-fixture.test.ts src/components/objects/ContainerSkin.tsx
git commit -m "feat: add procedural light fixture meshes (pendant/flush/track/recessed)"
```

---

### Task 8: Electrical Plate Meshes

**Files:**
- Create: `src/components/objects/ElectricalPlate.tsx`

- [ ] **Step 1: Create ElectricalPlate component**

```tsx
// src/components/objects/ElectricalPlate.tsx
"use client";

import * as THREE from 'three';

const PLATE_MAT = new THREE.MeshStandardMaterial({
  color: 0xf5f5f5, metalness: 0.0, roughness: 0.6, side: THREE.DoubleSide,
});
const SLOT_MAT = new THREE.MeshStandardMaterial({
  color: 0x2a2a2e, metalness: 0.3, roughness: 0.5,
});

// Shared geometries
const _plate = new THREE.BoxGeometry(0.07, 0.11, 0.005);
const _switchSlot = new THREE.BoxGeometry(0.015, 0.04, 0.003);
const _outletSlot = new THREE.CylinderGeometry(0.008, 0.008, 0.003, 8);
const _dimmerKnob = new THREE.CylinderGeometry(0.015, 0.015, 0.006, 12);

interface ElectricalPlateProps {
  type: string;   // 'switch' | 'double_switch' | 'outlet' | 'dimmer'
  dir: 'n' | 's' | 'e' | 'w';  // face direction for proper Z-axis offset
}

export default function ElectricalPlate({ type, dir }: ElectricalPlateProps) {
  // Position: lower third of wall, centered horizontally
  // The parent SingleFace <group> is already positioned at the face location.
  // Electrical plates need to protrude slightly from the wall surface.
  // N/S faces: wall plane is in XY, thin in Z → offset along Z
  // E/W faces: wall plane is in YZ, thin in X → offset along X
  const isNS = dir === 'n' || dir === 's';
  const sign = (dir === 's' || dir === 'e') ? 1 : -1; // outward direction
  const offset = 0.01 * sign;

  // Position offset: protrude from wall in the correct axis
  const px = isNS ? 0 : offset;
  const pz = isNS ? offset : 0;
  const detailOffset = isNS ? [0, 0, 0.003 * sign] : [0.003 * sign, 0, 0];

  return (
    <group position={[px, -0.3, pz]}>
      {/* Base plate */}
      <mesh geometry={_plate} material={PLATE_MAT} raycast={() => {}}
        rotation={isNS ? [0, 0, 0] : [0, Math.PI / 2, 0]} />

      {/* Type-specific details */}
      {type === 'switch' && (
        <mesh geometry={_switchSlot} material={SLOT_MAT} position={detailOffset as any}
          rotation={isNS ? [0, 0, 0] : [0, Math.PI / 2, 0]} raycast={() => {}} />
      )}
      {type === 'double_switch' && (
        <>
          <mesh geometry={_switchSlot} material={SLOT_MAT}
            position={[detailOffset[0], 0.02 + detailOffset[1], detailOffset[2]] as any}
            rotation={isNS ? [0, 0, 0] : [0, Math.PI / 2, 0]} raycast={() => {}} />
          <mesh geometry={_switchSlot} material={SLOT_MAT}
            position={[detailOffset[0], -0.02 + detailOffset[1], detailOffset[2]] as any}
            rotation={isNS ? [0, 0, 0] : [0, Math.PI / 2, 0]} raycast={() => {}} />
        </>
      )}
      {type === 'outlet' && (
        <>
          <mesh geometry={_outletSlot} material={SLOT_MAT}
            position={[isNS ? -0.012 : detailOffset[0], 0.015, isNS ? detailOffset[2] : -0.012] as any}
            rotation={[Math.PI / 2, 0, 0]} raycast={() => {}} />
          <mesh geometry={_outletSlot} material={SLOT_MAT}
            position={[isNS ? 0.012 : detailOffset[0], 0.015, isNS ? detailOffset[2] : 0.012] as any}
            rotation={[Math.PI / 2, 0, 0]} raycast={() => {}} />
          <mesh geometry={_outletSlot} material={SLOT_MAT}
            position={[isNS ? 0 : detailOffset[0], -0.01, isNS ? detailOffset[2] : 0] as any}
            rotation={[Math.PI / 2, 0, 0]} raycast={() => {}} />
        </>
      )}
      {type === 'dimmer' && (
        <mesh geometry={_dimmerKnob} material={SLOT_MAT}
          position={detailOffset as any}
          rotation={[Math.PI / 2, 0, 0]} raycast={() => {}} />
      )}
    </group>
  );
}
```

- [ ] **Step 2: Wire ElectricalPlate into ContainerSkin**

In `SingleFace.renderVisual()`, for wall faces (n/s/e/w), add electrical plate rendering when `faceFinish?.electrical` is set and not `'none'`:

```tsx
// At the END of renderVisual() for wall surfaces, before the final return:
// Wrap the surface mesh + electrical plate in a fragment

// Example for Solid_Steel case:
case "Solid_Steel": {
  const wallMesh = (faceFinish?.paint || faceFinish?.material)
    ? <mesh geometry={getBox(bW, bH, bD)} material={getMaterialForFace('Solid_Steel', faceFinish, activeTheme)} castShadow receiveShadow raycast={nullRaycast} />
    : <SteelFace w={bW} h={bH} d={bD} />;
  if (faceFinish?.electrical && faceFinish.electrical !== 'none') {
    return <>{wallMesh}<ElectricalPlate type={faceFinish.electrical} dir={dir as 'n'|'s'|'e'|'w'} /></>;
  }
  return wallMesh;
}
```

Apply the same pattern to other wall surface types that support electrical (Glass_Pane with frame, Door, etc.). For surfaces where electrical doesn't make visual sense (railings, open), skip it.

Import at top:
```ts
import ElectricalPlate from './ElectricalPlate';
```

- [ ] **Step 3: Run TypeScript check + tests**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/objects/ElectricalPlate.tsx src/components/objects/ContainerSkin.tsx
git commit -m "feat: add procedural electrical plate meshes (switch/outlet/dimmer)"
```

---

### Task 9: Integration Verification

**Files:** No new files — verification only.

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Run full test suite**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass (503+ tests).

- [ ] **Step 3: Start dev server and verify in browser**

Start: `npm run dev`

Verify:
- [ ] Select a voxel → Wall Type picker appears (Plan A, unchanged)
- [ ] Select a wall face (click edge strip) → FinishesPanel shows with Exterior Material, Interior Paint, Electrical sections
- [ ] Click a paint color → wall color changes in 3D immediately
- [ ] Click [+] on paint row → inline color picker opens with hue strip + saturation square
- [ ] Select custom color → wall updates in real time
- [ ] Click "Done" on color picker → picker closes
- [ ] Select a window face → FinishesPanel shows Frame Color and Glass Tint sections
- [ ] Change glass tint to Smoke → glass darkens in 3D
- [ ] Select a door face → Door Style section shows (Swing/Sliding/Barn)
- [ ] Select a ceiling face → Lighting and Light Color sections appear
- [ ] Select "Pendant" light → small fixture mesh appears hanging from ceiling
- [ ] Select an electrical type (Switch) → small plate mesh appears on wall
- [ ] Click "Reset to Theme Default" → finish clears, wall returns to theme material
- [ ] Recent items bar shows finish actions as they're applied
- [ ] Undo (Ctrl+Z) reverts finish changes
- [ ] BOM bar still visible and functional

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix: Plan B integration fixes"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|---------------|
| 1 | Finish presets catalog | 2 (finishPresets.ts, test) | 0 |
| 2 | getMaterialForFace resolver | 1 (test) | 1 (materialCache.ts) |
| 3 | Wire into ContainerSkin rendering | 0 | 1 (ContainerSkin.tsx) |
| 4 | Inline ColorPicker | 1 (ColorPicker.tsx) | 0 |
| 5 | FinishesPanel component | 2 (FinishesPanel.tsx, test) | 0 |
| 6 | Wire FinishesPanel into Sidebar | 0 | 1 (Sidebar.tsx) |
| 7 | Light fixture meshes | 2 (LightFixture.tsx, test) | 1 (ContainerSkin.tsx) |
| 8 | Electrical plate meshes | 1 (ElectricalPlate.tsx) | 1 (ContainerSkin.tsx) |
| 9 | Integration verification | 0 | 0 |

**Total new files:** 9
**Total modified files:** 4 (materialCache.ts, ContainerSkin.tsx, Sidebar.tsx, plus minor imports)
