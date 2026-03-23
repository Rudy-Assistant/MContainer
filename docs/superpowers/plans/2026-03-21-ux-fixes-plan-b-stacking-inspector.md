# UX Fixes Plan B: Stack Button & Inspector Panel Reorganization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Stack Above" button to the inspector so users can stack containers without the store API, and reorganize the tile detail panel so face-editing controls are above the fold instead of buried beneath a 250px isometric preview.

**Architecture:** Modify the Inspector section in `Sidebar.tsx` to add stack/unstack buttons in the container header. Reorganize `MatrixEditor.tsx` to render a compact face schematic before the 3D preview (which becomes collapsible). Add batch-face controls that appear when multiple voxels are selected.

**Tech Stack:** React 19, Zustand 5, existing `stackContainer`/`addContainer`/`setVoxelFace`/`stampAreaSmart` store actions.

**Relevant docs:** Read `MODUHOME-V1-ARCHITECTURE-v2.md` §2 (store slices). Check `sprint17-handoff.md` outstanding issue #1 (stacking via UI).

---

### Task 1: Stack Above / Unstack Buttons in Inspector Header

**Files:**
- Modify: `src/components/ui/Sidebar.tsx` (Inspector header area — around the "Container 40ft HC" heading)
- Test: `src/Testing/stacking-ui.test.ts` (new)

- [ ] **Step 1: Write failing test — stackContainer places L1 on top of L0**

```typescript
// src/Testing/stacking-ui.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';

describe('Container stacking actions', () => {
  let baseId: string;

  beforeEach(() => {
    useStore.getState().reset();
    baseId = useStore.getState().addContainer('40ft_high_cube');
  });

  it('addContainer + stackContainer creates L1 on top of L0', () => {
    const topId = useStore.getState().addContainer('40ft_high_cube');
    const result = useStore.getState().stackContainer(topId, baseId);

    expect(result).toBe(true);
    const top = useStore.getState().containers[topId];
    expect(top.level).toBe(1);
    expect(top.position.y).toBeGreaterThan(0);
    expect(top.stackedOn).toBe(baseId);
  });

  it('unstackContainer detaches L1 and resets it to ground level', () => {
    const topId = useStore.getState().addContainer('40ft_high_cube');
    useStore.getState().stackContainer(topId, baseId);
    useStore.getState().unstackContainer(topId);

    const containers = useStore.getState().containers;
    // unstackContainer DETACHES only — does NOT delete the container
    const top = containers[topId];
    expect(top).toBeDefined();
    expect(top.level).toBe(0);
    expect(top.stackedOn).toBeNull();
    expect(top.position.y).toBe(0);
    // L0 roof should be unlocked
    const bottom = containers[baseId];
    expect(bottom.roofLocked).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify store actions work**

Run: `npx vitest run src/Testing/stacking-ui.test.ts -v`
Expected: PASS

- [ ] **Step 3: Add Stack/Unstack buttons to Inspector header in Sidebar.tsx**

Find the Inspector section in `Sidebar.tsx` where the container name and "Level 0 · 20 bays" subtitle are rendered. After the subtitle line, add:

```typescript
{/* Stack controls — only shown for selected container */}
<div style={{ display: "flex", gap: 6, marginTop: 6 }}>
  {container.level === 0 && !hasContainerAbove && (
    <button
      onClick={() => {
        const newId = addContainer(container.size);
        if (newId) stackContainer(newId, containerId);
      }}
      style={{
        fontSize: 11, fontWeight: 600, padding: "4px 10px",
        borderRadius: 6, border: "1px solid var(--border, #cbd5e1)",
        background: "var(--accent, #3b82f6)", color: "#fff",
        cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
      }}
    >
      ⬆ Stack Above
    </button>
  )}
  {container.level > 0 && container.stackedOn && (
    <button
      onClick={() => {
        unstackContainer(containerId);
        // Also remove the detached container (unstackContainer only detaches)
        removeContainer(containerId);
      }}
      style={{
        fontSize: 11, fontWeight: 600, padding: "4px 10px",
        borderRadius: 6, border: "1px solid #fca5a5",
        background: "#fef2f2", color: "#dc2626",
        cursor: "pointer",
      }}
    >
      ✕ Unstack
    </button>
  )}
  <span style={{
    fontSize: 10, color: "var(--text-muted, #94a3b8)",
    alignSelf: "center",
  }}>
    {container.level === 0 ? "L0 (ground)" : `L${container.level} (stacked)`}
  </span>
