# SceneObject Interaction Depth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make placed SceneObjects feel interactive — hover highlights, slot indicators during placement, card-hover preview ghosts, and Tab cycling.

**Architecture:** Two new ephemeral store atoms (`hoveredObjectId`, `hoveredFormId`). Emissive tint on SceneObjectRenderer meshes. SlotIndicator child in PlacementGhost. New HoverPreviewGhost component. Tab keydown handler in Scene.tsx.

**Tech Stack:** React 19, Zustand 5, Three.js, @react-three/fiber, @react-three/drei (Line), vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-03-23-sceneobject-interaction-depth-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/store/slices/uiSlice.ts` | Modify | Add `hoveredObjectId` + setter, `hoveredFormId` + setter |
| `src/Testing/object-interaction.test.ts` | Create | Store atom tests, Tab cycling logic, hover suppression |
| `src/components/objects/SceneObjectRenderer.tsx` | Modify | Add `onPointerOver`/`onPointerOut` → `setHoveredObjectId`; emissive tint via useRef |
| `src/components/three/ContainerMesh.tsx` | Modify | VoxelHoverHighlight skips when `hoveredObjectId` is truthy |
| `src/components/objects/PlacementGhost.tsx` | Modify | Add SlotIndicator child rendering slot boundary lines |
| `src/components/objects/HoverPreviewGhost.tsx` | Create | Card-hover preview ghost (blue tint, passive) |
| `src/components/ui/BottomPanel.tsx` | Modify | `onMouseEnter`/`onMouseLeave` on cards → `setHoveredFormId` |
| `src/components/three/Scene.tsx` | Modify | Tab/Shift+Tab keydown handler, mount `<HoverPreviewGhost />` |

---

### Task 1: Store Atoms + Unit Tests

**Files:**
- Modify: `src/store/slices/uiSlice.ts`
- Create: `src/Testing/object-interaction.test.ts`

- [ ] **Step 1: Write the test file**

Create `src/Testing/object-interaction.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';

function resetStore() {
  useStore.setState({
    hoveredObjectId: null,
    hoveredFormId: null,
    selectedObjectId: null,
    selection: [],
    sceneObjects: {},
    activePlacementFormId: null,
  });
}

describe('object interaction store atoms', () => {
  beforeEach(resetStore);

  it('setHoveredObjectId sets and clears', () => {
    useStore.getState().setHoveredObjectId('obj-1');
    expect(useStore.getState().hoveredObjectId).toBe('obj-1');
    useStore.getState().setHoveredObjectId(null);
    expect(useStore.getState().hoveredObjectId).toBeNull();
  });

  it('setHoveredFormId sets and clears', () => {
    useStore.getState().setHoveredFormId('door_single_swing');
    expect(useStore.getState().hoveredFormId).toBe('door_single_swing');
    useStore.getState().setHoveredFormId(null);
    expect(useStore.getState().hoveredFormId).toBeNull();
  });
});

