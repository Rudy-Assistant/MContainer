# Inspector Panel Streamlining — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Streamline the inspector panel with semi-transparent frame in wall-cut modes, global roof/skin toggles, room dropdown removal, and a unified FaceStrip component replacing three separate face-editing components.

**Architecture:** Four independent changes to the inspector/toolbar/3D rendering pipeline. Issue 1 touches only ContainerMesh frame rendering. Issue 2 adds store state + toolbar buttons + ContainerSkin filtering. Issues 3+4 replace the MatrixEditor tile detail section with a new FaceStrip component, deleting FaceSchematic and BatchFaceControls.

**Tech Stack:** React 19, Three.js (MeshStandardMaterial), Zustand v5 (uiSlice), Vitest

**Spec:** `docs/superpowers/specs/2026-03-21-inspector-streamlining-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/components/three/ContainerMesh.tsx` | Frame opacity: `frameSemiMat`, remove cutScale/hideTopBeams |
| Modify | `src/store/slices/uiSlice.ts` | Add `hideRoof`, `hideSkin`, toggle actions |
| Modify | `src/components/ui/TopToolbar.tsx` | Roof/Skin toggle buttons in Zone C |
| Modify | `src/components/objects/ContainerSkin.tsx` | Read global hideRoof/hideSkin, filter faces |
| Modify | `src/components/ui/IsoEditor.tsx` | Remove local hideRoof/hideSkin, read from store |
| Modify | `src/config/surfaceLabels.ts` | Receive `SURFACE_COLORS` extraction |
| Create | `src/components/ui/FaceStrip.tsx` | Unified face editor for 1-N voxels |
| Modify | `src/components/ui/MatrixEditor.tsx` | Replace tile detail with FaceStrip |
| Delete | `src/components/ui/FaceSchematic.tsx` | Replaced by FaceStrip |
| Delete | `src/components/ui/BatchFaceControls.tsx` | Replaced by FaceStrip |
| Create | `src/__tests__/inspector-streamlining.test.ts` | All new tests for this sprint |

---

## Task 1: Frame Semi-Transparent Material + Tests

**Files:**
- Create: `src/__tests__/inspector-streamlining.test.ts`
- Modify: `src/components/three/ContainerMesh.tsx:135-145` (materials), `:1759-1870` (FramePosts, FrameBeams)

- [ ] **Step 1: Extract `isFrameTranslucent` and write tests**

First, add a pure exported helper to `src/components/three/ContainerMesh.tsx` (near the material declarations, ~line 145):

```ts
/** Pure function: should frame use semi-transparent material? */
export function isFrameTranslucent(wallCutMode: string, wallCutHeight: number): boolean {
  return wallCutMode === 'half' || wallCutMode === 'down' ||
    (wallCutMode === 'custom' && wallCutHeight < 1.0);
}
```

Then create `src/__tests__/inspector-streamlining.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { isFrameTranslucent } from '@/components/three/ContainerMesh';

function resetStore() {
  useStore.getState().reset?.();
  useStore.setState({ wallCutMode: 'full', wallCutHeight: 1.0 });
}

describe('isFrameTranslucent', () => {
  it('full mode → opaque', () => {
    expect(isFrameTranslucent('full', 1.0)).toBe(false);
  });

  it('half mode → translucent', () => {
    expect(isFrameTranslucent('half', 1.0)).toBe(true);
  });

  it('down mode → translucent', () => {
    expect(isFrameTranslucent('down', 1.0)).toBe(true);
  });

  it('custom with wallCutHeight=1.0 → opaque', () => {
    expect(isFrameTranslucent('custom', 1.0)).toBe(false);
  });

  it('custom with wallCutHeight=0.5 → translucent', () => {
    expect(isFrameTranslucent('custom', 0.5)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** (function not yet exported)

Run: `npx vitest run src/__tests__/inspector-streamlining.test.ts`
Expected: FAIL — `isFrameTranslucent` not found

- [ ] **Step 3: Add `frameSemiMat` and update FramePosts**

In `src/components/three/ContainerMesh.tsx`, after `frameGhostMat` declaration (~line 144):

```ts
// Semi-transparent frame material for wall-cut modes (half/down) — structural orientation cue
const frameSemiMat = new THREE.MeshStandardMaterial({
  color: 0x3d4a55,
  metalness: 0.90,
  roughness: 0.55,
  envMapIntensity: 0.4,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
});
```

In `FramePosts` function (~line 1760):
- Remove `cutScale`, `postH`, `postY` variables
- Set `effectivePostH = dims.height` and `effectivePostY = dims.height / 2` directly
- Add translucency logic:

```ts
const wallCutHeight = useStore((s) => s.wallCutHeight);
const isTranslucent =
  wallCutMode === 'half' || wallCutMode === 'down' ||
  (wallCutMode === 'custom' && wallCutHeight < 1.0);