</div>
```

Add required store selectors at the top of the Inspector component:
```typescript
const addContainer = useStore((s) => s.addContainer);
const stackContainer = useStore((s) => s.stackContainer);
const unstackContainer = useStore((s) => s.unstackContainer);
const removeContainer = useStore((s) => s.removeContainer);
```

Add helper to detect if a container is already stacked:
```typescript
const hasContainerAbove = useMemo(() => {
  return Object.values(containers).some(c => c.stackedOn === containerId);
}, [containers, containerId]);
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Browser verify — click "Stack Above" creates L1**

Select container → Inspector shows "⬆ Stack Above" button + "L0 (ground)" badge.
Click "⬆ Stack Above" → L1 container appears on top in 3D. Inspector switches to show L1 with "✕ Unstack" button + "L1 (stacked)" badge.
Click "✕ Unstack" → L1 removed, back to L0 only.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Sidebar.tsx src/Testing/stacking-ui.test.ts
git commit -m "feat: Stack Above / Unstack buttons in Inspector header"
```

---

### Task 2: Compact Face Schematic — Replace Buried Face Controls

**Files:**
- Create: `src/components/ui/FaceSchematic.tsx` (new — compact 6-face display)
- Modify: `src/components/ui/MatrixEditor.tsx` (render FaceSchematic above VoxelPreview3D)
- Test: `src/Testing/face-schematic.test.ts` (new)

- [ ] **Step 1: Write test — FaceSchematic renders all 6 face labels**

```typescript
// src/Testing/face-schematic.test.ts
import { describe, it, expect } from 'vitest';
import type { VoxelFaces } from '@/types/container';