describe('Tab cycling logic', () => {
  beforeEach(resetStore);

  function setupObjects(containerIds: string[], objectAnchors: { id: string; containerId: string }[]) {
    const containers: Record<string, any> = {};
    for (const cid of containerIds) {
      containers[cid] = { id: cid, size: '40ft_high_cube', voxelGrid: [], level: 0 };
    }
    const sceneObjects: Record<string, any> = {};
    for (const obj of objectAnchors) {
      sceneObjects[obj.id] = {
        id: obj.id,
        formId: 'door_single_swing',
        skin: {},
        anchor: { containerId: obj.containerId, voxelIndex: 9, type: 'face', face: 'n' },
      };
    }
    useStore.setState({ containers, sceneObjects });
  }

  // Pure logic helper matching what Scene.tsx will implement
  function getNextObjectId(
    sceneObjects: Record<string, any>,
    containerId: string,
    currentId: string | null,
    reverse: boolean,
  ): string | null {
    const ids = Object.entries(sceneObjects)
      .filter(([, obj]) => obj.anchor.containerId === containerId)
      .map(([id]) => id)
      .sort();
    if (ids.length === 0) return null;
    if (!currentId || !ids.includes(currentId)) return ids[0];
    const idx = ids.indexOf(currentId);
    const next = reverse
      ? (idx - 1 + ids.length) % ids.length
      : (idx + 1) % ids.length;
    return ids[next];
  }

  it('returns first object when nothing selected', () => {
    setupObjects(['c1'], [
      { id: 'aaa', containerId: 'c1' },
      { id: 'bbb', containerId: 'c1' },
    ]);
    const result = getNextObjectId(useStore.getState().sceneObjects, 'c1', null, false);
    expect(result).toBe('aaa');
  });

  it('advances to next object', () => {
    setupObjects(['c1'], [
      { id: 'aaa', containerId: 'c1' },
      { id: 'bbb', containerId: 'c1' },
      { id: 'ccc', containerId: 'c1' },
    ]);
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', 'aaa', false)).toBe('bbb');
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', 'bbb', false)).toBe('ccc');
  });

  it('wraps around forward', () => {
    setupObjects(['c1'], [
      { id: 'aaa', containerId: 'c1' },
      { id: 'bbb', containerId: 'c1' },
    ]);
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', 'bbb', false)).toBe('aaa');
  });

  it('wraps around reverse (Shift+Tab)', () => {
    setupObjects(['c1'], [
      { id: 'aaa', containerId: 'c1' },
      { id: 'bbb', containerId: 'c1' },
    ]);
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', 'aaa', true)).toBe('bbb');
  });

  it('returns null for empty container', () => {
    setupObjects(['c1'], []);
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', null, false)).toBeNull();
  });

  it('only considers objects in the target container', () => {
    setupObjects(['c1', 'c2'], [
      { id: 'aaa', containerId: 'c1' },
      { id: 'bbb', containerId: 'c2' },
    ]);
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', null, false)).toBe('aaa');
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', 'aaa', false)).toBe('aaa'); // only 1 in c1, wraps to self
  });

  it('recovers from stale selectedObjectId', () => {
    setupObjects(['c1'], [
      { id: 'aaa', containerId: 'c1' },
      { id: 'bbb', containerId: 'c1' },
    ]);
    // 'deleted-id' doesn't exist in sceneObjects
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', 'deleted-id', false)).toBe('aaa');
  });
});
```

- [ ] **Step 2: Add store atoms to uiSlice.ts**

In `src/store/slices/uiSlice.ts`, add to the `UiSlice` interface (after `selectedObjectId`/`selectObject`):

```ts
// SceneObject hover (Feature 1: emissive tint)
hoveredObjectId: string | null;
setHoveredObjectId: (id: string | null) => void;

// Form card hover → 3D preview ghost (Feature 3)
hoveredFormId: string | null;
setHoveredFormId: (id: string | null) => void;
```

Add to `createUiSlice` initial state + actions (after `selectObject`):

```ts
hoveredObjectId: null,
setHoveredObjectId: (id) => set({ hoveredObjectId: id }),

hoveredFormId: null,
setHoveredFormId: (id) => set({ hoveredFormId: id }),
```

- [ ] **Step 3: Run tests**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/object-interaction.test.ts`
Expected: All PASS

- [ ] **Step 4: Run full suite**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
cd /c/MHome/MContainer && git add src/store/slices/uiSlice.ts src/Testing/object-interaction.test.ts && git commit -m "feat: add hoveredObjectId and hoveredFormId store atoms with Tab cycling tests"
```

---

### Task 2: Hover Highlight on SceneObjectRenderer

**Files:**
- Modify: `src/components/objects/SceneObjectRenderer.tsx`
- Modify: `src/components/three/ContainerMesh.tsx`

- [ ] **Step 1: Add pointer events to SceneObjectRenderer**

In `SceneObjectRenderer.tsx`, the `ProceduralFormMesh` component (renders the `<mesh>` at ~line 210) and `GlbFormMesh` (renders `<group>` at ~line 295) both have `onClick`. Add `onPointerOver` and `onPointerOut` to both:

For `ProceduralFormMesh` mesh (~line 210):
```tsx
onPointerOver={(e) => {
  if (placementMode) return;
  e.stopPropagation();
  useStore.getState().setHoveredObjectId(objectId);
}}
onPointerOut={(e) => {
  e.stopPropagation();
  useStore.getState().setHoveredObjectId(null);
}}
```

For `GlbFormMesh` group (~line 295):
```tsx
onPointerOver={placementMode ? undefined : (e) => {
  e.stopPropagation();
  useStore.getState().setHoveredObjectId(objectId);
}}
onPointerOut={(e) => {
  e.stopPropagation();
  useStore.getState().setHoveredObjectId(null);
}}
```

- [ ] **Step 2: Add emissive tint via ref**

In `ProceduralFormMesh`, add a `useFrame` hook that reads `hoveredObjectId` and applies emissive tint:

```ts
import { useFrame } from '@react-three/fiber';

