# Unified Placeable Object System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace face-property doors/windows/lights with a unified Form+Skin placeable object system featuring catalog browsing, click-to-place, and per-instance material customization.

**Architecture:** Top-level `sceneObjects: Record<string, SceneObject>` in the Zustand store, keyed by UUID. Static registries for forms, styles, and materials (not in store). SceneObjectRenderer replaces per-type rendering. Dual-panel UI: bottom bar for Form catalog, left panel for Skin editor.

**Tech Stack:** React 19, TypeScript, Zustand 5 + immer + zundo + persist (idb-keyval), Zod 4, @react-three/fiber v9, @react-three/drei v10, Three.js

**Spec:** `docs/superpowers/specs/2026-03-22-doors-windows-lights-design.md`

---

## File Structure

### New Files

```
src/types/sceneObject.ts              — All type definitions (SceneObject, FormDefinition, StyleDefinition, etc.)
src/config/materialRegistry.ts        — MaterialOption[] catalog (~45 materials)
src/config/styleRegistry.ts           — StyleDefinition[] catalog (17 styles) + QuickSkinPreset[]
src/config/formRegistry.ts            — FormDefinition registry + query helpers
src/config/forms/doors.ts             — 8 door FormDefinitions
src/config/forms/windows.ts           — 7 window FormDefinitions
src/config/forms/lights.ts            — 8 light FormDefinitions
src/config/forms/electrical.ts        — 4 electrical FormDefinitions
src/store/slices/sceneObjectSlice.ts  — Store slice (actions + selectors)
src/utils/slotOccupancy.ts            — Sub-face slot math (validation, collision)
src/utils/skinResolver.ts             — Resolve skin overrides against style defaults
src/utils/migration/migrateToSceneObjects.ts — One-time hydration migration
src/components/objects/SceneObjectRenderer.tsx — Unified 3D renderer
src/components/objects/PlacementGhost.tsx      — Ghost preview during placement
src/components/ui/FormCatalog.tsx      — Bottom bar Form catalog
src/components/ui/SkinEditor.tsx       — Left panel Skin customization
src/__tests__/form-registry.test.ts
src/__tests__/scene-object-slice.test.ts
src/__tests__/slot-occupancy.test.ts
src/__tests__/skin-resolver.test.ts
src/__tests__/placement-flow.test.ts
```

### Modified Files

```
src/types/container.ts                — Add activeStyle to AppState, deprecate FaceFinish/LightPlacement
src/store/useStore.ts                 — Add sceneObjectSlice, update partialize (temporal + persist), add schemaVersion
src/store/persistSchema.ts            — Add sceneObjectSchema, schemaVersion field
src/store/slices/containerSlice.ts    — removeContainer cascades removeObjectsByContainer; extend getEstimate()
src/store/slices/uiSlice.ts           — Add placementMode, activePlacementFormId, activeStyle (replaces currentTheme)
src/config/themes.ts                  — Retain for backward compat; add THEME_TO_STYLE_MAP
src/config/materialCache.ts           — Read from StyleDefinition.defaultMaterials (new path)
src/components/three/Scene.tsx        — Mount SceneObjectRenderer
src/components/objects/ContainerSkin.tsx — Skip fully-occupied faces (slotWidth=3 check)
src/components/ui/LiveBOM.tsx         — Add scene object costs
src/components/ui/Sidebar.tsx         — Context-sensitive SkinEditor integration
src/components/ui/BottomDock.tsx      — Mount FormCatalog
```

---

## Task Dependency Graph

```
Task 1 (Types) ─────────────────────────────────┐
Task 2 (Materials) ──┐                          │
Task 3 (Styles) ─────┼── Task 5 (Form Registry) │
Task 4a-d (Forms) ───┘                          │
                                                 │
Task 1 ──── Task 6 (Slot Occupancy) ────────────┤
Task 1 ──── Task 7 (Skin Resolver) ────────────┤
                                                 │
Task 1 + 5 + 6 + 7 ── Task 8 (Store Slice) ────┤
Task 8 ──── Task 9 (Store Integration) ─────────┤
Task 9 ──── Task 10 (Migration) ────────────────┤
                                                 │
Task 8 ──── Task 11 (SceneObjectRenderer) ──────┤
Task 11 ─── Task 12 (PlacementGhost) ───────────┤
Task 11 ─── Task 13 (Wall Coordination) ────────┤
                                                 │
Task 8 ──── Task 14 (FormCatalog UI) ───────────┤
Task 8 ──── Task 15 (SkinEditor UI) ────────────┤
Task 14+15─ Task 16 (Placement Flow Wiring) ────┤
                                                 │
Task 8 ──── Task 17 (BOM Integration) ──────────┤
Task 9 ──── Task 18 (Theme→Style Migration) ────┘
```

**Parallelizable groups:**
- Tasks 1-4 (types + config data) — all independent
- Tasks 6, 7 (utils) — independent of each other, depend only on Task 1
- Tasks 14, 15 (UI panels) — independent of each other, depend on Task 8

---

## Task 1: Core Type Definitions

**Files:**
- Create: `src/types/sceneObject.ts`
- Test: `src/__tests__/scene-object-types.test.ts` (compile-time verification)

- [ ] **Step 1: Write the type definition file**

```typescript
// src/types/sceneObject.ts

// --- Enums & Unions ---

export type FormCategory = 'door' | 'window' | 'light' | 'electrical';
export type AnchorType = 'face' | 'floor' | 'ceiling';
export type WallDirection = 'n' | 's' | 'e' | 'w';

export type StyleId =
  | 'modern' | 'industrial' | 'japanese' | 'desert_brutalist'
  | 'coastal' | 'noir_glass' | 'solarpunk' | 'frontier_rustic'
  | 'retro_capsule' | 'neo_tropical' | 'cyberpunk' | 'maker_raw'
  | 'art_deco' | 'arctic_bunker' | 'terra_adobe' | 'memphis_pop'
  | 'stealth';

export type StyleEffectType =
  | 'patina_tint' | 'paper_glow' | 'heat_shimmer' | 'salt_frost'
  | 'reflection_tint' | 'moss_glow' | 'ember_warmth' | 'soft_bloom'
  | 'dappled_light' | 'edge_glow' | 'layer_lines' | 'gold_gleam'
  | 'frost_rim' | 'clay_warmth' | 'color_punch' | 'matte_absorb';

// --- Form Definition (static catalog data) ---

export interface SkinSlot {
  id: string;
  label: string;
  materialOptions: string[];
}

export interface FormConstraints {
  requiresExteriorFace?: boolean;
  minClearanceBelow?: number;
  incompatibleWith?: string[];
}

export interface FormDefinition {
  id: string;
  category: FormCategory;
  name: string;
  description: string;
  styles: StyleId[];
  anchorType: AnchorType;
  slotWidth: 1 | 2 | 3;
  dimensions: { w: number; h: number; d: number };
  skinSlots: SkinSlot[];
  defaultSkin: Record<string, string>;
  geometry: 'procedural' | 'glb';
  glbPath?: string;
  costEstimate: number;
  constraints?: FormConstraints;
}

// --- Scene Object (placed instance, stored in Zustand) ---

export interface ObjectAnchor {
  containerId: string;
  voxelIndex: number;
  type: AnchorType;
  face?: WallDirection;
  slot?: number;
  offset?: [number, number];
}

export interface SceneObject {
  id: string;
  formId: string;
  skin: Record<string, string>;
  anchor: ObjectAnchor;
  state?: Record<string, unknown>;
}

// --- Style Definition (static catalog data) ---

export interface StyleEffect {
  type: StyleEffectType;
  targets?: string[];
  color?: string;
  intensity?: number;
}

export interface StyleDefinition {
  id: StyleId;
  label: string;
  description: string;
  defaultMaterials: Record<string, string>;
  defaultWallSurface: string; // SurfaceType string
  effects: StyleEffect[];
}

// --- Material Option (static catalog data) ---

export interface MaterialOption {
  id: string;
  label: string;
  color: string;
  metalness: number;
  roughness: number;
  applicableTo: string[];
}

// --- Quick Skin Preset ---

export interface QuickSkinPreset {
  id: string;
  styleId: StyleId;
  label: string;
  slots: Record<string, string>;
}
```