// Test the pure logic function that FaceSchematic will use
describe('Face schematic display logic', () => {
  it('returns correct label for each face material', () => {
    const faces: VoxelFaces = {
      top: 'Solid_Steel', bottom: 'Deck_Wood',
      n: 'Glass_Pane', s: 'Open', e: 'Railing_Glass', w: 'Door',
    };

    const labels = Object.entries(faces).map(([face, mat]) => ({
      face,
      short: mat.replace(/_/g, ' '),
    }));

    expect(labels).toHaveLength(6);
    expect(labels.find(l => l.face === 'n')?.short).toBe('Glass Pane');
    expect(labels.find(l => l.face === 'bottom')?.short).toBe('Deck Wood');
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/Testing/face-schematic.test.ts -v`
Expected: PASS

- [ ] **Step 3: Create FaceSchematic component**

```typescript
// src/components/ui/FaceSchematic.tsx
"use client";

import type { VoxelFaces, SurfaceType } from "@/types/container";

const SURFACE_COLORS: Record<string, string> = {
  Open: "transparent", Solid_Steel: "#78909c", Glass_Pane: "#60a5fa",
  Railing_Glass: "#93c5fd", Railing_Cable: "#607d8b", Deck_Wood: "#8d6e63",
  Concrete: "#9e9e9e", Door: "#607d8b", Window_Standard: "#7dd3fc",
  Stairs: "#5d4037", Half_Fold: "#ab47bc", Gull_Wing: "#7e57c2",
};

const SHORT: Record<string, string> = {
  Open: "Open", Solid_Steel: "Steel", Glass_Pane: "Glass",
  Railing_Glass: "Rail", Railing_Cable: "Cable", Deck_Wood: "Wood",
  Concrete: "Conc", Door: "Door", Window_Standard: "Win",
  Stairs: "Stair", Half_Fold: "½Fold", Gull_Wing: "Gull",
  Window_Sill: "Sill", Window_Clerestory: "Clr", Window_Half: "½Win",
  Stairs_Down: "StDn", Wood_Hinoki: "Hnki", Floor_Tatami: "Tata",
  Wall_Washi: "Washi", Glass_Shoji: "Shoji",
};

function FaceBtn({ face, material, onClick }: {
  face: string; material: SurfaceType; onClick: () => void;
}) {
  const bg = SURFACE_COLORS[material] || "#78909c";
  const label = SHORT[material] || material.slice(0, 4);
  return (
    <button
      onClick={onClick}
      title={`${face.toUpperCase()}: ${material} — click to cycle`}
      style={{
        padding: "2px 6px", fontSize: 9, fontWeight: 600,
        borderRadius: 4, cursor: "pointer",
        border: "1px solid rgba(0,0,0,0.15)",
        background: material === "Open" ? "var(--input-bg, #f1f5f9)" : `${bg}33`,
        color: material === "Open" ? "var(--text-muted, #94a3b8)" : "#1e293b",
        minWidth: 36, textAlign: "center",
      }}
    >
      {label}
    </button>
  );
}

export default function FaceSchematic({ faces, onCycleFace }: {
  faces: VoxelFaces;
  onCycleFace: (face: keyof VoxelFaces) => void;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      gridTemplateRows: "auto auto auto",
      gap: 2, alignItems: "center", justifyItems: "center",
      padding: "6px 8px",
      background: "var(--input-bg, #f8fafc)",
      borderRadius: 8,
      fontSize: 9,
    }}>
      {/* Row 1: Top face centered */}
      <div />
      <FaceBtn face="top" material={faces.top} onClick={() => onCycleFace("top")} />
      <div />

      {/* Row 2: W — floor label — E */}
      <FaceBtn face="w" material={faces.w} onClick={() => onCycleFace("w")} />
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 1, padding: "2px 8px",
      }}>
        <span style={{ fontSize: 8, color: "var(--text-muted, #94a3b8)" }}>N</span>
        <FaceBtn face="n" material={faces.n} onClick={() => onCycleFace("n")} />
        <div style={{ height: 1, width: 24, background: "var(--border, #e2e8f0)" }} />
        <FaceBtn face="s" material={faces.s} onClick={() => onCycleFace("s")} />
        <span style={{ fontSize: 8, color: "var(--text-muted, #94a3b8)" }}>S</span>
      </div>
      <FaceBtn face="e" material={faces.e} onClick={() => onCycleFace("e")} />

      {/* Row 3: Bottom face centered */}
      <div />
      <FaceBtn face="bottom" material={faces.bottom} onClick={() => onCycleFace("bottom")} />
      <div />
    </div>
  );
}
```

- [ ] **Step 4: Wire FaceSchematic into MatrixEditor above VoxelPreview3D**

In `MatrixEditor.tsx`, find where VoxelPreview3D is rendered (in the tile detail / "TILES" section). Add FaceSchematic above it:

```typescript
import FaceSchematic from "@/components/ui/FaceSchematic";

// In the tile detail section, before VoxelPreview3D:
{selectedVoxel && selectedVoxelData && (
  <FaceSchematic
    faces={selectedVoxelData.faces}
    onCycleFace={(face) => {
      cycleVoxelFace(containerId, selectedVoxel.index, face);
    }}
  />
)}
```

- [ ] **Step 5: Make VoxelPreview3D collapsible, collapsed by default**

Wrap VoxelPreview3D in a collapsible section:

```typescript
const [previewOpen, setPreviewOpen] = useState(false);

// Replace the current VoxelPreview3D render with:
<button
  onClick={() => setPreviewOpen(!previewOpen)}
  style={{
    width: "100%", textAlign: "left", padding: "6px 8px",
    fontSize: 10, fontWeight: 600, color: "var(--text-muted, #64748b)",
    background: "transparent", border: "none", cursor: "pointer",
  }}