// Inside ProceduralFormMesh, add ref:
const meshRef = useRef<THREE.Mesh>(null);

// Add emissive constants at module level:
const HOVER_EMISSIVE = new THREE.Color('#00bcd4');
const HOVER_EMISSIVE_INTENSITY = 0.15;
const NO_EMISSIVE = new THREE.Color(0, 0, 0);

// Add useFrame inside ProceduralFormMesh:
useFrame(() => {
  const mesh = meshRef.current;
  if (!mesh || !mesh.material) return;
  const mat = mesh.material as THREE.MeshStandardMaterial;
  const isHovered = useStore.getState().hoveredObjectId === objectId;
  if (isHovered) {
    mat.emissive.copy(HOVER_EMISSIVE);
    mat.emissiveIntensity = HOVER_EMISSIVE_INTENSITY;
  } else if (mat.emissiveIntensity > 0) {
    mat.emissive.copy(NO_EMISSIVE);
    mat.emissiveIntensity = 0;
  }
});
```

Add `ref={meshRef}` to the `<mesh>` element. Note: `useFrame` requires the component to be inside R3F Canvas — it already is.

For `GlbFormMesh`, the emissive tint applies to children. Add a `useFrame` that traverses `clonedScene.children`:

```ts
useFrame(() => {
  if (!clonedScene) return;
  const isHovered = useStore.getState().hoveredObjectId === objectId;
  clonedScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat.emissive) {
        if (isHovered) {
          mat.emissive.copy(HOVER_EMISSIVE);
          mat.emissiveIntensity = HOVER_EMISSIVE_INTENSITY;
        } else if (mat.emissiveIntensity > 0) {
          mat.emissive.copy(NO_EMISSIVE);
          mat.emissiveIntensity = 0;
        }
      }
    }
  });
});
```

- [ ] **Step 3: Suppress VoxelHoverHighlight when object hovered**

In `ContainerMesh.tsx`, in the `VoxelHoverHighlight` function (~line 1979), add an early return:

```ts
const hoveredObjectId = useStore((s) => s.hoveredObjectId);
// Suppress voxel hover when a SceneObject is hovered (avoid competing highlights)
if (hoveredObjectId) return null;
```

Add this after the existing store selectors (~line 1985), before the `useMemo`.

- [ ] **Step 4: Type check + test**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all pass

- [ ] **Step 5: Commit**

```bash
cd /c/MHome/MContainer && git add src/components/objects/SceneObjectRenderer.tsx src/components/three/ContainerMesh.tsx && git commit -m "feat: hover highlight on placed SceneObjects (emissive tint + voxel hover suppression)"
```

---

### Task 3: Slot Boundary Indicators in PlacementGhost

**Files:**
- Modify: `src/components/objects/PlacementGhost.tsx`

- [ ] **Step 1: Add SlotIndicator sub-component**

At the bottom of `PlacementGhost.tsx` (before the final export or after `PlacementGhostInner`), add:

```tsx
import { Line } from '@react-three/drei';
import { FACE_SLOT_COUNT } from '@/utils/slotOccupancy';

const SLOT_LINE_COLOR = 'white';
const SLOT_LINE_OPACITY = 0.3;

