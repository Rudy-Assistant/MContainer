# P0 Bugfix Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 P0 bugs: frame mode material reactivity, frame mode view isolation, and door flush positioning.

**Architecture:** All changes are in `ContainerSkin.tsx` and `materialCache.ts`. Tasks 1-2 add a material lookup helper and wire it into the pole rendering loop. Task 3 adds a face-skip guard for frame mode. Task 4 is a one-line geometry fix for door depth.

**Tech Stack:** React 19, Three.js, Zustand 5, R3F (React Three Fiber)

**Spec:** `docs/superpowers/specs/2026-03-26-p0-p1-bugfix-feature-sprint-design.md`

---

### Task 1: Add `getFrameThreeMaterial` lookup helper to materialCache.ts

**Files:**
- Modify: `src/config/materialCache.ts` (after line 231, near `MATERIAL_ID_MAP`)
- Create: `src/__tests__/frame-material-lookup.test.ts`

This helper maps frame material names (`'Steel'`, `'Wood'`, `'Concrete'`, `'Aluminum'`) to Three.js materials from the theme cache.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/frame-material-lookup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getFrameThreeMaterial } from '@/config/materialCache';

describe('getFrameThreeMaterial', () => {
  it('maps Steel to the steel material', () => {
    const mat = getFrameThreeMaterial('Steel', 'industrial');
    expect(mat).toBeDefined();
    expect(mat.type).toBe('MeshStandardMaterial');
  });

  it('maps Wood to the wood material', () => {
    const mat = getFrameThreeMaterial('Wood', 'industrial');
    expect(mat).toBeDefined();
  });

  it('maps Concrete to the concrete material', () => {
    const mat = getFrameThreeMaterial('Concrete', 'industrial');
    expect(mat).toBeDefined();
  });

  it('maps Aluminum to the frame material', () => {
    const mat = getFrameThreeMaterial('Aluminum', 'industrial');
    expect(mat).toBeDefined();
  });

  it('falls back to steel for unknown names', () => {
    const mat = getFrameThreeMaterial('Unknown' as any, 'industrial');
    expect(mat).toBeDefined();
  });

  it('works across all three themes', () => {
    for (const theme of ['industrial', 'japanese', 'desert'] as const) {
      const mat = getFrameThreeMaterial('Wood', theme);
      expect(mat).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/frame-material-lookup.test.ts`
Expected: FAIL — `getFrameThreeMaterial` is not exported from `materialCache`

- [ ] **Step 3: Implement `getFrameThreeMaterial`**

In `src/config/materialCache.ts`:

**First**, add the import at the **top of the file** alongside existing imports (lines 9–13):

```ts
import type { PoleMaterial, RailMaterial } from './frameMaterials';
```

**Then**, add after the `MATERIAL_ID_MAP` constant (after line 231). Note: `ThemeId`, `ThemeMaterialSet`, and `_themeMats` are already in scope in this file — do NOT re-import or re-declare them.

```ts
/** Map a frame material name (from frameMaterials.ts) to a Three.js material from the theme cache. */
const FRAME_MATERIAL_MAP: Record<string, keyof ThemeMaterialSet> = {
  Steel: 'steel',
  Wood: 'wood',
  Concrete: 'concrete',
  Aluminum: 'frame',
};

export function getFrameThreeMaterial(
  name: PoleMaterial | RailMaterial | string,
  theme: ThemeId,
): THREE.MeshStandardMaterial {
  const key = FRAME_MATERIAL_MAP[name] ?? 'steel';
  return _themeMats[theme][key] as THREE.MeshStandardMaterial;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/frame-material-lookup.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Run full type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/config/materialCache.ts src/__tests__/frame-material-lookup.test.ts
git commit -m "feat: add getFrameThreeMaterial lookup for frame material names"
```

---

### Task 2: Wire pole material reactivity in ContainerSkin

**Files:**
- Modify: `src/components/objects/ContainerSkin.tsx`
  - Line 2146: change `hoveredPoleRef` type
  - Lines 3447-3472: pole rendering loop — resolve material, fix hover/out handlers

**Context you need to know:**
- Module-level materials: `mFrame` (line 181) is the theme default frame material. `frameHoverMat` (line 299) is cyan hover. `frameSelectMat` (line 302) is yellow selection.
- `hoveredPoleRef` (line 2146) currently stores `THREE.Mesh | null`. Must change to `{ mesh: THREE.Mesh; material: THREE.Material } | null`.
- `resolveFrameProperty()` from `frameMaterials.ts` resolves: element override → container defaults → theme default.
- `getFrameThreeMaterial()` from Task 1 maps the resolved name to a Three.js material.
- `container.poleOverrides?.[poleKey]` gives the per-pole override config.
- `container.frameDefaults` gives the container-level defaults.
- `currentTheme` (ThemeId) is available — search for it in the component.

**Note on frame rails:** Frame rail meshes (horizontal members between poles) are **not yet rendered** in ContainerSkin — only surface railings (`RailingCable`/`RailingGlass`) exist as face-type renderers at lines 910/1317. The store has `container.railOverrides` and `container.frameDefaults.railMaterial`, but there are no frame rail meshes to apply them to. Frame rail rendering is Phase 2 scope. This task only wires pole material reactivity.

**Note on `resolveFrameProperty` tests:** The cascade is already covered by tests FSA-8 and FSA-9 in `src/__tests__/frame-data-model.test.ts` (lines 110-124). No duplicate tests needed.

- [ ] **Step 1: Change `hoveredPoleRef` type**

In `src/components/objects/ContainerSkin.tsx`, find line 2146:

```ts
// Before:
const hoveredPoleRef = useRef<THREE.Mesh | null>(null);

// After:
const hoveredPoleRef = useRef<{ mesh: THREE.Mesh; material: THREE.Material } | null>(null);
```

- [ ] **Step 2: Wire resolved material into pole rendering**

Find the pole rendering block (~lines 3447-3472). Add imports at top of file if not present:

```ts
import { resolveFrameProperty } from '@/config/frameMaterials';
import { getFrameThreeMaterial } from '@/config/materialCache';
```

Then modify the pole rendering block. Find this code (lines 3448-3471):

```ts
        const poleOverride = container.poleOverrides?.[poleKey];
        if (poleOverride?.visible === false) return null;
        const isSelectedPole = selectedFrameElement?.containerId === container.id && selectedFrameElement.key === poleKey;
        const poleMat = isSelectedPole ? frameSelectMat : mFrame;
```

Replace with:

```ts
        const poleOverride = container.poleOverrides?.[poleKey];
        if (poleOverride?.visible === false) return null;
        const isSelectedPole = selectedFrameElement?.containerId === container.id && selectedFrameElement.key === poleKey;
        const resolvedMatName = resolveFrameProperty(poleOverride, container.frameDefaults, 'pole', 'material');
        const resolvedMaterial = getFrameThreeMaterial(resolvedMatName, currentTheme);
        const poleMat = isSelectedPole ? frameSelectMat : resolvedMaterial;
```

- [ ] **Step 3: Fix `onPointerOver` cross-pole reset**

Find the `onPointerOver` handler (~lines 3458-3466). Replace:

```ts
            onPointerOver={frameMode ? (e) => {
              e.stopPropagation();
              const mesh = e.object as THREE.Mesh;
              if (hoveredPoleRef.current && hoveredPoleRef.current !== mesh) {
                hoveredPoleRef.current.material = mFrame;
              }
              hoveredPoleRef.current = mesh;
              if (!isSelectedPole) mesh.material = frameHoverMat;
            } : undefined}
```

With:

```ts
            onPointerOver={frameMode ? (e) => {
              e.stopPropagation();
              const mesh = e.object as THREE.Mesh;
              if (hoveredPoleRef.current && hoveredPoleRef.current.mesh !== mesh) {
                hoveredPoleRef.current.mesh.material = hoveredPoleRef.current.material;
              }
              hoveredPoleRef.current = { mesh, material: resolvedMaterial };
              if (!isSelectedPole) mesh.material = frameHoverMat;
            } : undefined}
```

- [ ] **Step 4: Fix `onPointerOut` to restore resolved material**

Find the `onPointerOut` handler (~lines 3467-3471). Replace:

```ts
            onPointerOut={frameMode ? (e) => {
              const mesh = e.object as THREE.Mesh;
              if (hoveredPoleRef.current === mesh) hoveredPoleRef.current = null;
              if (!isSelectedPole) mesh.material = mFrame;
            } : undefined}
```

With:

```ts
            onPointerOut={frameMode ? (e) => {
              const mesh = e.object as THREE.Mesh;
              if (hoveredPoleRef.current?.mesh === mesh) hoveredPoleRef.current = null;
              if (!isSelectedPole) mesh.material = resolvedMaterial;
            } : undefined}
```

- [ ] **Step 5: Confirm `currentTheme` is in scope**

`currentTheme` is already read from the store at line 2109 via `useStore((s) => s.currentTheme)`. Do NOT add a duplicate selector. Just verify it's accessible in the pole rendering scope (it is — it's component-level state).

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add src/components/objects/ContainerSkin.tsx
git commit -m "feat: wire frame pole material reactivity via resolveFrameProperty cascade"
```

---

### Task 3: Frame mode view isolation — hide walls/ceiling

**Files:**
- Modify: `src/components/objects/ContainerSkin.tsx` — face rendering loop (~line 2727)

**Context you need to know:**
- The face rendering loop is at line 2727: `const faceNodes = FACE_DIRS.map((dir) => {`
- `FACE_DIRS` (line 2487) is `["n", "s", "e", "w", "top", "bottom"]`
- `dir` is of type `keyof VoxelFaces` — values are `"n"`, `"s"`, `"e"`, `"w"`, `"top"`, `"bottom"`
- `frameMode` is already read from the store at line 2124
- When `frameMode === true`, we skip all wall faces (n/s/e/w) and ceiling (top). Floor (bottom) stays.
- This goes BEFORE the existing culling checks (adjIsMelting, globalCullSet, etc.)

**Dependency:** Task 2 must be complete first so poles display correct materials when walls are hidden.

- [ ] **Step 1: Add frame mode face skip**

In `src/components/objects/ContainerSkin.tsx`, find the face rendering loop at line 2727:

```ts
        const faceNodes = FACE_DIRS.map((dir) => {
          const surface = voxel.faces[dir];
```

Add immediately after the `const surface = ...` line:

```ts
          // Frame mode: show only floor — hide walls and ceiling so frame structure is visible
          if (frameMode && dir !== 'bottom') return null;
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/objects/ContainerSkin.tsx
git commit -m "feat: frame mode view isolation — hide walls/ceiling, show only floor + poles"
```

---

### Task 4: Door flush positioning — fix panel depth

**Files:**
- Modify: `src/components/objects/ContainerSkin.tsx` — `DoorFace` component (line 630)

**Context you need to know:**
- `DoorFace` component starts at line 572
- Line 630 creates the door panel geometry with depth `d * 0.6` — this makes the panel 60% of wall thickness (0.036m vs 0.06m wall)
- The door is recessed 12mm on each side, visibly not flush
- Fix: change `d * 0.6` to `d * 0.95` for a 1.5mm professional framing reveal
- This is a pure geometry change — no logic changes

- [ ] **Step 1: Fix door panel depth**

In `src/components/objects/ContainerSkin.tsx`, find line 630:

```tsx
            geometry={isNS ? getBox(doorW, h * 0.95, d * 0.6) : getBox(d * 0.6, h * 0.95, doorW)}
```

Replace with:

```tsx
            geometry={isNS ? getBox(doorW, h * 0.95, d * 0.95) : getBox(d * 0.95, h * 0.95, doorW)}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/objects/ContainerSkin.tsx
git commit -m "fix: door flush positioning — increase panel depth from 60% to 95% of wall thickness"
```

---

### Task 5: Browser verification

**Context:** All code changes are complete. Now verify everything works in the browser.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on localhost:3000

- [ ] **Step 2: Verify frame material reactivity**

1. Load app, click a container to select it
2. Open FrameInspector (toggle frame mode via toolbar)
3. Change "Pole Material" dropdown to "Wood"
4. Verify: poles visually change to wood material (brownish, not steel gray)
5. Change to "Concrete" — verify poles change again
6. Hover a pole — verify cyan highlight appears
7. Move mouse away — verify pole restores to its set material (not steel)
8. Move cursor directly from one pole to another — verify first pole restores correctly

- [ ] **Step 3: Verify frame view isolation**

1. With frame mode ON: walls and ceiling should be hidden
2. Only floor + poles should be visible
3. Toggle frame mode OFF: walls and ceiling reappear
4. Floor remains visible in both modes

- [ ] **Step 4: Verify door flush positioning**

1. Apply a "Door" surface to a wall face
2. Verify: door panel sits flush with wall surface (no visible gap/recess)
3. Test on both N/S and E/W walls
4. If door opens (click to toggle), verify hinge stays on wall edge

- [ ] **Step 5: Final full test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass

- [ ] **Step 6: Commit verification notes**

Write a brief handoff note confirming all 3 fixes verified in browser. Save to `MContainer/docs/handoff/sprint-p0-bugfix-handoff.md`.

```bash
git add MContainer/docs/handoff/sprint-p0-bugfix-handoff.md
git commit -m "docs: add P0 bugfix sprint verification notes"
```

Note: run git commands from the repo root (`C:\MHome`), or adjust paths if running from `C:\MHome\MContainer`.