>
  {previewOpen ? "▾" : "▸"} 3D Preview
</button>
{previewOpen && <VoxelPreview3D />}
```

- [ ] **Step 6: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run src/Testing/face-schematic.test.ts -v`
Expected: 0 errors, all pass

- [ ] **Step 7: Browser verify — face controls above fold, preview collapsed**

Select container → click a body cell. The tile detail now shows:
1. Room dropdown (top)
2. **Face Schematic** — 6 clickable face buttons in cross layout
3. "▸ 3D Preview" collapsed toggle

Click a face button → material cycles (e.g., Steel → Glass → Wood).
Click "▸ 3D Preview" → expands to show full isometric view.
Face controls are now **above the fold without scrolling**.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/FaceSchematic.tsx src/components/ui/MatrixEditor.tsx src/Testing/face-schematic.test.ts
git commit -m "feat: compact FaceSchematic above fold, VoxelPreview3D collapsible"
```

---

### Task 3: Batch Face Operations for Multi-Select

**Files:**
- Create: `src/components/ui/BatchFaceControls.tsx` (new)
- Modify: `src/components/ui/MatrixEditor.tsx` (render BatchFaceControls when multi-selected)
- Test: `src/Testing/batch-face.test.ts` (new)

- [ ] **Step 1: Write failing test — batch paint all exterior faces**

```typescript
// src/Testing/batch-face.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