function SlotIndicator({
  containerId,
  voxelIndex,
  face,
  container,
}: {
  containerId: string;
  voxelIndex: number;
  face: WallDirection;
  container: any;
}) {
  const dims = CONTAINER_DIMENSIONS[container.size];
  const voxW = dims.length / VOXEL_COLS;
  const vHeight = dims.height;

  // Slot boundaries: N-1 lines for N slots
  const lines = useMemo(() => {
    const result: [number, number, number][][] = [];
    const slotWidth = voxW / FACE_SLOT_COUNT;

    for (let i = 1; i < FACE_SLOT_COUNT; i++) {
      const offset = -voxW / 2 + i * slotWidth;
      // Lines run vertically on the wall face
      // The coordinate axis depends on the face direction
      result.push([
        [offset, -vHeight / 2, 0],
        [offset, vHeight / 2, 0],
      ]);
    }
    return result;
  }, [voxW, vHeight]);

  // Position + rotate to match the wall face
  const anchor: ObjectAnchor = { containerId, voxelIndex, type: 'face', face, slot: 0 };
  const localPos = anchorToLocalPosition(anchor, container);
  const localRot = anchorToLocalRotation(anchor);
  const worldPos = localToWorld(localPos, container);
  const worldRot = localRotToWorld(localRot, container);

  // Nudge slightly forward to prevent z-fighting
  const nudge = 0.002;

  return (
    <group position={worldPos} rotation={worldRot}>
      <group position={[0, 0, nudge]}>
        {lines.map((pts, i) => (
          <Line
            key={i}
            points={pts}
            color={SLOT_LINE_COLOR}
            lineWidth={1}
            transparent
            opacity={SLOT_LINE_OPACITY}
          />
        ))}
      </group>
    </group>
  );
}
```

NOTE: This needs imports for `CONTAINER_DIMENSIONS`, `VOXEL_COLS`, `useMemo`, and the anchor math functions — check what's already imported in PlacementGhost.tsx and add missing ones. Also `WallDirection` from `@/types/sceneObject` and `ObjectAnchor`.

- [ ] **Step 2: Render SlotIndicator in PlacementGhostInner**

In the `return` JSX of `PlacementGhostInner` (after the `<mesh>` element), conditionally render SlotIndicator:

```tsx
return (
  <>
    <mesh ref={meshRef} geometry={geometry} material={materialRef.current!} />
    {/* Slot boundary lines on hovered wall */}
    <SlotIndicatorWrapper formId={formId} />
  </>
);
```

Where `SlotIndicatorWrapper` reads the store in useFrame-safe way:

```tsx
function SlotIndicatorWrapper({ formId }: { formId: string }) {
  const hovered = useStore((s) => s.hoveredVoxelEdge);
  const form = formRegistry.get(formId);
  const container = useStore((s) => hovered ? s.containers[hovered.containerId] : undefined);

  if (!hovered || !form || !container) return null;

  const face = hovered.face;
  const isWall = face === 'n' || face === 's' || face === 'e' || face === 'w';
  if (form.anchorType !== 'face' || !isWall) return null;

  return (
    <SlotIndicator
      containerId={hovered.containerId}
      voxelIndex={hovered.voxelIndex}
      face={face as WallDirection}
      container={container}
    />
  );
}
```

- [ ] **Step 3: Type check + test**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all pass

- [ ] **Step 4: Commit**

```bash
cd /c/MHome/MContainer && git add src/components/objects/PlacementGhost.tsx && git commit -m "feat: slot boundary indicator lines during placement mode"
```

---

### Task 4: HoverPreviewGhost + BottomPanel Wiring

**Files:**
- Create: `src/components/objects/HoverPreviewGhost.tsx`
- Modify: `src/components/ui/BottomPanel.tsx`
- Modify: `src/components/three/Scene.tsx`

- [ ] **Step 1: Create HoverPreviewGhost.tsx**

Create `src/components/objects/HoverPreviewGhost.tsx`:

```tsx
'use client';

/**
 * HoverPreviewGhost.tsx — Shows a semi-transparent preview of a form
 * at the hovered voxel face when a BottomPanel card is hovered (not clicked).
 *
 * Active when: hoveredFormId is set AND activePlacementFormId is NOT set.
 * Blue tint, 0.25 opacity. No slot validation — purely visual preview.
 */