- [ ] **Step 2: Write compile-time verification test**

```typescript
// src/__tests__/scene-object-types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  FormDefinition, SceneObject, ObjectAnchor, StyleDefinition,
  MaterialOption, FormCategory, AnchorType, WallDirection,
  StyleId, StyleEffectType, QuickSkinPreset,
} from '@/types/sceneObject';

describe('SceneObject type definitions', () => {
  it('SceneObject can be constructed with all required fields', () => {
    const obj: SceneObject = {
      id: 'test-1',
      formId: 'door_single_swing',
      skin: { frame: 'matte_black' },
      anchor: {
        containerId: 'c-1',
        voxelIndex: 12,
        type: 'face',
        face: 'n',
        slot: 1,
      },
    };
    expect(obj.id).toBe('test-1');
    expect(obj.anchor.face).toBe('n');
  });

  it('FormDefinition can be constructed with all required fields', () => {
    const form: FormDefinition = {
      id: 'door_test',
      category: 'door',
      name: 'Test Door',
      description: 'A test door',
      styles: ['industrial', 'modern'],
      anchorType: 'face',
      slotWidth: 2,
      dimensions: { w: 1.0, h: 2.1, d: 0.1 },
      skinSlots: [{ id: 'frame', label: 'Frame', materialOptions: ['matte_black'] }],
      defaultSkin: { frame: 'matte_black' },
      geometry: 'procedural',
      costEstimate: 800,
    };
    expect(form.category).toBe('door');
    expect(form.slotWidth).toBe(2);
  });

  it('WallDirection only allows n/s/e/w', () => {
    const dirs: WallDirection[] = ['n', 's', 'e', 'w'];
    expect(dirs).toHaveLength(4);
  });

  it('ObjectAnchor floor type has optional offset', () => {
    const anchor: ObjectAnchor = {
      containerId: 'c-1',
      voxelIndex: 5,
      type: 'floor',
      offset: [0.5, 0.3],
    };
    expect(anchor.type).toBe('floor');
    expect(anchor.offset).toEqual([0.5, 0.3]);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd C:/MHome/MContainer && npx vitest run src/__tests__/scene-object-types.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 4: Run tsc**

Run: `cd C:/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/types/sceneObject.ts src/__tests__/scene-object-types.test.ts
git commit -m "feat: add SceneObject type definitions for unified placeable object system"
```

---

## Task 2: Material Registry

**Files:**
- Create: `src/config/materialRegistry.ts`
- Test: `src/__tests__/material-registry.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/material-registry.test.ts
import { describe, it, expect } from 'vitest';
import { materialRegistry, getMaterial } from '@/config/materialRegistry';