```

- Update material selection on the visual mesh (line ~1788):

```ts
material={isHidden ? frameGhostMat : isTranslucent ? frameSemiMat : frameMat}
```

- Remove `cutScale` from `key` attributes (no longer changes)

- [ ] **Step 4: Update FrameBeams — always show top beams, add translucency**

In `FrameBeams` function (~line 1817):
- Remove `hideTopBeams` variable
- Change `levels` to always include both:

```ts
const levels: [string, number][] = [["bottom", 0.03], ["top", dims.height + 0.01]];
```

- Add same translucency logic as FramePosts:

```ts
const wallCutHeight = useStore((s) => s.wallCutHeight);
const isTranslucent =
  wallCutMode === 'half' || wallCutMode === 'down' ||
  (wallCutMode === 'custom' && wallCutHeight < 1.0);
```

- Update material selection (~line 1849):

```ts
material={isHidden ? frameGhostMat : isTranslucent ? frameSemiMat : frameMat}
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: 553+ tests pass, 0 failures

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add src/components/three/ContainerMesh.tsx src/__tests__/inspector-streamlining.test.ts
git commit -m "feat: frame stays full height + semi-transparent in wall-cut modes

Posts and top beams always render at full height. In half/down/custom
wall-cut modes, frame uses frameSemiMat (opacity 0.3) for structural
orientation without visual clutter. Material priority: hidden >
translucent > opaque."
```

---

## Task 2: Global Hide Roof/Skin — Store + Toolbar

**Files:**
- Modify: `src/store/slices/uiSlice.ts:22-146` (interface + initial state)
- Modify: `src/components/ui/TopToolbar.tsx:350-370` (after wall visibility pill)
- Modify: `src/__tests__/inspector-streamlining.test.ts`

- [ ] **Step 1: Write failing tests for hideRoof/hideSkin store**

Append to `src/__tests__/inspector-streamlining.test.ts`:

```ts
describe('Global hideRoof / hideSkin store', () => {
  beforeEach(resetStore);

  it('hideRoof defaults to false', () => {
    expect(useStore.getState().hideRoof).toBe(false);
  });

  it('hideSkin defaults to false', () => {
    expect(useStore.getState().hideSkin).toBe(false);
  });

  it('toggleHideRoof flips the value', () => {
    useStore.getState().toggleHideRoof();
    expect(useStore.getState().hideRoof).toBe(true);
    useStore.getState().toggleHideRoof();
    expect(useStore.getState().hideRoof).toBe(false);
  });

  it('toggleHideSkin flips the value', () => {
    useStore.getState().toggleHideSkin();
    expect(useStore.getState().hideSkin).toBe(true);
    useStore.getState().toggleHideSkin();
    expect(useStore.getState().hideSkin).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/inspector-streamlining.test.ts`
Expected: FAIL — `hideRoof` / `toggleHideRoof` not found on store

- [ ] **Step 3: Add hideRoof/hideSkin to uiSlice**

In `src/store/slices/uiSlice.ts`, add to `UiSlice` interface (~line 22):

```ts
hideRoof: boolean;
toggleHideRoof: () => void;
hideSkin: boolean;
toggleHideSkin: () => void;
```

Add to `createUiSlice` return (~after line 258):

```ts
hideRoof: false,
toggleHideRoof: () => set((s: any) => ({ hideRoof: !s.hideRoof })),
hideSkin: false,
toggleHideSkin: () => set((s: any) => ({ hideSkin: !s.hideSkin })),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/inspector-streamlining.test.ts`
Expected: All pass

- [ ] **Step 5: Add Roof/Skin toggle buttons to TopToolbar**

In `src/components/ui/TopToolbar.tsx`, add store selectors at top of component (~line 94):

```ts
const hideRoof = useStore((s) => s.hideRoof);
const toggleHideRoof = useStore((s) => s.toggleHideRoof);
const hideSkin = useStore((s) => s.hideSkin);
const toggleHideSkin = useStore((s) => s.toggleHideSkin);
```

After the wall visibility pill closing `</div>` (~line 369), add:

```tsx
{/* ── Global Roof / Skin toggles ── */}
<button
  onClick={toggleHideRoof}
  title={hideRoof ? "Show Roof" : "Hide Roof"}
  style={{
    padding: "5px 10px",
    border: `1px solid ${hideRoof ? 'var(--accent, #2563eb)' : 'var(--btn-border, #e5e7eb)'}`,
    borderRadius: 6,
    cursor: "pointer",
    background: hideRoof ? "var(--accent, #2563eb)" : "transparent",
    color: hideRoof ? "#fff" : "var(--text-muted, #6b7280)",
    fontSize: 11,
    fontWeight: 600,
    transition: "all 100ms",
  }}
>
  Roof
</button>
<button
  onClick={toggleHideSkin}
  title={hideSkin ? "Show Skin" : "Hide Skin"}
  style={{
    padding: "5px 10px",
    border: `1px solid ${hideSkin ? 'var(--accent, #2563eb)' : 'var(--btn-border, #e5e7eb)'}`,
    borderRadius: 6,
    cursor: "pointer",
    background: hideSkin ? "var(--accent, #2563eb)" : "transparent",
    color: hideSkin ? "#fff" : "var(--text-muted, #6b7280)",
    fontSize: 11,
    fontWeight: 600,
    transition: "all 100ms",
  }}
>
  Skin
</button>
```

- [ ] **Step 6: Run all tests + type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All pass, 0 type errors

- [ ] **Step 7: Commit**

```bash
git add src/store/slices/uiSlice.ts src/components/ui/TopToolbar.tsx src/__tests__/inspector-streamlining.test.ts
git commit -m "feat: global hideRoof/hideSkin store + toolbar buttons

Adds hideRoof/hideSkin as ephemeral UI state with toggle actions.
Two compact toggle buttons in TopToolbar Zone C next to wall vis pill."
```

---

## Task 3: Global Hide Roof/Skin — ContainerSkin + IsoEditor

**Files:**
- Modify: `src/components/objects/ContainerSkin.tsx:1816-1824` (add global hide logic)
- Modify: `src/components/ui/IsoEditor.tsx:400-420` (remove local state, use store)

- [ ] **Step 1: Add hideRoof/hideSkin reading to ContainerSkin**

In `src/components/objects/ContainerSkin.tsx`, near the existing `wallCutMode` selectors (~line 1816):

```ts
const globalHideRoof = useStore((s) => s.hideRoof);
const globalHideSkin = useStore((s) => s.hideSkin);
```

Near the existing `hideCeiling` logic (~line 1823), update:

```ts
// Hide ceiling: when walls are cut OR global hideRoof is on
const hideCeiling = wallCutMode !== 'full' || globalHideRoof;
```

In the face rendering loop, find the early-return/skip for `hideSkin` on the container. Near the top of the voxel iteration loop (where faces are rendered), add a global skin check. Find the section where individual faces are rendered (~line 2389 area where `hideCeiling` is checked) and add before the face loop:

```ts
// Global skin hide — skip ALL face rendering for this container
if (globalHideSkin) return null;  // at the component level, early return
```

This `return null` should go right after the hooks but before any JSX rendering, guarded by `globalHideSkin`. The per-container `hideSkin` prop (if it exists from IsoEditor) also triggers this.

- [ ] **Step 2: Update IsoEditor — remove local state, use store**

In `src/components/ui/IsoEditor.tsx`, in the default export function (~line 400):

Remove:
```ts
const [hideRoof, setHideRoof] = useState(false);
const [hideSkin, setHideSkin] = useState(false);
```

Replace with:
```ts
const hideRoof = useStore((s) => s.hideRoof);
const hideSkin = useStore((s) => s.hideSkin);
```

Remove the `LayerBtn` controls from the layer toggles section (~line 418):
```tsx
<LayerBtn label="Roof" active={hideRoof} onClick={() => setHideRoof((v) => !v)} />
<LayerBtn label="Skin" active={hideSkin} onClick={() => setHideSkin((v) => !v)} />
```

Remove these two lines. The "Container" label span can stay. Also remove the `useState` import if no longer needed (check if `linked` still uses it — yes it does, keep `useState`).

- [ ] **Step 3: Run all tests + type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All pass, 0 type errors

- [ ] **Step 4: Commit**

```bash
git add src/components/objects/ContainerSkin.tsx src/components/ui/IsoEditor.tsx
git commit -m "feat: ContainerSkin reads global hideRoof/hideSkin, IsoEditor syncs

ContainerSkin early-returns null when globalHideSkin is true. Ceiling
faces hidden when globalHideRoof is on. IsoEditor removes local
useState, reads from store — stays in sync with toolbar toggles."
```

---

## Task 4: Create FaceStrip Component

**Files:**
- Create: `src/components/ui/FaceStrip.tsx`
- Modify: `src/__tests__/inspector-streamlining.test.ts`

- [ ] **Step 1: Write failing tests for FaceStrip logic**

Append to `src/__tests__/inspector-streamlining.test.ts`:

```ts
import { createDefaultVoxelGrid } from '@/types/factories';
import type { SurfaceType, VoxelFaces } from '@/types/container';

/** Helper: resolve face material for N voxels. Returns material if unanimous, null if mixed. */
function resolvedFaceMaterial(
  grid: { faces: VoxelFaces; active: boolean }[],
  indices: number[],
  face: keyof VoxelFaces,
): SurfaceType | null {
  const materials = new Set<SurfaceType>();
  for (const i of indices) {
    const v = grid[i];
    if (v?.active) materials.add(v.faces[face]);
  }
  return materials.size === 1 ? [...materials][0] : null;
}

describe('FaceStrip logic: resolvedFaceMaterial', () => {
  it('single voxel returns exact material', () => {
    const grid = createDefaultVoxelGrid();
    const mat = resolvedFaceMaterial(grid, [0], 'bottom');
    expect(mat).toBe('Deck_Wood');
  });

  it('multiple voxels with same face return that material', () => {
    const grid = createDefaultVoxelGrid();
    // Body voxels (indices 8-23) all have same bottom face
    const mat = resolvedFaceMaterial(grid, [8, 9, 10], 'bottom');
    expect(mat).toBe('Deck_Wood');
  });

  it('multiple voxels with different faces return null (Mix)', () => {
    const grid = createDefaultVoxelGrid();
    // Manually set one voxel to a different bottom face
    grid[8] = { ...grid[8], faces: { ...grid[8].faces, bottom: 'Concrete' } };
    const mat = resolvedFaceMaterial(grid, [8, 9], 'bottom');
    expect(mat).toBeNull();
  });

  it('inactive voxels are skipped', () => {
    const grid = createDefaultVoxelGrid();
    grid[0] = { ...grid[0], active: false };
    const mat = resolvedFaceMaterial(grid, [0], 'bottom');
    expect(mat).toBeNull();
  });

  it('empty indices returns null', () => {
    const grid = createDefaultVoxelGrid();
    const mat = resolvedFaceMaterial(grid, [], 'bottom');
    expect(mat).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they pass** (pure logic, no component needed yet)

Run: `npx vitest run src/__tests__/inspector-streamlining.test.ts`
Expected: All pass (the helper is defined inline in the test)

- [ ] **Step 3: Create FaceStrip.tsx**

Create `src/components/ui/FaceStrip.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";
import type { SurfaceType, VoxelFaces } from "@/types/container";
import { SURFACE_COLORS, SURFACE_SHORT_LABELS, QUICK_MATERIALS } from "@/config/surfaceLabels";
import { BookmarkPlus } from "lucide-react";

const FACE_KEYS: (keyof VoxelFaces)[] = ['n', 's', 'e', 'w', 'top', 'bottom'];
const FACE_LABELS: Record<keyof VoxelFaces, string> = {
  n: 'N', s: 'S', e: 'E', w: 'W', top: 'Top', bottom: 'Bot',
};
const FACE_FULL_LABELS: Record<keyof VoxelFaces, string> = {
  n: 'North', s: 'South', e: 'East', w: 'West', top: 'Top', bottom: 'Bottom',
};

/** Resolve face material across selected voxels. Returns material if unanimous, null if mixed. */
export function resolvedFaceMaterial(
  grid: { faces: VoxelFaces; active: boolean }[],
  indices: number[],
  face: keyof VoxelFaces,
): SurfaceType | null {
  const materials = new Set<SurfaceType>();
  for (const i of indices) {
    const v = grid[i];
    if (v?.active) materials.add(v.faces[face]);
  }
  return materials.size === 1 ? [...materials][0] : null;
}

/** Batch-set a specific face on all given voxels via paintFace */
function batchSetFace(containerId: string, indices: number[], face: keyof VoxelFaces, material: SurfaceType) {
  const store = useStore.getState();
  for (const idx of indices) {
    store.paintFace(containerId, idx, face, material);
  }
}

/** Batch-set multiple faces at once (for "All walls" etc.) via paintFace */
function batchSetFaces(containerId: string, indices: number[], faceUpdates: Partial<VoxelFaces>) {
  const store = useStore.getState();
  for (const idx of indices) {
    for (const [face, mat] of Object.entries(faceUpdates)) {
      store.paintFace(containerId, idx, face as keyof VoxelFaces, mat as SurfaceType);
    }
  }
}

export default function FaceStrip({ containerId, indices }: {
  containerId: string;
  indices: number[];
}) {
  const grid = useStore((s) => s.containers[containerId]?.voxelGrid);
  const saveBlockToLibrary = useStore((s) => s.saveBlockToLibrary);
  const setSelectedVoxel = useStore((s) => s.setSelectedVoxel);
  const setSelectedVoxels = useStore((s) => s.setSelectedVoxels);
  const [expandedFace, setExpandedFace] = useState<keyof VoxelFaces | null>(null);

  if (!grid || indices.length === 0) return null;

  const isSingle = indices.length === 1;

  // Resolve materials for each face
  const faceMaterials: Record<keyof VoxelFaces, SurfaceType | null> = {} as any;
  for (const face of FACE_KEYS) {
    faceMaterials[face] = resolvedFaceMaterial(grid, indices, face);
  }

  const handleDeselect = () => {
    setSelectedVoxel(null);
    setSelectedVoxels(null);
  };

  const handleSaveToLibrary = () => {
    if (!isSingle) return;
    const v = grid[indices[0]];
    if (!v?.active) return;
    const f = v.faces;
    const label = `${f.n === 'Glass_Pane' || f.s === 'Glass_Pane' ? 'Glass' : f.n === 'Open' ? 'Open' : 'Steel'} Block`;
    saveBlockToLibrary(label, f);
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 6,
      padding: "8px 10px",
      background: "var(--input-bg, #f8fafc)",
      borderRadius: 8,
    }}>
      {/* ── Face buttons: 2 rows ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
        {FACE_KEYS.slice(0, 4).map((face) => {
          const mat = faceMaterials[face];
          const isMix = mat === null;
          const color = isMix ? "#94a3b8" : (SURFACE_COLORS[mat] || "#78909c");
          const label = `${FACE_LABELS[face]}·${isMix ? 'Mix' : (SURFACE_SHORT_LABELS[mat] || mat.slice(0, 4))}`;
          const isExpanded = expandedFace === face;
          return (
            <button
              key={face}
              onClick={() => setExpandedFace(isExpanded ? null : face)}
              title={`${FACE_FULL_LABELS[face]}: ${isMix ? 'Mixed' : mat} — click to edit`}
              style={{
                padding: "3px 7px", fontSize: 10, fontWeight: 600,
                borderRadius: 5, cursor: "pointer",
                border: isExpanded ? "2px solid var(--accent, #2563eb)" : "1px solid rgba(0,0,0,0.12)",
                background: isMix
                  ? "repeating-linear-gradient(45deg, #e2e8f0, #e2e8f0 3px, #f1f5f9 3px, #f1f5f9 6px)"
                  : mat === "Open" ? "var(--input-bg, #f1f5f9)" : `${color}33`,
                color: isMix ? "#64748b" : mat === "Open" ? "var(--text-muted, #94a3b8)" : "#1e293b",
                minWidth: 48, textAlign: "center",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
        {FACE_KEYS.slice(4).map((face) => {
          const mat = faceMaterials[face];
          const isMix = mat === null;
          const color = isMix ? "#94a3b8" : (SURFACE_COLORS[mat] || "#78909c");
          const label = `${FACE_LABELS[face]}·${isMix ? 'Mix' : (SURFACE_SHORT_LABELS[mat] || mat.slice(0, 4))}`;
          const isExpanded = expandedFace === face;
          return (
            <button
              key={face}
              onClick={() => setExpandedFace(isExpanded ? null : face)}
              title={`${FACE_FULL_LABELS[face]}: ${isMix ? 'Mixed' : mat} — click to edit`}
              style={{
                padding: "3px 7px", fontSize: 10, fontWeight: 600,
                borderRadius: 5, cursor: "pointer",
                border: isExpanded ? "2px solid var(--accent, #2563eb)" : "1px solid rgba(0,0,0,0.12)",
                background: isMix
                  ? "repeating-linear-gradient(45deg, #e2e8f0, #e2e8f0 3px, #f1f5f9 3px, #f1f5f9 6px)"
                  : mat === "Open" ? "var(--input-bg, #f1f5f9)" : `${color}33`,
                color: isMix ? "#64748b" : mat === "Open" ? "var(--text-muted, #94a3b8)" : "#1e293b",
                minWidth: 48, textAlign: "center",
              }}
            >
              {label}
            </button>
          );
        })}
        {/* Right-aligned: count + save + deselect */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", fontWeight: 600 }}>
            {indices.length} sel
          </span>
          {isSingle && (
            <button
              onClick={handleSaveToLibrary}
              style={{
                background: "none", border: "1px solid var(--border, #e2e8f0)", borderRadius: 4,
                cursor: "pointer", padding: "2px 4px",
                color: "var(--text-muted, #64748b)", display: "flex", alignItems: "center",
              }}
              title="Save block to library"
            >
              <BookmarkPlus size={11} />
            </button>
          )}
          <button
            onClick={handleDeselect}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#94a3b8", padding: "0 2px" }}
            title="Deselect"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Expanded picker for selected face ── */}
      {expandedFace && (
        <div style={{
          padding: "6px 8px", background: "var(--btn-bg, #fff)",
          borderRadius: 6, border: "1px solid var(--border, #e2e8f0)",
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted, #64748b)", textTransform: "uppercase", marginBottom: 4 }}>
            {FACE_FULL_LABELS[expandedFace]} Face
            {faceMaterials[expandedFace] ? ` · ${faceMaterials[expandedFace]}` : ' · Mixed'}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {QUICK_MATERIALS.map((m) => {
              const isActive = faceMaterials[expandedFace] === m.type;
              return (
                <button
                  key={m.type}
                  onClick={() => {
                    batchSetFace(containerId, indices, expandedFace, m.type);
                  }}
                  style={{
                    padding: "3px 8px", fontSize: 10, fontWeight: 600,
                    borderRadius: 5, cursor: "pointer",
                    border: isActive ? `2px solid ${m.color}` : `1px solid ${m.color}`,
                    background: isActive ? `${m.color}44` : `${m.color}22`,
                    color: "#1e293b",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Batch shortcuts (always visible) ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div>
          <span style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginRight: 4 }}>All walls:</span>
          <span style={{ display: "inline-flex", gap: 2, flexWrap: "wrap" }}>
            {QUICK_MATERIALS.map((m) => (
              <button key={`walls-${m.type}`} onClick={() => {
                batchSetFaces(containerId, indices, { n: m.type, s: m.type, e: m.type, w: m.type });
              }} style={{
                padding: "2px 6px", fontSize: 9, fontWeight: 600,
                borderRadius: 4, cursor: "pointer",
                border: `1px solid ${m.color}`, background: `${m.color}18`, color: "#374151",
              }}>
                {m.label}
              </button>
            ))}
          </span>
        </div>
        <div>
          <span style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginRight: 4 }}>Floors:</span>
          <span style={{ display: "inline-flex", gap: 2, flexWrap: "wrap" }}>
            {[
              { type: "Deck_Wood" as SurfaceType, label: "Wood", color: "#8d6e63" },
              { type: "Concrete" as SurfaceType, label: "Concrete", color: "#9e9e9e" },
              { type: "Open" as SurfaceType, label: "Open", color: "#e2e8f0" },
            ].map((m) => (
              <button key={`floor-${m.type}`} onClick={() => {
                batchSetFaces(containerId, indices, { bottom: m.type });
              }} style={{
                padding: "2px 6px", fontSize: 9, fontWeight: 600,
                borderRadius: 4, cursor: "pointer",
                border: `1px solid ${m.color}`, background: `${m.color}18`, color: "#374151",
              }}>
                {m.label}
              </button>
            ))}
          </span>
        </div>
        <div>
          <span style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginRight: 4 }}>Ceilings:</span>
          <span style={{ display: "inline-flex", gap: 2, flexWrap: "wrap" }}>
            {[
              { type: "Solid_Steel" as SurfaceType, label: "Steel", color: "#78909c" },
              { type: "Open" as SurfaceType, label: "Open", color: "#e2e8f0" },
            ].map((m) => (
              <button key={`ceil-${m.type}`} onClick={() => {
                batchSetFaces(containerId, indices, { top: m.type });
              }} style={{
                padding: "2px 6px", fontSize: 9, fontWeight: 600,
                borderRadius: 4, cursor: "pointer",
                border: `1px solid ${m.color}`, background: `${m.color}18`, color: "#374151",
              }}>
                {m.label}
              </button>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run all tests + type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All pass, 0 type errors

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/FaceStrip.tsx src/__tests__/inspector-streamlining.test.ts
git commit -m "feat: create FaceStrip unified face editor component

Single component handles 1-N voxels with 6 face buttons, expandable
material picker, and batch shortcuts (all walls/floors/ceilings).
Shows 'Mix' with hatched fill when voxels disagree on a face."
```

---

## Task 5: Extract SURFACE_COLORS + Wire FaceStrip + Delete Old Components

**Files:**
- Modify: `src/config/surfaceLabels.ts` (add SURFACE_COLORS)
- Modify: `src/components/ui/MatrixEditor.tsx:34-55,1184-1380` (extract colors, replace tile detail)
- Delete: `src/components/ui/FaceSchematic.tsx`
- Delete: `src/components/ui/BatchFaceControls.tsx`

- [ ] **Step 1: Extract SURFACE_COLORS to surfaceLabels.ts**

In `src/config/surfaceLabels.ts`, add at the end:

```ts
/** Color mapping for each surface type — used by grid cells, face buttons, etc. */
export const SURFACE_COLORS: Record<SurfaceType, string> = {
  Open:           "transparent",
  Solid_Steel:    "#78909c",
  Glass_Pane:     "#60a5fa",
  Railing_Glass:  "#93c5fd",
  Railing_Cable:  "#607d8b",
  Deck_Wood:      "#8d6e63",
  Concrete:       "#9e9e9e",
  Half_Fold:      "#ab47bc",
  Gull_Wing:      "#7e57c2",
  Door:           "#607d8b",
  Stairs:         "#5d4037",
  Stairs_Down:    "#3e2723",
  Wood_Hinoki:    "#f5e6c8",
  Floor_Tatami:   "#c8d5a0",
  Wall_Washi:     "#f8f4ec",
  Glass_Shoji:    "#fafafa",
  Window_Standard: "#7dd3fc",
  Window_Sill:     "#93c5fd",
  Window_Clerestory: "#bfdbfe",
  Window_Half:     "#a5f3fc",
};
```

In `src/components/ui/MatrixEditor.tsx`, replace the `SURFACE_COLORS` declaration (~lines 34-55) with an import:
```ts
import { SURFACE_COLORS } from "@/config/surfaceLabels";
```

Remove the old `export const SURFACE_COLORS` block. Do NOT add a re-export — FaceSchematic is being deleted in this same task.

- [ ] **Step 2: Replace tile detail section in MatrixEditor**

In `src/components/ui/MatrixEditor.tsx`:

Add import at top:
```ts
import FaceStrip from "@/components/ui/FaceStrip";
```

Find the `CubeInspector` section (~line 1184):
```tsx
{/* ── CubeInspector — Interactive 3D Block Preview ──── */}
{(isVoxelSelected || isBaySelected) && selIdx >= 0 && (
```

Replace everything from `{/* ── CubeInspector` through the closing `</>` and `)}` of that block (which includes the Tile Detail header, Room dropdown, FaceSchematic, BatchFaceControls, and 3D Preview toggle) with:

```tsx
{/* ── FaceStrip — Unified face editor ──── */}
{(isVoxelSelected || isBaySelected) && selIdx >= 0 && (
  <>
    <div style={{ height: "1px", background: "#e2e8f0" }} />
    <FaceStrip
      containerId={containerId}
      indices={
        selectedVoxels?.containerId === containerId && selectedVoxels.indices.length > 1
          ? selectedVoxels.indices
          : [selIdx]
      }
    />
    {/* Door Configuration — single select only */}
    {isSingleVoxelSelected && selVoxel && (() => {
```

Keep the existing Door Configuration block that follows (lines ~1267-1340). It should render conditionally only when `isSingleVoxelSelected` is true. Check if this variable exists already — it likely maps to `isVoxelSelected && !isBaySelected`. If not, derive it:

```ts
const isSingleVoxelSelected = isVoxelSelected && !(selectedVoxels?.containerId === containerId && selectedVoxels.indices.length > 1);
```

Remove the old `3D Preview` collapsible section and its VoxelPreview3D usage from the tile detail area (the one below the face editor — NOT the IsoEditor preview in the sidebar which stays).

- [ ] **Step 3: Remove old imports**

In `MatrixEditor.tsx`, remove these imports (now unused):
```ts
import FaceSchematic from "@/components/ui/FaceSchematic";
import BatchFaceControls from "@/components/ui/BatchFaceControls";
```

Also remove the `VoxelPreview3D` and `GroupedVoxelPreview` imports if they're only used in the deleted tile detail section (check: IsoEditor imports VoxelPreview3D separately, so MatrixEditor's import can go).

- [ ] **Step 4: Delete FaceSchematic.tsx and BatchFaceControls.tsx**

```bash
rm src/components/ui/FaceSchematic.tsx src/components/ui/BatchFaceControls.tsx
```

- [ ] **Step 5: Update any remaining SURFACE_COLORS imports**

Check if any file still imports SURFACE_COLORS from MatrixEditor:
```bash
grep -r "from.*MatrixEditor" src/ | grep -i surface
```

If any remain, update them to import from `@/config/surfaceLabels`.

- [ ] **Step 6: Run all tests + type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All pass, 0 type errors. Some existing tests that imported FaceSchematic or BatchFaceControls may need updating — check for failures.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire FaceStrip into MatrixEditor, extract SURFACE_COLORS, delete old components

Extracts SURFACE_COLORS to surfaceLabels.ts. Replaces tile detail
section (header, room dropdown, FaceSchematic, BatchFaceControls,
3D Preview toggle) with unified FaceStrip. Door config preserved
for single-select only. Deletes FaceSchematic + BatchFaceControls."
```

---

## Task 6: Browser Verification

**Files:** None (verification only)

- [ ] **Step 1: Start dev server and open browser**

Run: `npm run dev` (or use preview tools)

- [ ] **Step 2: Verify Issue 1 — Frame opacity**

1. Load app, observe container with full walls → frame posts/beams opaque
2. Click `▄` (half walls) → walls cut down, frame posts/beams remain full height but semi-transparent
3. Click `▁` (walls down) → same semi-transparent behavior
4. Click `▮` (full walls) → frame returns to opaque
5. Verify posts are full height in all modes (no more scaling down)
6. Verify top beams always visible (no more hiding)

- [ ] **Step 3: Verify Issue 2 — Global Roof/Skin**

1. Click "Roof" button in toolbar → roof faces hidden on ALL containers
2. Click again → roof restored
3. Click "Skin" button → all voxel faces hidden, only frame visible
4. Click again → skin restored
5. Verify IsoEditor preview syncs with toolbar state (no separate controls)

- [ ] **Step 4: Verify Issue 3 — Room dropdown gone**

1. Select a voxel/bay → verify no Room dropdown appears
2. Verify tile detail area is cleaner

- [ ] **Step 5: Verify Issue 4 — FaceStrip**

1. Click a single grid cell → see 6 face buttons with material labels
2. Click a face button → expander shows material picker
3. Click a material → face updates on selected voxel
4. Click a bay group → face buttons show materials (or "Mix")
5. Use "All walls: Steel" batch shortcut → all wall faces update
6. Use "Floors: Wood" → bottom faces update
7. Verify door config still appears for single voxel with a Door face
8. Verify door config hidden in multi-select
9. Verify bookmark/save button works for single select
10. Verify ✕ deselect works

- [ ] **Step 6: Final test run**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All tests pass, 0 type errors

- [ ] **Step 7: Commit verification tag**

```bash
git tag -a inspector-streamlining-complete -m "Inspector streamlining sprint complete - 4 issues resolved, all tests pass"
```