import { useStore } from '@/store/useStore';
import { formRegistry } from '@/config/formRegistry';
import { anchorToLocalPosition, anchorToLocalRotation, localToWorld, localRotToWorld } from '@/utils/anchorMath';
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ObjectAnchor, WallDirection } from '@/types/sceneObject';

const PREVIEW_COLOR = new THREE.Color('#3b82f6');
const PREVIEW_OPACITY = 0.25;

export function HoverPreviewGhost() {
  const formId = useStore((s) => s.hoveredFormId);
  const placementActive = useStore((s) => s.activePlacementFormId);

  // Only show when hovering a card and NOT in placement mode
  if (!formId || placementActive) return null;
  return <HoverPreviewGhostInner formId={formId} />;
}

function HoverPreviewGhostInner({ formId }: { formId: string }) {
  const form = formRegistry.get(formId);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  if (!materialRef.current) {
    materialRef.current = new THREE.MeshStandardMaterial({
      color: PREVIEW_COLOR,
      transparent: true,
      opacity: PREVIEW_OPACITY,
      depthWrite: false,
    });
  }

  const geometry = useMemo(() => {
    if (!form) return new THREE.BoxGeometry(0.5, 1, 0.1);
    return new THREE.BoxGeometry(form.dimensions.w, form.dimensions.h, form.dimensions.d);
  }, [form]);

  useEffect(() => () => { geometry.dispose(); }, [geometry]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !form) return;

    const state = useStore.getState();
    const hovered = state.hoveredVoxelEdge;

    if (!hovered || !hovered.face) {
      mesh.visible = false;
      return;
    }

    const { containerId, voxelIndex, face } = hovered;

    // Check anchor type compatibility
    const isWallFace = face === 'n' || face === 's' || face === 'e' || face === 'w';
    const isFloor = face === 'bottom';
    const isCeiling = face === 'top';

    if (form.anchorType === 'face' && !isWallFace) { mesh.visible = false; return; }
    if (form.anchorType === 'floor' && !isFloor) { mesh.visible = false; return; }
    if (form.anchorType === 'ceiling' && !isCeiling) { mesh.visible = false; return; }

    const container = state.containers[containerId];
    if (!container) { mesh.visible = false; return; }

    // Build synthetic anchor (slot 0, no validation — just preview)
    const anchor: ObjectAnchor = form.anchorType === 'face'
      ? { containerId, voxelIndex, type: 'face', face: face as WallDirection, slot: 0 }
      : { containerId, voxelIndex, type: form.anchorType as 'floor' | 'ceiling' };

    const localPos = anchorToLocalPosition(anchor, container);
    const localRot = anchorToLocalRotation(anchor);

    if (form.anchorType === 'floor') localPos[1] += 0.01;
    if (form.anchorType === 'ceiling') localPos[1] -= 0.01;

    const worldPos = localToWorld(localPos, container);
    const worldRot = localRotToWorld(localRot, container);

    mesh.position.set(worldPos[0], worldPos[1], worldPos[2]);
    mesh.rotation.set(worldRot[0], worldRot[1], worldRot[2]);
    mesh.visible = true;
  });

  if (!form) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={materialRef.current!}
      visible={false}
      raycast={() => {}}
    />
  );
}
```

- [ ] **Step 2: Add onMouseEnter/onMouseLeave to BottomPanel cards**

In `src/components/ui/BottomPanel.tsx`, in the form card `<button>` element (the one with `onClick={() => handleCardClick(f.id)}`), add:

```tsx
onMouseEnter={() => {
  if (!useStore.getState().activePlacementFormId) {
    useStore.getState().setHoveredFormId(f.id);
  }
}}
onMouseLeave={() => {
  useStore.getState().setHoveredFormId(null);
}}
```

Also clear `hoveredFormId` in `handleCardClick` (when entering placement mode):

```ts
const handleCardClick = useCallback((formId: string) => {
  const { activePlacementFormId: current, setPlacementMode, setHoveredFormId } = useStore.getState();
  setHoveredFormId(null);
  setPlacementMode(current === formId ? null : formId);
}, []);
```

- [ ] **Step 3: Mount HoverPreviewGhost in Scene.tsx**

In `src/components/three/Scene.tsx`, add import:

```ts
import { HoverPreviewGhost } from '@/components/objects/HoverPreviewGhost';
```

Mount it next to PlacementGhost (there are two mount points — realistic and blueprint — add to both, ~lines 1367 and 1895):

```tsx
<PlacementGhost />
<HoverPreviewGhost />
```

- [ ] **Step 4: Type check + test**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all pass

- [ ] **Step 5: Commit**

```bash
cd /c/MHome/MContainer && git add src/components/objects/HoverPreviewGhost.tsx src/components/ui/BottomPanel.tsx src/components/three/Scene.tsx && git commit -m "feat: card hover shows blue preview ghost in 3D viewport"
```

---

### Task 5: Tab Cycling Through Placed Objects

**Files:**
- Modify: `src/components/three/Scene.tsx`

- [ ] **Step 1: Add Tab handler to Scene.tsx keydown listener**

In `src/components/three/Scene.tsx`, find the existing `keydown` handler (around line 790, the one with Escape, PageUp, PageDown). Add Tab handling before the closing `};`:

```ts
// Tab / Shift+Tab = cycle through placed SceneObjects in selected container
if (e.key === 'Tab') {
  e.preventDefault();
  const store = useStore.getState();
  const containerId = store.selection[0] ?? store.selectedVoxel?.containerId ?? null;
  if (!containerId) return;

  const ids = Object.entries(store.sceneObjects)
    .filter(([, obj]) => (obj as any).anchor.containerId === containerId)
    .map(([id]) => id)
    .sort();
  if (ids.length === 0) return;

  const currentId = store.selectedObjectId;
  const currentIdx = currentId ? ids.indexOf(currentId) : -1;
  const reverse = e.shiftKey;

  let nextIdx: number;
  if (currentIdx < 0) {
    nextIdx = 0; // nothing selected or stale ID → start at first
  } else if (reverse) {
    nextIdx = (currentIdx - 1 + ids.length) % ids.length;
  } else {
    nextIdx = (currentIdx + 1) % ids.length;
  }

  store.selectObject(ids[nextIdx]);
}
```

- [ ] **Step 2: Type check + test**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all pass

- [ ] **Step 3: Commit**

```bash
cd /c/MHome/MContainer && git add src/components/three/Scene.tsx && git commit -m "feat: Tab/Shift+Tab cycles through placed SceneObjects in container"
```

---

### Task 6: Playwright Verification

**Files:**
- No source changes — verification only

- [ ] **Step 1: Run full type check + test suite**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass

- [ ] **Step 2: Start dev server and run Playwright verification**

Start dev server: `npm run dev`

Write and run an inline Playwright script that verifies:

1. **Hover atoms exist**: `window.__store.getState().hoveredObjectId` and `hoveredFormId` are initially null
2. **Place a door**: call `placeObject('door_single_swing', anchor)` → verify object appears in `sceneObjects`
3. **Select object**: call `selectObject(objId)` → verify `selectedObjectId` set, sidebar shows SkinEditor
4. **Tab cycling**: call `selectObject(null)`, then simulate Tab keypress → verify `selectedObjectId` becomes the first object ID; Tab again → cycles to next or wraps
5. **Shift+Tab**: simulate Shift+Tab → verify reverse cycling
6. **hoveredFormId plumbing**: set `hoveredFormId` via store → verify it's readable; clear it → verify null
7. **hoveredObjectId plumbing**: set `hoveredObjectId` via store → verify readable
8. **Escape clears all**: press Escape → verify `selectedObjectId`, `hoveredObjectId`, `hoveredFormId` all null

- [ ] **Step 3: Report results**

Print pass/fail summary. All checks must pass.

- [ ] **Step 4: Final commit tag**

```bash
cd /c/MHome/MContainer && git tag -a sprint-b-complete -m "Sprint B: SceneObject interaction depth (hover, slots, preview ghost, Tab cycling)"
```