describe('Material Registry', () => {
  it('contains at least 40 materials', () => {
    expect(materialRegistry.size).toBeGreaterThanOrEqual(40);
  });

  it('every material has valid color (hex string), metalness, roughness', () => {
    for (const [id, mat] of materialRegistry) {
      expect(mat.id).toBe(id);
      expect(mat.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(mat.metalness).toBeGreaterThanOrEqual(0);
      expect(mat.metalness).toBeLessThanOrEqual(1);
      expect(mat.roughness).toBeGreaterThanOrEqual(0);
      expect(mat.roughness).toBeLessThanOrEqual(1);
      expect(mat.applicableTo.length).toBeGreaterThan(0);
    }
  });

  it('getMaterial returns undefined for unknown ID', () => {
    expect(getMaterial('nonexistent')).toBeUndefined();
  });

  it('getMaterial returns correct material by ID', () => {
    const steel = getMaterial('raw_steel');
    expect(steel).toBeDefined();
    expect(steel!.label).toBe('Raw Steel');
    expect(steel!.metalness).toBeGreaterThan(0.5);
  });

  it('no duplicate material IDs', () => {
    const ids = [...materialRegistry.keys()];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/MHome/MContainer && npx vitest run src/__tests__/material-registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement materialRegistry.ts**

Create `src/config/materialRegistry.ts` with all ~45 materials from the spec (metals, woods, glass, mineral, textile, synthetic). Each material:
```typescript
import type { MaterialOption } from '@/types/sceneObject';

const MATERIALS: MaterialOption[] = [
  // Metals
  { id: 'raw_steel', label: 'Raw Steel', color: '#8a8a8a', metalness: 0.85, roughness: 0.45, applicableTo: ['frame', 'track', 'plate', 'fixture', 'housing'] },
  { id: 'brushed_aluminum', label: 'Brushed Aluminum', color: '#c0c0c0', metalness: 0.9, roughness: 0.35, applicableTo: ['frame', 'track', 'trim', 'plate'] },
  { id: 'matte_black', label: 'Matte Black', color: '#1a1a1a', metalness: 0.1, roughness: 0.85, applicableTo: ['frame', 'handle', 'track', 'plate', 'fixture', 'housing', 'trim'] },
  // ... all 45 materials following the spec's material list
  // Full list: raw_steel, brushed_aluminum, matte_black, gunmetal, polished_chrome,
  // dark_chrome, oxidized_copper, blackened_brass, wrought_iron, anodized_aluminum,
  // carbon_fiber, polished_brass, titanium_grey, diamond_plate, cerakote_dark_earth,
  // light_oak, warm_oak, walnut, hinoki_cypress, bleached_wood, reclaimed_barn,
  // dark_teak, laser_cut_plywood, bamboo_composite, mesquite_wood,
  // clear_glass, frosted_glass, smoked_glass, bronze_tint, sea_glass,
  // neon_edge_acrylic, fluted_glass, frosted_polycarbonate,
  // concrete_grey, raw_concrete, terracotta, cork, sand_blasted_steel,
  // sun_baked_clay, marble_composite, terrazzo, ceramic_tile,
  // rice_paper_washi, woven_rattan, palm_fiber, leather, ballistic_nylon,
  // white_laminate, black_lacquer, powder_coat_white, powder_coat_sage,
  // powder_coat_coral, powder_coat_sky, powder_coat_mustard, powder_coat_blush,
  // pla_white, pla_grey, pla_black, painted_white, painted_sage,
  // matte_od_green, pastel_steel
];

export const materialRegistry: Map<string, MaterialOption> = new Map(
  MATERIALS.map(m => [m.id, m])
);

export function getMaterial(id: string): MaterialOption | undefined {
  return materialRegistry.get(id);
}
```

- [ ] **Step 4: Run tests**

Run: `cd C:/MHome/MContainer && npx vitest run src/__tests__/material-registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/materialRegistry.ts src/__tests__/material-registry.test.ts
git commit -m "feat: add material registry with ~45 materials for Form+Skin system"
```

---

## Task 3: Style Registry

**Files:**
- Create: `src/config/styleRegistry.ts`
- Test: `src/__tests__/style-registry.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/style-registry.test.ts
import { describe, it, expect } from 'vitest';
import { styleRegistry, getStyle, getQuickSkins } from '@/config/styleRegistry';
import { materialRegistry } from '@/config/materialRegistry';
import type { StyleId } from '@/types/sceneObject';

describe('Style Registry', () => {
  it('contains exactly 17 styles', () => {
    expect(styleRegistry.size).toBe(17);
  });

  it('every style has defaultMaterials for common slots (frame, glass, panel)', () => {
    for (const [, style] of styleRegistry) {
      expect(style.defaultMaterials).toHaveProperty('frame');
      expect(style.defaultMaterials).toHaveProperty('glass');
    }
  });

  it('every defaultMaterial references a valid material in materialRegistry', () => {
    for (const [, style] of styleRegistry) {
      for (const [, matId] of Object.entries(style.defaultMaterials)) {
        expect(materialRegistry.has(matId)).toBe(true);
      }
    }
  });

  it('every effect has a valid StyleEffectType', () => {
    const validTypes = new Set([
      'patina_tint', 'paper_glow', 'heat_shimmer', 'salt_frost',
      'reflection_tint', 'moss_glow', 'ember_warmth', 'soft_bloom',
      'dappled_light', 'edge_glow', 'layer_lines', 'gold_gleam',
      'frost_rim', 'clay_warmth', 'color_punch', 'matte_absorb',
    ]);
    for (const [, style] of styleRegistry) {
      for (const effect of style.effects) {
        expect(validTypes.has(effect.type)).toBe(true);
      }
    }
  });

  it('getStyle returns undefined for unknown ID', () => {
    expect(getStyle('nonexistent' as StyleId)).toBeUndefined();
  });

  it('getQuickSkins returns 5 presets per style for industrial', () => {
    const skins = getQuickSkins('industrial');
    expect(skins.length).toBe(5);
    for (const skin of skins) {
      expect(skin.styleId).toBe('industrial');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/MHome/MContainer && npx vitest run src/__tests__/style-registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement styleRegistry.ts**

Create `src/config/styleRegistry.ts` with all 17 styles from the spec. Each style defines `id`, `label`, `description`, `defaultMaterials`, `defaultWallSurface`, `effects`. Also define 5 `QuickSkinPreset` entries per style (total 85 presets).

Key implementation detail: the `defaultMaterials` map uses material IDs from `materialRegistry`. Effects use `StyleEffectType` union values.

```typescript
import type { StyleDefinition, QuickSkinPreset, StyleId } from '@/types/sceneObject';

const STYLES: StyleDefinition[] = [
  {
    id: 'modern',
    label: 'Modern Minimal',
    description: 'Scandinavian showroom, everything aligned and quiet',
    defaultMaterials: { frame: 'brushed_aluminum', glass: 'clear_glass', panel: 'white_laminate', handle: 'matte_black', sill: 'white_laminate', plate: 'painted_white' },
    defaultWallSurface: 'Solid_Steel',
    effects: [],
  },
  {
    id: 'industrial',
    label: 'Industrial Raw',
    description: 'Converted warehouse, nothing hides what it is made of',
    defaultMaterials: { frame: 'raw_steel', glass: 'clear_glass', panel: 'raw_steel', handle: 'wrought_iron', track: 'raw_steel', plate: 'raw_steel' },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'patina_tint', targets: ['steel'], color: '#b44a1a', intensity: 0.15 }],
  },
  // ... 15 more styles per spec
];

const QUICK_SKINS: QuickSkinPreset[] = [
  // 5 per style × 17 styles = 85 presets
  { id: 'industrial_dark', styleId: 'industrial', label: 'Dark Industrial', slots: { frame: 'matte_black', glass: 'smoked_glass', panel: 'raw_steel', handle: 'wrought_iron' } },
  // ...
];

export const styleRegistry: Map<string, StyleDefinition> = new Map(STYLES.map(s => [s.id, s]));

export function getStyle(id: StyleId): StyleDefinition | undefined {
  return styleRegistry.get(id);
}

export function getQuickSkins(styleId: StyleId): QuickSkinPreset[] {
  return QUICK_SKINS.filter(s => s.styleId === styleId);
}
```

- [ ] **Step 4: Run tests**

Run: `cd C:/MHome/MContainer && npx vitest run src/__tests__/style-registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/styleRegistry.ts src/__tests__/style-registry.test.ts
git commit -m "feat: add style registry with 17 styles and quick skin presets"
```

---

## Task 4: Form Registry (Doors, Windows, Lights, Electrical)

**Files:**
- Create: `src/config/forms/doors.ts`, `src/config/forms/windows.ts`, `src/config/forms/lights.ts`, `src/config/forms/electrical.ts`
- Create: `src/config/formRegistry.ts`
- Test: `src/__tests__/form-registry.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/form-registry.test.ts
import { describe, it, expect } from 'vitest';
import { formRegistry, getByCategory, getByStyle, getByCategoryAndStyle } from '@/config/formRegistry';
import { styleRegistry } from '@/config/styleRegistry';
import { materialRegistry } from '@/config/materialRegistry';
import type { FormCategory } from '@/types/sceneObject';

describe('Form Registry', () => {
  it('contains exactly 27 forms', () => {
    expect(formRegistry.size).toBe(27);
  });

  it('no duplicate form IDs', () => {
    const ids = [...formRegistry.keys()];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every form has all required fields', () => {
    for (const [id, form] of formRegistry) {
      expect(form.id).toBe(id);
      expect(['door', 'window', 'light', 'electrical']).toContain(form.category);
      expect(form.name.length).toBeGreaterThan(0);
      expect(['face', 'floor', 'ceiling']).toContain(form.anchorType);
      expect([1, 2, 3]).toContain(form.slotWidth);
      expect(form.skinSlots.length).toBeGreaterThan(0);
      expect(form.costEstimate).toBeGreaterThan(0);
    }
  });

  it('every form style references a valid style in styleRegistry', () => {
    for (const [, form] of formRegistry) {
      for (const styleId of form.styles) {
        if (styleId === 'all') continue;
        expect(styleRegistry.has(styleId)).toBe(true);
      }
    }
  });

  it('every default skin references a valid material in materialRegistry', () => {
    for (const [, form] of formRegistry) {
      for (const [, matId] of Object.entries(form.defaultSkin)) {
        expect(materialRegistry.has(matId)).toBe(true);
      }
    }
  });

  it('slotWidth only meaningful for face-anchored forms', () => {
    for (const [, form] of formRegistry) {
      if (form.anchorType !== 'face') {
        // Floor/ceiling forms should have slotWidth=1 (unused but consistent)
        expect(form.slotWidth).toBe(1);
      }
    }
  });

  it('getByCategory returns correct counts', () => {
    expect(getByCategory('door').length).toBe(8);
    expect(getByCategory('window').length).toBe(7);
    expect(getByCategory('light').length).toBe(8);
    expect(getByCategory('electrical').length).toBe(4);
  });

  it('getByStyle returns forms matching a style', () => {
    const japanese = getByStyle('japanese');
    expect(japanese.length).toBeGreaterThan(0);
    for (const form of japanese) {
      expect(form.styles).toContain('japanese');
    }
  });

  it('getByCategoryAndStyle intersects correctly', () => {
    const japDoors = getByCategoryAndStyle('door', 'japanese');
    for (const form of japDoors) {
      expect(form.category).toBe('door');
      expect(form.styles).toContain('japanese');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/MHome/MContainer && npx vitest run src/__tests__/form-registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create form definition files**

Create `src/config/forms/doors.ts` — 8 door FormDefinitions per spec table.
Create `src/config/forms/windows.ts` — 7 window FormDefinitions per spec table.
Create `src/config/forms/lights.ts` — 8 light FormDefinitions per spec table.
Create `src/config/forms/electrical.ts` — 4 electrical FormDefinitions per spec table.

Each file exports a `FormDefinition[]`. Example for doors:

```typescript
// src/config/forms/doors.ts
import type { FormDefinition } from '@/types/sceneObject';

export const DOOR_FORMS: FormDefinition[] = [
  {
    id: 'door_single_swing',
    category: 'door',
    name: 'Single Swing',
    description: 'Standard hinged door, inward or outward swing',
    styles: ['modern', 'industrial', 'japanese', 'desert_brutalist', 'coastal', 'noir_glass', 'solarpunk', 'frontier_rustic', 'retro_capsule', 'neo_tropical', 'cyberpunk', 'maker_raw', 'art_deco', 'arctic_bunker', 'terra_adobe', 'memphis_pop', 'stealth'],
    anchorType: 'face',
    slotWidth: 2,
    dimensions: { w: 0.9, h: 2.1, d: 0.1 },
    skinSlots: [
      { id: 'frame', label: 'Frame', materialOptions: ['raw_steel', 'brushed_aluminum', 'matte_black', 'warm_oak', 'walnut', 'painted_white'] },
      { id: 'panel', label: 'Panel', materialOptions: ['raw_steel', 'warm_oak', 'walnut', 'reclaimed_barn', 'white_laminate', 'painted_white', 'painted_sage'] },
      { id: 'handle', label: 'Handle', materialOptions: ['matte_black', 'brushed_aluminum', 'polished_chrome', 'wrought_iron', 'blackened_brass'] },
    ],
    defaultSkin: { frame: 'raw_steel', panel: 'raw_steel', handle: 'matte_black' },
    geometry: 'procedural',
    costEstimate: 800,
    constraints: { requiresExteriorFace: false },
  },
  // ... 7 more doors
];
```

- [ ] **Step 4: Create formRegistry.ts**

```typescript
// src/config/formRegistry.ts
import type { FormDefinition, FormCategory, StyleId } from '@/types/sceneObject';
import { DOOR_FORMS } from './forms/doors';
import { WINDOW_FORMS } from './forms/windows';
import { LIGHT_FORMS } from './forms/lights';
import { ELECTRICAL_FORMS } from './forms/electrical';

const ALL_FORMS: FormDefinition[] = [
  ...DOOR_FORMS,
  ...WINDOW_FORMS,
  ...LIGHT_FORMS,
  ...ELECTRICAL_FORMS,
];

export const formRegistry: Map<string, FormDefinition> = new Map(
  ALL_FORMS.map(f => [f.id, f])
);

export function getByCategory(cat: FormCategory): FormDefinition[] {
  return ALL_FORMS.filter(f => f.category === cat);
}

export function getByStyle(style: StyleId): FormDefinition[] {
  return ALL_FORMS.filter(f => f.styles.includes(style));
}

export function getByCategoryAndStyle(cat: FormCategory, style: StyleId): FormDefinition[] {
  return ALL_FORMS.filter(f => f.category === cat && f.styles.includes(style));
}
```

- [ ] **Step 5: Run tests**

Run: `cd C:/MHome/MContainer && npx vitest run src/__tests__/form-registry.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/config/forms/ src/config/formRegistry.ts src/__tests__/form-registry.test.ts
git commit -m "feat: add form registry with 27 forms (8 doors, 7 windows, 8 lights, 4 electrical)"
```

---

## Task 5: Slot Occupancy Utils

**Files:**
- Create: `src/utils/slotOccupancy.ts`
- Test: `src/__tests__/slot-occupancy.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/slot-occupancy.test.ts
import { describe, it, expect } from 'vitest';
import {
  getOccupiedSlots,
  canPlaceInSlot,
  getSlotsForPlacement,
  canPlaceFloorObject,
} from '@/utils/slotOccupancy';
import type { SceneObject, FormDefinition } from '@/types/sceneObject';

// Helper: make a minimal SceneObject
function makeObj(overrides: Partial<SceneObject> & { anchor: SceneObject['anchor'] }): SceneObject {
  return { id: 'obj-1', formId: 'test', skin: {}, ...overrides };
}

describe('Slot Occupancy', () => {
  describe('getOccupiedSlots', () => {
    it('returns empty set when no objects on face', () => {
      const result = getOccupiedSlots([], 'c1', 12, 'n');
      expect(result.size).toBe(0);
    });

    it('returns correct slots for slotWidth=1 object at slot 0', () => {
      const objects = [makeObj({ anchor: { containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0 } })];
      const formMap = new Map([['test', { slotWidth: 1 } as FormDefinition]]);
      const result = getOccupiedSlots(objects, 'c1', 12, 'n', formMap);
      expect(result).toEqual(new Set([0]));
    });

    it('returns correct slots for slotWidth=2 object at slot 0', () => {
      const objects = [makeObj({ anchor: { containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0 } })];
      const formMap = new Map([['test', { slotWidth: 2 } as FormDefinition]]);
      const result = getOccupiedSlots(objects, 'c1', 12, 'n', formMap);
      expect(result).toEqual(new Set([0, 1]));
    });

    it('returns correct slots for slotWidth=3 (fills face)', () => {
      const objects = [makeObj({ anchor: { containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0 } })];
      const formMap = new Map([['test', { slotWidth: 3 } as FormDefinition]]);
      const result = getOccupiedSlots(objects, 'c1', 12, 'n', formMap);
      expect(result).toEqual(new Set([0, 1, 2]));
    });

    it('ignores objects on different face', () => {
      const objects = [makeObj({ anchor: { containerId: 'c1', voxelIndex: 12, type: 'face', face: 's', slot: 0 } })];
      const formMap = new Map([['test', { slotWidth: 1 } as FormDefinition]]);
      const result = getOccupiedSlots(objects, 'c1', 12, 'n', formMap);
      expect(result.size).toBe(0);
    });
  });

  describe('canPlaceInSlot', () => {
    it('allows placement when all needed slots are free', () => {
      const occupied = new Set<number>();
      expect(canPlaceInSlot(occupied, 0, 2)).toBe(true);
    });

    it('rejects when any needed slot is occupied', () => {
      const occupied = new Set([1]);
      expect(canPlaceInSlot(occupied, 0, 2)).toBe(false); // needs slots 0,1
    });

    it('rejects when slot + width exceeds 3', () => {
      expect(canPlaceInSlot(new Set(), 2, 2)).toBe(false); // would need slots 2,3
    });
  });

  describe('getSlotsForPlacement', () => {
    it('returns [0,1,2] for slotWidth=1 on empty face', () => {
      expect(getSlotsForPlacement(new Set(), 1)).toEqual([0, 1, 2]);
    });

    it('returns [0,1] for slotWidth=2 on empty face', () => {
      expect(getSlotsForPlacement(new Set(), 2)).toEqual([0, 1]);
    });

    it('returns [0] for slotWidth=3 on empty face', () => {
      expect(getSlotsForPlacement(new Set(), 3)).toEqual([0]);
    });

    it('returns empty for slotWidth=2 when slot 1 occupied', () => {
      expect(getSlotsForPlacement(new Set([1]), 2)).toEqual([]);
    });
  });

  describe('canPlaceFloorObject', () => {
    it('allows placement when no other floor objects in voxel', () => {
      expect(canPlaceFloorObject(
        { w: 0.3, h: 0.5, d: 0.3 },
        [0, 0],
        [],
      )).toBe(true);
    });

    it('rejects overlapping floor objects', () => {
      const existing = [{ dims: { w: 0.3, h: 0.5, d: 0.3 }, offset: [0, 0] as [number, number] }];
      expect(canPlaceFloorObject(
        { w: 0.3, h: 0.5, d: 0.3 },
        [0, 0],
        existing,
      )).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/MHome/MContainer && npx vitest run src/__tests__/slot-occupancy.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement slotOccupancy.ts**

```typescript
// src/utils/slotOccupancy.ts
import type { SceneObject, FormDefinition, WallDirection } from '@/types/sceneObject';

export function getOccupiedSlots(
  objects: SceneObject[],
  containerId: string,
  voxelIndex: number,
  face: WallDirection,
  formMap?: Map<string, FormDefinition>,
): Set<number> {
  const occupied = new Set<number>();
  for (const obj of objects) {
    const a = obj.anchor;
    if (a.containerId !== containerId || a.voxelIndex !== voxelIndex || a.face !== face || a.type !== 'face') continue;
    const slotWidth = formMap?.get(obj.formId)?.slotWidth ?? 1;
    const startSlot = a.slot ?? 0;
    for (let i = 0; i < slotWidth; i++) {
      occupied.add(startSlot + i);
    }
  }
  return occupied;
}

export function canPlaceInSlot(occupied: Set<number>, startSlot: number, slotWidth: number): boolean {
  if (startSlot + slotWidth > 3) return false;
  for (let i = 0; i < slotWidth; i++) {
    if (occupied.has(startSlot + i)) return false;
  }
  return true;
}

export function getSlotsForPlacement(occupied: Set<number>, slotWidth: number): number[] {
  const valid: number[] = [];
  for (let s = 0; s <= 3 - slotWidth; s++) {
    if (canPlaceInSlot(occupied, s, slotWidth)) valid.push(s);
  }
  return valid;
}

export function canPlaceFloorObject(
  dims: { w: number; h: number; d: number },
  offset: [number, number],
  existing: { dims: { w: number; h: number; d: number }; offset: [number, number] }[],
): boolean {
  for (const e of existing) {
    const overlapX = Math.abs(offset[0] - e.offset[0]) < (dims.w + e.dims.w) / 2;
    const overlapZ = Math.abs(offset[1] - e.offset[1]) < (dims.d + e.dims.d) / 2;
    if (overlapX && overlapZ) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run tests**

Run: `cd C:/MHome/MContainer && npx vitest run src/__tests__/slot-occupancy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/slotOccupancy.ts src/__tests__/slot-occupancy.test.ts
git commit -m "feat: add slot occupancy utils for sub-face grid validation"
```

---

## Task 6: Skin Resolver

**Files:**
- Create: `src/utils/skinResolver.ts`
- Test: `src/__tests__/skin-resolver.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/__tests__/skin-resolver.test.ts
import { describe, it, expect } from 'vitest';
import { resolveSkin } from '@/utils/skinResolver';

describe('Skin Resolver', () => {
  it('returns form defaults when no overrides and no style', () => {
    const resolved = resolveSkin(
      { frame: 'raw_steel', glass: 'clear_glass' }, // form defaults
      {},                                             // no overrides
      undefined,                                      // no style
    );
    expect(resolved).toEqual({ frame: 'raw_steel', glass: 'clear_glass' });
  });

  it('style defaults override form defaults', () => {
    const resolved = resolveSkin(
      { frame: 'raw_steel', glass: 'clear_glass' },
      {},
      { frame: 'matte_black', glass: 'smoked_glass' }, // style defaults
    );
    expect(resolved).toEqual({ frame: 'matte_black', glass: 'smoked_glass' });
  });

  it('user overrides take highest priority', () => {
    const resolved = resolveSkin(
      { frame: 'raw_steel', glass: 'clear_glass' },
      { frame: 'polished_chrome' },                   // user override
      { frame: 'matte_black', glass: 'smoked_glass' },
    );
    expect(resolved.frame).toBe('polished_chrome');
    expect(resolved.glass).toBe('smoked_glass');
  });

  it('extra form default slots not in style still appear', () => {
    const resolved = resolveSkin(
      { frame: 'raw_steel', glass: 'clear_glass', handle: 'wrought_iron' },
      {},
      { frame: 'matte_black' }, // style only overrides frame
    );
    expect(resolved.handle).toBe('wrought_iron');
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

```typescript
// src/utils/skinResolver.ts
export function resolveSkin(
  formDefaults: Record<string, string>,
  userOverrides: Record<string, string>,
  styleDefaults?: Record<string, string>,
): Record<string, string> {
  return {
    ...formDefaults,
    ...(styleDefaults ?? {}),
    ...userOverrides,
  };
}
```

- [ ] **Step 3: Run tests**

Run: `cd C:/MHome/MContainer && npx vitest run src/__tests__/skin-resolver.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/skinResolver.ts src/__tests__/skin-resolver.test.ts
git commit -m "feat: add skin resolver (form defaults < style defaults < user overrides)"
```

---

## Task 7: Scene Object Store Slice

**Files:**
- Create: `src/store/slices/sceneObjectSlice.ts`
- Test: `src/__tests__/scene-object-slice.test.ts`

This is the largest task. Split into sub-steps.

- [ ] **Step 1: Write failing tests for core CRUD actions**

```typescript
// src/__tests__/scene-object-slice.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('sceneObjectSlice', () => {
  beforeEach(resetStore);

  describe('placeObject', () => {
    it('creates a SceneObject with UUID and correct anchor', () => {
      const id = useStore.getState().placeObject('door_single_swing', {
        containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 1,
      });
      expect(id).toBeTruthy();
      const obj = useStore.getState().sceneObjects[id];
      expect(obj).toBeDefined();
      expect(obj.formId).toBe('door_single_swing');
      expect(obj.anchor.face).toBe('n');
      expect(obj.anchor.slot).toBe(1);
    });

    it('applies skin overrides when provided', () => {
      const id = useStore.getState().placeObject('door_single_swing', {
        containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0,
      }, { frame: 'polished_chrome' });
      const obj = useStore.getState().sceneObjects[id];
      expect(obj.skin.frame).toBe('polished_chrome');
    });

    it('rejects placement on occupied slot', () => {
      useStore.getState().placeObject('door_single_swing', {
        containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0,
      });
      // door_single_swing is slotWidth=2, occupies slots 0,1
      const id2 = useStore.getState().placeObject('window_standard', {
        containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 1,
      });
      expect(id2).toBe(''); // rejected
    });
  });

  describe('removeObject', () => {
    it('deletes the object from sceneObjects', () => {
      const id = useStore.getState().placeObject('window_standard', {
        containerId: 'c1', voxelIndex: 5, type: 'face', face: 'e', slot: 0,
      });
      useStore.getState().removeObject(id);
      expect(useStore.getState().sceneObjects[id]).toBeUndefined();
    });
  });

  describe('updateSkin', () => {
    it('updates a single skin slot', () => {
      const id = useStore.getState().placeObject('door_single_swing', {
        containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0,
      });
      useStore.getState().updateSkin(id, 'frame', 'polished_chrome');
      expect(useStore.getState().sceneObjects[id].skin.frame).toBe('polished_chrome');
    });
  });

  describe('updateState', () => {
    it('updates runtime state (e.g. door open)', () => {
      const id = useStore.getState().placeObject('door_single_swing', {
        containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0,
      });
      useStore.getState().updateObjectState(id, 'openState', 'open_swing');
      expect(useStore.getState().sceneObjects[id].state?.openState).toBe('open_swing');
    });
  });

  describe('removeObjectsByContainer', () => {
    it('removes all objects anchored to a container', () => {
      useStore.getState().placeObject('window_standard', {
        containerId: 'c1', voxelIndex: 5, type: 'face', face: 'n', slot: 0,
      });
      useStore.getState().placeObject('light_pendant', {
        containerId: 'c1', voxelIndex: 5, type: 'ceiling',
      });
      useStore.getState().placeObject('window_standard', {
        containerId: 'c2', voxelIndex: 3, type: 'face', face: 'e', slot: 0,
      });

      useStore.getState().removeObjectsByContainer('c1');

      const remaining = Object.values(useStore.getState().sceneObjects);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].anchor.containerId).toBe('c2');
    });
  });

  describe('duplicateObject', () => {
    it('creates a copy with new ID and different anchor', () => {
      const id1 = useStore.getState().placeObject('window_standard', {
        containerId: 'c1', voxelIndex: 5, type: 'face', face: 'n', slot: 0,
      }, { frame: 'polished_chrome' });

      const id2 = useStore.getState().duplicateObject(id1, {
        containerId: 'c1', voxelIndex: 5, type: 'face', face: 'n', slot: 2,
      });

      expect(id2).not.toBe(id1);
      expect(id2).not.toBe('');
      const obj2 = useStore.getState().sceneObjects[id2];
      expect(obj2.formId).toBe('window_standard');
      expect(obj2.skin.frame).toBe('polished_chrome');
      expect(obj2.anchor.slot).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/MHome/MContainer && npx vitest run src/__tests__/scene-object-slice.test.ts`
Expected: FAIL — sceneObjects not on store, actions not found

- [ ] **Step 3: Implement sceneObjectSlice.ts**

```typescript
// src/store/slices/sceneObjectSlice.ts
import type { SceneObject, ObjectAnchor } from '@/types/sceneObject';
import { formRegistry } from '@/config/formRegistry';
import { getOccupiedSlots, canPlaceInSlot } from '@/utils/slotOccupancy';
import { v4 as uuid } from 'uuid';

export interface SceneObjectSlice {
  sceneObjects: Record<string, SceneObject>;
  placeObject: (formId: string, anchor: ObjectAnchor, skinOverrides?: Record<string, string>) => string;
  removeObject: (objectId: string) => void;
  updateSkin: (objectId: string, slotId: string, materialId: string) => void;
  applyQuickSkin: (objectId: string, slots: Record<string, string>) => void;
  updateObjectState: (objectId: string, key: string, value: unknown) => void;
  moveObject: (objectId: string, newAnchor: ObjectAnchor) => void;
  duplicateObject: (objectId: string, newAnchor: ObjectAnchor) => string;
  removeObjectsByContainer: (containerId: string) => void;
}

export function createSceneObjectSlice(set: any, get: any): SceneObjectSlice {
  return {
    sceneObjects: {},

    placeObject: (formId, anchor, skinOverrides) => {
      const form = formRegistry.get(formId);
      if (!form) return '';

      // Validate slot occupancy for face-anchored objects
      if (anchor.type === 'face' && anchor.face != null) {
        const allObjects = Object.values(get().sceneObjects) as SceneObject[];
        const occupied = getOccupiedSlots(allObjects, anchor.containerId, anchor.voxelIndex, anchor.face, formRegistry);
        if (!canPlaceInSlot(occupied, anchor.slot ?? 0, form.slotWidth)) return '';
      }

      const id = uuid();
      const obj: SceneObject = {
        id,
        formId,
        skin: skinOverrides ?? {},
        anchor,
      };

      set((s: any) => {
        s.sceneObjects[id] = obj;
      });
      return id;
    },

    removeObject: (objectId) => {
      set((s: any) => {
        delete s.sceneObjects[objectId];
      });
    },

    updateSkin: (objectId, slotId, materialId) => {
      set((s: any) => {
        const obj = s.sceneObjects[objectId];
        if (obj) obj.skin[slotId] = materialId;
      });
    },

    applyQuickSkin: (objectId, slots) => {
      set((s: any) => {
        const obj = s.sceneObjects[objectId];
        if (obj) obj.skin = { ...slots };
      });
    },

    updateObjectState: (objectId, key, value) => {
      set((s: any) => {
        const obj = s.sceneObjects[objectId];
        if (!obj) return;
        if (!obj.state) obj.state = {};
        obj.state[key] = value;
      });
    },

    moveObject: (objectId, newAnchor) => {
      set((s: any) => {
        const obj = s.sceneObjects[objectId];
        if (obj) obj.anchor = newAnchor;
      });
    },

    duplicateObject: (objectId, newAnchor) => {
      const source = get().sceneObjects[objectId] as SceneObject | undefined;
      if (!source) return '';

      const form = formRegistry.get(source.formId);
      if (!form) return '';

      // Validate new anchor slot
      if (newAnchor.type === 'face' && newAnchor.face != null) {
        const allObjects = Object.values(get().sceneObjects) as SceneObject[];
        const occupied = getOccupiedSlots(allObjects, newAnchor.containerId, newAnchor.voxelIndex, newAnchor.face, formRegistry);
        if (!canPlaceInSlot(occupied, newAnchor.slot ?? 0, form.slotWidth)) return '';
      }

      const id = uuid();
      set((s: any) => {
        s.sceneObjects[id] = {
          id,
          formId: source.formId,
          skin: { ...source.skin },
          anchor: newAnchor,
        };
      });
      return id;
    },

    removeObjectsByContainer: (containerId) => {
      set((s: any) => {
        for (const [id, obj] of Object.entries(s.sceneObjects)) {
          if ((obj as SceneObject).anchor.containerId === containerId) {
            delete s.sceneObjects[id];
          }
        }
      });
    },
  };
}
```

- [ ] **Step 4: Wire slice into useStore.ts**

Modify `src/store/useStore.ts`:
- Import `SceneObjectSlice` and `createSceneObjectSlice`
- Add to `StoreState` union type
- Add `...createSceneObjectSlice(set, get)` in the store creator
- Add `sceneObjects` to temporal `partialize`
- Add `sceneObjects` to persist `partialize`

**Key lines to modify:**
- Line ~186 (StoreState type): add `& SceneObjectSlice`
- Line ~200 (store creator): add `...createSceneObjectSlice(setState, getState)`
- Line ~205 (temporal partialize): add `sceneObjects: s.sceneObjects`
- Line ~218 (persist partialize): add `sceneObjects: s.sceneObjects`

- [ ] **Step 5: Run tests**

Run: `cd C:/MHome/MContainer && npx vitest run src/__tests__/scene-object-slice.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite + tsc**

Run: `cd C:/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 tsc errors, all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/store/slices/sceneObjectSlice.ts src/store/useStore.ts src/__tests__/scene-object-slice.test.ts
git commit -m "feat: add sceneObjectSlice with CRUD actions, slot validation, and store integration"
```

---

## Task 8: Persist Schema & Migration

**Files:**
- Modify: `src/store/persistSchema.ts`
- Create: `src/utils/migration/migrateToSceneObjects.ts`
- Test: `src/__tests__/migration.test.ts`

- [ ] **Step 1: Write failing test for schema validation**

```typescript
// src/__tests__/migration.test.ts
import { describe, it, expect } from 'vitest';
import { sceneObjectSchema } from '@/store/persistSchema';

describe('SceneObject persist schema', () => {
  it('validates a valid SceneObject', () => {
    const result = sceneObjectSchema.safeParse({
      id: 'test-1',
      formId: 'door_single_swing',
      skin: { frame: 'matte_black' },
      anchor: { containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 1 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects SceneObject with missing formId', () => {
    const result = sceneObjectSchema.safeParse({
      id: 'test-1',
      skin: {},
      anchor: { containerId: 'c1', voxelIndex: 12, type: 'face' },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails, then implement**

Add to `src/store/persistSchema.ts`:

```typescript
export const sceneObjectSchema = z.object({
  id: z.string(),
  formId: z.string(),
  skin: z.record(z.string(), z.string()),
  anchor: z.object({
    containerId: z.string(),
    voxelIndex: z.number(),
    type: z.enum(['face', 'floor', 'ceiling']),
    face: z.enum(['n', 's', 'e', 'w']).optional(),
    slot: z.number().optional(),
    offset: z.tuple([z.number(), z.number()]).optional(),
  }),
  state: z.record(z.string(), z.any()).optional(),
}).passthrough();
```

Add `sceneObjects` and `schemaVersion` to `persistedStateSchema`:

```typescript
sceneObjects: z.record(z.string(), sceneObjectSchema).optional().default({}),
schemaVersion: z.number().optional().default(1),
```

- [ ] **Step 3: Run tests**

Run: `cd C:/MHome/MContainer && npx vitest run src/__tests__/migration.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/store/persistSchema.ts src/__tests__/migration.test.ts
git commit -m "feat: add SceneObject Zod schema and schemaVersion to persist schema"
```

- [ ] **Step 5: Write migration stub**

Create `src/utils/migration/migrateToSceneObjects.ts`:

```typescript
// Migration from old FaceFinish/LightPlacement to SceneObjects
// Called during hydration when schemaVersion < 2
export function migrateToSceneObjects(state: any): any {
  if (state.schemaVersion && state.schemaVersion >= 2) return state;

  // For now, just set schemaVersion to 2 and init empty sceneObjects
  // Full migration (reading old DoorConfig, FaceFinish, LightPlacement)
  // deferred until old data format is actually encountered in production
  return {
    ...state,
    sceneObjects: state.sceneObjects ?? {},
    schemaVersion: 2,
  };
}
```

- [ ] **Step 6: Wire migration into useStore.ts onRehydrateStorage**

In `src/store/useStore.ts`, in the `onRehydrateStorage` callback, add:

```typescript
import { migrateToSceneObjects } from '@/utils/migration/migrateToSceneObjects';
// ... inside onRehydrateStorage:
if (state) {
  const migrated = migrateToSceneObjects(state);
  if (migrated !== state) {
    useStore.setState(migrated);
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/utils/migration/migrateToSceneObjects.ts src/store/useStore.ts
git commit -m "feat: add schema migration stub for SceneObject hydration"
```

---

## Task 9: Theme → Style Migration

**Files:**
- Modify: `src/config/themes.ts`
- Modify: `src/store/slices/uiSlice.ts` (or wherever `currentTheme` lives)
- Test: update existing theme tests if any

- [ ] **Step 1: Add THEME_TO_STYLE_MAP to themes.ts**

```typescript
// Add to src/config/themes.ts
import type { StyleId } from '@/types/sceneObject';

export const THEME_TO_STYLE_MAP: Record<ThemeId, StyleId> = {
  industrial: 'industrial',
  japanese: 'japanese',
  desert: 'desert_brutalist',
};
```

- [ ] **Step 2: Add activeStyle to UI state**

In `src/store/slices/uiSlice.ts` (or the slice that owns `currentTheme`):
- Add `activeStyle: StyleId` field (default: `'industrial'`)
- Add `setActiveStyle: (style: StyleId) => void` action
- Keep `currentTheme` for backward compat but derive it from `activeStyle` via reverse map

- [ ] **Step 3: Run full test suite**

Run: `cd C:/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/config/themes.ts src/store/slices/uiSlice.ts
git commit -m "feat: add activeStyle (StyleId) and THEME_TO_STYLE_MAP for theme migration"
```

---

## Task 10: SceneObjectRenderer (3D Rendering)

**Files:**
- Create: `src/components/objects/SceneObjectRenderer.tsx`
- Modify: `src/components/three/Scene.tsx` (mount it)

- [ ] **Step 1: Create SceneObjectRenderer with procedural geometry**

```typescript
// src/components/objects/SceneObjectRenderer.tsx
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { formRegistry } from '@/config/formRegistry';
import { resolveSkin } from '@/utils/skinResolver';
import { getStyle } from '@/config/styleRegistry';
import { getMaterial } from '@/config/materialRegistry';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { SceneObject } from '@/types/sceneObject';

// Compute world position from anchor
function anchorToPosition(anchor: SceneObject['anchor']): [number, number, number] {
  // Reuse existing voxelLocalCenter math from hitbox system
  // Returns [x, y, z] in container-local coordinates
  // Implementation reads VOXEL_COLS, colPitch, rowPitch from container constants
  // ... (detailed implementation during execution)
  return [0, 0, 0]; // placeholder
}

export function SceneObjectRenderer({ containerIds }: { containerIds: string[] }) {
  const objects = useStore(useShallow((s) => {
    const result: SceneObject[] = [];
    for (const obj of Object.values(s.sceneObjects)) {
      if (containerIds.includes(obj.anchor.containerId)) {
        result.push(obj);
      }
    }
    return result;
  }));

  const activeStyle = useStore((s) => s.activeStyle);

  if (objects.length === 0) return null;

  return (
    <group>
      {objects.map((obj) => (
        <SceneObjectMesh key={obj.id} object={obj} styleId={activeStyle} />
      ))}
    </group>
  );
}

function SceneObjectMesh({ object, styleId }: { object: SceneObject; styleId: string }) {
  const form = formRegistry.get(object.formId);
  if (!form) return null;

  const style = getStyle(styleId as any);
  const resolvedSkin = resolveSkin(form.defaultSkin, object.skin, style?.defaultMaterials);

  const position = useMemo(() => anchorToPosition(object.anchor), [object.anchor]);

  // Procedural geometry for now — GLB loading deferred to art pipeline sprint
  const frameMat = useMemo(() => {
    const mat = getMaterial(resolvedSkin.frame ?? resolvedSkin.fixture ?? 'raw_steel');
    return new THREE.MeshStandardMaterial({
      color: mat?.color ?? '#888888',
      metalness: mat?.metalness ?? 0.5,
      roughness: mat?.roughness ?? 0.5,
    });
  }, [resolvedSkin]);

  return (
    <group position={position}>
      <mesh material={frameMat} raycast={() => {}}>
        <boxGeometry args={[form.dimensions.w, form.dimensions.h, form.dimensions.d]} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 2: Mount in Scene.tsx**

Add `<SceneObjectRenderer containerIds={visibleContainerIds} />` inside the scene graph, after ContainerSkin/ContainerMesh rendering.

- [ ] **Step 3: Run tsc + tests**

Run: `cd C:/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass

- [ ] **Step 4: Browser verification**

Open dev server, place a container, use store action to place a SceneObject:
```javascript
// In browser console:
const store = window.__STORE__;
store.getState().placeObject('door_single_swing', {
  containerId: Object.keys(store.getState().containers)[0],
  voxelIndex: 12,
  type: 'face',
  face: 'n',
  slot: 1,
});
```
Verify a box-shaped placeholder appears on the container wall.

- [ ] **Step 5: Commit**

```bash
git add src/components/objects/SceneObjectRenderer.tsx src/components/three/Scene.tsx
git commit -m "feat: add SceneObjectRenderer with procedural placeholder geometry"
```

---

## Task 11: Wall Face Coordination

**Files:**
- Modify: `src/components/objects/ContainerSkin.tsx`

- [ ] **Step 1: Add slotWidth=3 face skip logic**

In ContainerSkin.tsx, where wall faces are rendered, add a check: if a face has a SceneObject with slotWidth=3 (fully occupied), skip rendering the wall face to avoid z-fighting.

```typescript
// In the face rendering loop, before creating face geometry:
const faceObjects = getObjectsOnFace(containerId, voxelIndex, face);
const isFullyOccupied = faceObjects.some(obj => {
  const form = formRegistry.get(obj.formId);
  return form && form.slotWidth === 3;
});
if (isFullyOccupied) continue; // skip this face
```

Use a derived selector to avoid per-frame computation.

- [ ] **Step 2: Run tsc + tests**

Run: `cd C:/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/objects/ContainerSkin.tsx
git commit -m "feat: skip wall face rendering for fully-occupied faces (slotWidth=3)"
```

---

## Task 12: PlacementGhost Component

**Files:**
- Create: `src/components/objects/PlacementGhost.tsx`
- Modify: `src/store/slices/uiSlice.ts` (add placement mode state)

- [ ] **Step 1: Add placement mode state to uiSlice**

```typescript
// Add to UiSlice interface:
placementMode: boolean;
activePlacementFormId: string | null;
setPlacementMode: (formId: string | null) => void;
```

Implementation:
```typescript
placementMode: false,
activePlacementFormId: null,
setPlacementMode: (formId) => {
  set((s: any) => {
    s.placementMode = formId != null;
    s.activePlacementFormId = formId;
  });
},
```

- [ ] **Step 2: Create PlacementGhost.tsx**

A translucent preview mesh that follows the cursor and snaps to valid sub-face slots. Shows green tint for valid placement, red for invalid.

```typescript
// src/components/objects/PlacementGhost.tsx
// Reads activePlacementFormId from store
// Uses useFrame + raycaster to find hovered wall face
// Snaps to nearest valid slot using getSlotsForPlacement
// Renders translucent box at snap position
// onClick: calls placeObject with resolved anchor
// Escape: calls setPlacementMode(null)
```

- [ ] **Step 3: Mount PlacementGhost in Scene.tsx**

```typescript
{placementMode && <PlacementGhost />}
```

- [ ] **Step 4: Run tsc + tests + browser verify**

- [ ] **Step 5: Commit**

```bash
git add src/components/objects/PlacementGhost.tsx src/store/slices/uiSlice.ts src/components/three/Scene.tsx
git commit -m "feat: add PlacementGhost with slot snapping and valid/invalid preview"
```

---

## Task 13: FormCatalog UI (Bottom Bar)

**Files:**
- Create: `src/components/ui/FormCatalog.tsx`
- Modify: `src/components/ui/BottomDock.tsx` (or equivalent bottom container)

- [ ] **Step 1: Create FormCatalog.tsx**

```typescript
// src/components/ui/FormCatalog.tsx
// - Category tabs: Doors | Windows | Lights | Electrical
// - Style filter pills (horizontally scrollable, multi-select from styleRegistry)
// - Horizontal card carousel (getByCategory + filter by selected styles)
// - Each card: form.name, cost dots (1-5 based on costEstimate quartile), click handler
// - Click card → setPlacementMode(form.id)
// - Collapsible to thin strip
```

Component structure:
```
FormCatalog
├── CategoryTabs (4 tabs)
├── StyleFilterRow (17 style pills, scrollable)
└── FormCardCarousel
    └── FormCard × N (name, cost dots, click to place)
```

- [ ] **Step 2: Mount in BottomDock or create bottom dock if needed**

- [ ] **Step 3: Browser verify** — open catalog, see tabs, click a door, verify placement mode activates

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/FormCatalog.tsx src/components/ui/BottomDock.tsx
git commit -m "feat: add FormCatalog bottom bar with category tabs, style filter, and card carousel"
```

---

## Task 14: SkinEditor UI (Left Panel)

**Files:**
- Create: `src/components/ui/SkinEditor.tsx`
- Modify: `src/components/ui/Sidebar.tsx` (or inspector panel equivalent)

- [ ] **Step 1: Create SkinEditor.tsx**

```typescript
// src/components/ui/SkinEditor.tsx
// Context-sensitive left panel:
// - When SceneObject selected: show form name, skin slot dropdowns, quick skins, state controls
// - Dropdowns: for each skinSlot, show materialOptions filtered to valid materials
// - Quick skins: 5 QuickSkinPreset buttons from active style
// - State controls: door (open/closed, flip), light (brightness, color temp)
// - Duplicate / Remove buttons
```

- [ ] **Step 2: Wire into Sidebar/Inspector**

Mount `<SkinEditor />` when a SceneObject is selected (detect via selection state).

- [ ] **Step 3: Browser verify** — select a placed object, verify skin editor appears with dropdowns

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/SkinEditor.tsx src/components/ui/Sidebar.tsx
git commit -m "feat: add SkinEditor left panel with skin slot dropdowns and quick skin presets"
```

---

## Task 15: Placement Flow Wiring

**Files:**
- Modify: `src/components/objects/PlacementGhost.tsx` (refine)
- Modify: `src/components/ui/FormCatalog.tsx` (connect to placement mode)
- Modify: hotkey system for Escape to exit placement

- [ ] **Step 1: Wire catalog → placement → ghost → place → skin editor flow**

End-to-end flow:
1. FormCatalog card click → `setPlacementMode(formId)`
2. PlacementGhost mounts, follows cursor, snaps to slots
3. Click to place → `placeObject(formId, anchor)` → `setPlacementMode(formId)` (stay in mode)
4. Escape → `setPlacementMode(null)`
5. Click existing object → select it → SkinEditor shows

- [ ] **Step 2: Add Escape hotkey**

In `src/hooks/useAppHotkeys.ts` (or equivalent), add:
```typescript
useHotkeys('escape', () => {
  if (store.getState().placementMode) {
    store.getState().setPlacementMode(null);
  }
});
```

- [ ] **Step 3: Browser verify full flow**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire end-to-end placement flow (catalog → ghost → place → skin editor)"
```

---

## Task 16: BOM Integration

**Files:**
- Modify: `src/store/slices/containerSlice.ts` (extend `getEstimate()`)
- Modify: `src/components/ui/LiveBOM.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// Add to src/__tests__/bom.test.ts
it('BOM includes scene object costs', () => {
  useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
  const cId = Object.keys(useStore.getState().containers)[0];

  useStore.getState().placeObject('door_single_swing', {
    containerId: cId, voxelIndex: 12, type: 'face', face: 'n', slot: 0,
  });

  const estimate = useStore.getState().getEstimate();
  // door_single_swing costEstimate = 800
  expect(estimate.breakdown.sceneObjects).toBe(800);
  expect(estimate.breakdown.total).toBeGreaterThan(800);
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Extend getEstimate()**

In `containerSlice.ts`, inside `getEstimate()`, add scene object cost summation:

```typescript
let sceneObjectsCost = 0;
const sceneObjects = get().sceneObjects ?? {};
for (const obj of Object.values(sceneObjects)) {
  const form = formRegistry.get(obj.formId);
  if (form) sceneObjectsCost += form.costEstimate;
}
// Add to breakdown
```

- [ ] **Step 4: Update LiveBOM.tsx to show scene objects category**

- [ ] **Step 5: Run tests**

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/store/slices/containerSlice.ts src/components/ui/LiveBOM.tsx src/__tests__/bom.test.ts
git commit -m "feat: integrate scene object costs into BOM estimation"
```

---

## Task 17: Container Remove Cascade

**Files:**
- Modify: `src/store/slices/containerSlice.ts`

- [ ] **Step 1: Write failing test**

```typescript
// Add to scene-object-slice.test.ts
it('removeContainer cascades to remove associated SceneObjects', () => {
  const cId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
  useStore.getState().placeObject('window_standard', {
    containerId: cId, voxelIndex: 5, type: 'face', face: 'n', slot: 0,
  });
  expect(Object.keys(useStore.getState().sceneObjects)).toHaveLength(1);

  useStore.getState().removeContainer(cId);
  expect(Object.keys(useStore.getState().sceneObjects)).toHaveLength(0);
});
```

- [ ] **Step 2: Add cascade call in removeContainer**

In `containerSlice.ts`, inside `removeContainer` action, add:
```typescript
get().removeObjectsByContainer(containerId);
```

- [ ] **Step 3: Run tests**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/store/slices/containerSlice.ts src/__tests__/scene-object-slice.test.ts
git commit -m "feat: cascade removeContainer to delete associated SceneObjects"
```

---

## Task 18: Core Loop Canary Extension

**Files:**
- Modify: `src/__tests__/core-loop-canary.test.ts` (or create if needed)

- [ ] **Step 1: Add scene object canary tests**

```typescript
describe('Scene Object Canary', () => {
  it('full lifecycle: place → skin → remove → undo', () => {
    const cId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    // Place
    const doorId = useStore.getState().placeObject('door_single_swing', {
      containerId: cId, voxelIndex: 12, type: 'face', face: 'n', slot: 0,
    });
    const windowId = useStore.getState().placeObject('window_standard', {
      containerId: cId, voxelIndex: 5, type: 'face', face: 'e', slot: 0,
    });
    const lightId = useStore.getState().placeObject('light_pendant', {
      containerId: cId, voxelIndex: 10, type: 'ceiling',
    });

    // Verify BOM
    let estimate = useStore.getState().getEstimate();
    expect(estimate.breakdown.sceneObjects).toBeGreaterThan(0);

    // Update skin
    useStore.getState().updateSkin(doorId, 'frame', 'polished_chrome');
    expect(useStore.getState().sceneObjects[doorId].skin.frame).toBe('polished_chrome');

    // Remove door
    useStore.getState().removeObject(doorId);
    expect(useStore.getState().sceneObjects[doorId]).toBeUndefined();

    // BOM updates
    estimate = useStore.getState().getEstimate();
    const doorCost = 800; // door_single_swing costEstimate
    // sceneObjects cost should be reduced by doorCost
    expect(Object.keys(useStore.getState().sceneObjects)).toHaveLength(2);

    // Undo (restore door)
    useStore.temporal.getState().undo();
    expect(useStore.getState().sceneObjects[doorId]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test**

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/core-loop-canary.test.ts
git commit -m "test: add scene object canary (place/skin/remove/undo lifecycle)"
```

---

## Task 19: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `cd C:/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 tsc errors, all tests pass

- [ ] **Step 2: Run acceptance gates**

Run: `cd C:/MHome/MContainer && npm run gates`
Expected: All gates pass

- [ ] **Step 3: Browser verification checklist**

1. Open app in browser
2. Verify FormCatalog bottom bar appears with 4 category tabs
3. Click "Doors" tab → see 8 door cards
4. Click style filter "Japanese" → see filtered results
5. Click a door card → cursor enters placement mode
6. Hover over container wall → ghost preview appears, snaps to slot
7. Click to place → door placeholder renders on wall
8. Click placed door → SkinEditor appears in left panel
9. Change frame material → door updates in 3D
10. Press Escape → exits placement mode
11. Check BOM bar → includes scene object costs
12. Undo → door removed; Redo → door restored
13. Delete container → all placed objects removed

- [ ] **Step 4: Commit any fixes from browser verification**

- [ ] **Step 5: Update architecture doc**

Add to `MODUHOME-V1-ARCHITECTURE-v2.md`:
- SceneObject system summary
- New store slice documentation
- Updated file inventory

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: update architecture docs for unified placeable object system"
git tag sprint-scene-objects-complete
```