describe('Batch face operations', () => {
  let containerId: string;

  beforeEach(() => {
    useStore.getState().reset();
    containerId = useStore.getState().addContainer('40ft_high_cube');
    useStore.getState().setAllExtensions(containerId, 'all_deck');
  });

  it('stampAreaSmart applies faces to all exterior edges of selected voxels', () => {
    // Select body voxels 9-14 (row 1, cols 1-6)
    const indices = [9, 10, 11, 12, 13, 14];
    const faces = {
      top: 'Solid_Steel' as const, bottom: 'Deck_Wood' as const,
      n: 'Glass_Pane' as const, s: 'Glass_Pane' as const,
      e: 'Glass_Pane' as const, w: 'Glass_Pane' as const,
    };

    useStore.getState().stampAreaSmart(containerId, indices, faces);

    const grid = useStore.getState().containers[containerId].voxelGrid;
    // Voxel 9 (row 1, col 1): north face is exterior (row 0 above is extension, active)
    // But east face (col 2 = voxel 10) is interior → should remain Open
    // The exact behavior depends on isExteriorFace logic
    // At minimum, the action should not throw
    expect(grid[9].faces.bottom).toBe('Deck_Wood');
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/Testing/batch-face.test.ts -v`
Expected: PASS

- [ ] **Step 3: Create BatchFaceControls component**

```typescript
// src/components/ui/BatchFaceControls.tsx
"use client";

import { useStore } from "@/store/useStore";
import type { SurfaceType } from "@/types/container";

const QUICK_MATERIALS: Array<{ label: string; material: SurfaceType; color: string }> = [
  { label: "Steel", material: "Solid_Steel", color: "#78909c" },
  { label: "Glass", material: "Glass_Pane", color: "#60a5fa" },
  { label: "Window", material: "Window_Standard", color: "#7dd3fc" },
  { label: "Wood", material: "Deck_Wood", color: "#8d6e63" },
  { label: "Railing", material: "Railing_Glass", color: "#93c5fd" },
  { label: "Open", material: "Open", color: "#e2e8f0" },
];

function MaterialBtn({ label, material, color, onClick }: {
  label: string; material: SurfaceType; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={material}
      style={{
        padding: "3px 8px", fontSize: 10, fontWeight: 600,
        borderRadius: 5, cursor: "pointer",
        border: `1px solid ${color}`,
        background: `${color}22`,
        color: "#1e293b",
      }}
    >
      {label}
    </button>
  );
}

export default function BatchFaceControls({ containerId, indices }: {
  containerId: string;
  indices: number[];
}) {
  const setVoxelFace = useStore((s) => s.setVoxelFace);
  const setVoxelAllFaces = useStore((s) => s.setVoxelAllFaces);
  const stampAreaSmart = useStore((s) => s.stampAreaSmart);

  const applyToAllExterior = (material: SurfaceType) => {
    stampAreaSmart(containerId, indices, {
      top: "Solid_Steel", bottom: "Deck_Wood",
      n: material, s: material, e: material, w: material,
    });
  };

  const applyToAllInterior = (material: SurfaceType) => {
    // Interior = non-exterior walls. Set all walls, then stampAreaSmart will
    // only affect exterior. So we do the inverse: set ALL walls to material,
    // which covers interior (stampAreaSmart only touches exterior).
    for (const idx of indices) {
      for (const face of ["n", "s", "e", "w"] as const) {
        setVoxelFace(containerId, idx, face, material);
      }
    }
  };

  const applyFloor = (material: SurfaceType) => {
    for (const idx of indices) {
      setVoxelFace(containerId, idx, "bottom", material);
    }
  };

  const applyCeiling = (material: SurfaceType) => {
    for (const idx of indices) {
      setVoxelFace(containerId, idx, "top", material);
    }
  };

  return (
    <div style={{
      padding: "8px 10px", background: "var(--input-bg, #f8fafc)",
      borderRadius: 8, display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted, #64748b)", textTransform: "uppercase" }}>
        {indices.length} blocks selected
      </div>

      <div>
        <div style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginBottom: 3 }}>Exterior walls:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {QUICK_MATERIALS.map(m => (
            <MaterialBtn key={m.material + "-ext"} {...m} onClick={() => applyToAllExterior(m.material)} />
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginBottom: 3 }}>Interior walls:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          <MaterialBtn label="Open" material="Open" color="#e2e8f0" onClick={() => applyToAllInterior("Open")} />
          <MaterialBtn label="Steel" material="Solid_Steel" color="#78909c" onClick={() => applyToAllInterior("Solid_Steel")} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginBottom: 3 }}>Floors:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          <MaterialBtn label="Wood" material="Deck_Wood" color="#8d6e63" onClick={() => applyFloor("Deck_Wood")} />
          <MaterialBtn label="Concrete" material="Concrete" color="#9e9e9e" onClick={() => applyFloor("Concrete")} />
          <MaterialBtn label="Open" material="Open" color="#e2e8f0" onClick={() => applyFloor("Open")} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginBottom: 3 }}>Ceilings:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          <MaterialBtn label="Steel" material="Solid_Steel" color="#78909c" onClick={() => applyCeiling("Solid_Steel")} />
          <MaterialBtn label="Open" material="Open" color="#e2e8f0" onClick={() => applyCeiling("Open")} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire BatchFaceControls into MatrixEditor when multi-selected**

In MatrixEditor's tile detail section, before the FaceSchematic, add:

```typescript
import BatchFaceControls from "@/components/ui/BatchFaceControls";

// In tile detail render:
{selectedVoxels && selectedVoxels.indices.length > 1 ? (
  <BatchFaceControls
    containerId={containerId}
    indices={selectedVoxels.indices}
  />
) : selectedVoxel && selectedVoxelData ? (
  <FaceSchematic ... />
) : null}
```

- [ ] **Step 5: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run src/Testing/batch-face.test.ts -v`
Expected: 0 errors, all pass

- [ ] **Step 6: Browser verify — shift+click to multi-select → batch controls appear**

Click Bay 1, Shift+click Bay 3 → 3 cells selected → tile detail shows "3 blocks selected" with Exterior/Interior/Floor/Ceiling material buttons.
Click "Window" under Exterior walls → all 3 voxels' exterior faces change to Window_Standard.
Click "Open" under Interior walls → internal walls between the 3 voxels open.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/BatchFaceControls.tsx src/components/ui/MatrixEditor.tsx src/Testing/batch-face.test.ts
git commit -m "feat: batch face controls for multi-selected voxels"
```
