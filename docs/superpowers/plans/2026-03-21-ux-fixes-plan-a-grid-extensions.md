# UX Fixes Plan A: Grid Cell Activation & Extension Deployment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users activate/deactivate extension voxels from the 2D grid and deploy all extensions in one click.

**Architecture:** Add click-to-activate behavior on inactive grid cells in `MatrixEditor.tsx`, and add a "Deploy All" dropdown menu to the Container Grid section header. Inactive cells currently call `onSelect` on click but do nothing useful — we'll add `setVoxelActive` on click when inactive. The "Deploy All" dropdown calls `setAllExtensions` with preconfigured `ExtensionConfig` values.

**Tech Stack:** React 19, Zustand 5, existing `setVoxelActive` / `setAllExtensions` store actions.

**Relevant docs:** Read `MODUHOME-V1-ARCHITECTURE-v2.md` §4 (voxel data model), `src/config/bayGroups.ts` for extension zone definitions.

---

### Task 1: Click-to-Activate Inactive Grid Cells

**Files:**
- Modify: `src/components/ui/MatrixEditor.tsx:64-252` (GridCell component)
- Modify: `src/components/ui/MatrixEditor.tsx:254-460` (VoxelGrid — pass new prop)
- Test: `src/Testing/grid-activation.test.ts` (new)

- [ ] **Step 1: Write failing test — clicking inactive cell activates it**

```typescript
// src/Testing/grid-activation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';

describe('Grid cell activation', () => {
  let containerId: string;

  beforeEach(() => {
    useStore.getState().reset();
    containerId = useStore.getState().addContainer('40ft_high_cube');
  });

  it('setVoxelActive activates an inactive extension voxel', () => {
    const grid = useStore.getState().containers[containerId].voxelGrid;
    // Index 0 = NW Corner (row 0, col 0) — extension, should be inactive by default
    expect(grid[0].active).toBe(false);

    useStore.getState().setVoxelActive(containerId, 0, true);

    const updated = useStore.getState().containers[containerId].voxelGrid;
    expect(updated[0].active).toBe(true);
  });

  it('setVoxelActive deactivates an active body voxel', () => {
    const grid = useStore.getState().containers[containerId].voxelGrid;
    // Index 9 = Bay 1 (row 1, col 1) — body/core, should be active by default
    expect(grid[9].active).toBe(true);

    useStore.getState().setVoxelActive(containerId, 9, false);

    const updated = useStore.getState().containers[containerId].voxelGrid;
    expect(updated[9].active).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (store actions already exist)**

Run: `npx vitest run src/Testing/grid-activation.test.ts -v`
Expected: PASS (setVoxelActive already works — this test confirms the store foundation)

- [ ] **Step 3: Add `onActivate` callback to GridCell props**

In `src/components/ui/MatrixEditor.tsx`, add to the GridCell props interface (after line 107):

```typescript
  onActivate: () => void;
```

- [ ] **Step 4: Wire click handler — activate on click when inactive**

In GridCell's `<button>` onClick handler (line 155), replace:
```typescript
onClick={(e) => onSelect(e)}
```
with:
```typescript
onClick={(e) => {
  if (!active) {
    onActivate();
    return;
  }
  onSelect(e);
}}
```

- [ ] **Step 5: Add visual affordance — "+" icon on inactive non-core cells**

After the lock indicator (line 192), add:
```typescript
{!active && !isCore && (
  <div style={{
    position: "absolute", inset: 0, display: "flex",
    alignItems: "center", justifyContent: "center",
    fontSize: 14, color: "var(--text-muted, #94a3b8)",
    pointerEvents: "none", opacity: 0.6,
  }}>
    +
  </div>
)}
```

- [ ] **Step 6: Pass onActivate from VoxelGrid to GridCell**

In VoxelGrid's render loop where GridCell is created, add the `onActivate` prop. Find where `<GridCell` is rendered (around line 480+) and add:

```typescript
onActivate={() => {
  const s = useStore.getState();
  s.setVoxelActive(containerId, cell.voxelIndex, true);
  // Also select the newly activated cell
  s.setSelectedVoxel({ containerId, index: cell.voxelIndex });
}}
```

Note: `setVoxelActive` must be read from the store. Add this selector near the other store reads in VoxelGrid (around line 265):
```typescript
const setVoxelActive = useStore((s) => s.setVoxelActive);
```

- [ ] **Step 7: Update title tooltip for inactive cells**

In GridCell, update the `title` attribute (line 175). Change `(empty)` to `(click to deploy)`:
```typescript
title={`Block [C${voxelIndex % VOXEL_COLS}, R${...}]${active ? "" : " (click to deploy)"}${isLocked ? " locked" : ""}`}
```

- [ ] **Step 8: Run tests + type check**

Run: `npx tsc --noEmit && npx vitest run src/Testing/grid-activation.test.ts -v`
Expected: 0 type errors, all tests pass

- [ ] **Step 9: Browser verify — click an inactive extension cell, confirm it turns active**

Open app, click container to select, scroll to Container Grid. Click "NW Corner" (light gray cell). Verify:
- Cell turns dark (active color)
- Cell is now selected (blue border)
- "+" icon disappears
- 3D canvas shows the new extension voxel

- [ ] **Step 10: Commit**

```bash
git add src/components/ui/MatrixEditor.tsx src/Testing/grid-activation.test.ts
git commit -m "feat: click-to-activate extension cells in Container Grid"
```

---

### Task 2: "Deploy All" Dropdown in Container Grid Header

**Files:**
- Modify: `src/components/ui/MatrixEditor.tsx` (MatrixEditor header section)
- Modify: `src/Testing/grid-activation.test.ts` (add tests)

- [ ] **Step 1: Write failing test — setAllExtensions deploys all extensions**

Add to `src/Testing/grid-activation.test.ts`:

```typescript
describe('Deploy All Extensions', () => {
  it('setAllExtensions("all_deck") activates all 20 extension voxels on L0', () => {
    const s = useStore.getState();
    s.setAllExtensions(containerId, 'all_deck');

    const grid = useStore.getState().containers[containerId].voxelGrid;
    // Extension indices on L0: 0-7 (row 0), 8 (row 1 col 0), 15 (row 1 col 7),
    // 16 (row 2 col 0), 23 (row 2 col 7), 24-31 (row 3)
    const extIndices = [0,1,2,3,4,5,6,7, 8, 15, 16, 23, 24,25,26,27,28,29,30,31];
    for (const i of extIndices) {
      expect(grid[i].active).toBe(true);
    }
  });

  it('setAllExtensions("none") deactivates all extension voxels', () => {
    const s = useStore.getState();
    s.setAllExtensions(containerId, 'all_deck');
    s.setAllExtensions(containerId, 'none');

    const grid = useStore.getState().containers[containerId].voxelGrid;
    const extIndices = [0,1,2,3,4,5,6,7, 8, 15, 16, 23, 24,25,26,27,28,29,30,31];
    for (const i of extIndices) {
      expect(grid[i].active).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify store actions work**

Run: `npx vitest run src/Testing/grid-activation.test.ts -v`
Expected: PASS

- [ ] **Step 3: Add Deploy dropdown to MatrixEditor header**

Find the `CONTAINER GRID` section header in MatrixEditor (search for "Container Grid" or section header rendering). Add a dropdown button next to it. Create a local state `deployMenuOpen` and render a dropdown with options:

```typescript
const [deployMenuOpen, setDeployMenuOpen] = useState(false);

// In the section header area, add alongside the existing heading:
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
  <SectionHeader>Container Grid</SectionHeader>
  <div style={{ position: "relative" }}>
    <button
      onClick={() => setDeployMenuOpen(!deployMenuOpen)}
      style={{
        fontSize: 10, fontWeight: 600, padding: "3px 8px",
        borderRadius: 6, border: `1px solid var(--border, #cbd5e1)`,
        background: "var(--btn-bg, #fff)", cursor: "pointer",
        color: "var(--text-muted, #64748b)",
      }}
    >
      Deploy ▾
    </button>
    {deployMenuOpen && (
      <div style={{
        position: "absolute", top: "100%", right: 0, zIndex: 30,
        background: "var(--bg-panel, #fff)", borderRadius: 8,
        border: `1px solid var(--border, #e2e8f0)`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        minWidth: 160, marginTop: 4, overflow: "hidden",
      }}>
        {([
          { label: "All Extensions", config: "all_deck" as const },
          { label: "All + Interior Walls", config: "all_interior" as const },
          { label: "North Decks", config: "north_deck" as const },
          { label: "South Decks", config: "south_deck" as const },
          { label: "Retract All", config: "none" as const },
        ]).map(item => (
          <button
            key={item.config}
            onClick={() => {
              setAllExtensions(containerId, item.config);
              setDeployMenuOpen(false);
            }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "8px 12px", border: "none", cursor: "pointer",
              background: "transparent", fontSize: 12, fontWeight: 500,
              color: item.config === "none" ? "#ef4444" : "var(--text-main, #1e293b)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--input-bg, #f1f5f9)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {item.label}
          </button>
        ))}
      </div>
    )}
  </div>
</div>
```

Note: `setAllExtensions` must be read from the store. Add this selector:
```typescript
const setAllExtensions = useStore((s) => s.setAllExtensions);
```

- [ ] **Step 4: Close dropdown on outside click**

Add an effect to close the menu when clicking outside:
```typescript
useEffect(() => {
  if (!deployMenuOpen) return;
  const handleClickOutside = () => setDeployMenuOpen(false);
  document.addEventListener('click', handleClickOutside, { once: true });
  return () => document.removeEventListener('click', handleClickOutside);
}, [deployMenuOpen]);
```

- [ ] **Step 5: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run src/Testing/grid-activation.test.ts -v`
Expected: 0 errors, all pass

- [ ] **Step 6: Browser verify — open Deploy dropdown, click "All Extensions"**

Click container → scroll to Container Grid → click "Deploy ▾" button → click "All Extensions". Verify:
- All 20 extension cells turn dark (active)
- 3D canvas shows extensions deployed
- Click "Retract All" → all extensions deactivate
- BOM updates accordingly

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/MatrixEditor.tsx src/Testing/grid-activation.test.ts
git commit -m "feat: Deploy All dropdown for batch extension activation"
```

---

### Task 3: Right-Click Context Menu on Grid Cells

**Files:**
- Modify: `src/components/ui/MatrixEditor.tsx:64-252` (GridCell — add onContextMenu)
- Modify: `src/components/ui/MatrixEditor.tsx:254-460` (VoxelGrid — pass handler)
- Test: `src/Testing/grid-activation.test.ts` (add tests)

- [ ] **Step 1: Write test for context menu store actions**

Add to `src/Testing/grid-activation.test.ts`:

```typescript
describe('Grid context menu actions', () => {
  it('setVoxelAllFaces paints all 6 faces of a voxel', () => {
    const s = useStore.getState();
    s.setVoxelActive(containerId, 0, true);
    s.setVoxelAllFaces(containerId, 0, 'Glass_Pane');

    const v = useStore.getState().containers[containerId].voxelGrid[0];
    expect(v.faces.n).toBe('Glass_Pane');
    expect(v.faces.s).toBe('Glass_Pane');
    expect(v.faces.e).toBe('Glass_Pane');
    expect(v.faces.w).toBe('Glass_Pane');
    expect(v.faces.top).toBe('Glass_Pane');
    expect(v.faces.bottom).toBe('Glass_Pane');
  });

  it('copyVoxel + pasteVoxel applies source faces to target', () => {
    const s = useStore.getState();
    // Set up source voxel with custom faces
    s.setVoxelFace(containerId, 9, 'n', 'Glass_Pane');
    s.copyVoxel(containerId, 9);
    s.pasteVoxel(containerId, 10);

    const target = useStore.getState().containers[containerId].voxelGrid[10];
    expect(target.faces.n).toBe('Glass_Pane');
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/Testing/grid-activation.test.ts -v`
Expected: PASS (store actions already exist — verifying they work as expected)

- [ ] **Step 3: Add onContextMenu handler to GridCell**

In GridCell's `<button>` element (line 153), add:
```typescript
onContextMenu={(e) => {
  e.preventDefault();
  onContextMenu(e, voxelIndex);
}}
```

Add `onContextMenu` to GridCell's props:
```typescript
onContextMenu: (e: React.MouseEvent, voxelIndex: number) => void;
```

- [ ] **Step 4: Add context menu state + renderer in VoxelGrid**

In VoxelGrid, add local state for the context menu:
```typescript
const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; idx: number } | null>(null);
const setVoxelActive = useStore((s) => s.setVoxelActive);
const setVoxelAllFaces = useStore((s) => s.setVoxelAllFaces);
const copyVoxel = useStore((s) => s.copyVoxel);
const pasteVoxel = useStore((s) => s.pasteVoxel);

const handleContextMenu = useCallback((e: React.MouseEvent, idx: number) => {
  setCtxMenu({ x: e.clientX, y: e.clientY, idx });
}, []);
```

Add close-on-outside-click effect:
```typescript
useEffect(() => {
  if (!ctxMenu) return;
  const close = () => setCtxMenu(null);
  document.addEventListener('click', close, { once: true });
  return () => document.removeEventListener('click', close);
}, [ctxMenu]);
```

Render context menu after the grid `</div>`:
```typescript
{ctxMenu && (() => {
  const v = voxelGrid[ctxMenu.idx];
  const isActive = v?.active ?? false;
  return (
    <div style={{
      position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 100,
      background: "var(--bg-panel, #fff)", borderRadius: 8,
      border: "1px solid var(--border, #e2e8f0)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      minWidth: 160, overflow: "hidden",
    }}>
      <button onClick={() => { setVoxelActive(containerId, ctxMenu.idx, !isActive); setCtxMenu(null); }}
        style={ctxMenuItemStyle}>
        {isActive ? "Deactivate" : "Activate"}
      </button>
      {isActive && <>
        <div style={{ height: 1, background: "var(--border, #e2e8f0)" }} />
        <button onClick={() => { setVoxelAllFaces(containerId, ctxMenu.idx, 'Glass_Pane'); setCtxMenu(null); }}
          style={ctxMenuItemStyle}>Set All → Glass</button>
        <button onClick={() => { setVoxelAllFaces(containerId, ctxMenu.idx, 'Solid_Steel'); setCtxMenu(null); }}
          style={ctxMenuItemStyle}>Set All → Steel</button>
        <button onClick={() => { setVoxelAllFaces(containerId, ctxMenu.idx, 'Open'); setCtxMenu(null); }}
          style={ctxMenuItemStyle}>Set All → Open</button>
        <div style={{ height: 1, background: "var(--border, #e2e8f0)" }} />
        <button onClick={() => { copyVoxel(containerId, ctxMenu.idx); setCtxMenu(null); }}
          style={ctxMenuItemStyle}>Copy Style</button>
        <button onClick={() => { pasteVoxel(containerId, ctxMenu.idx); setCtxMenu(null); }}
          style={ctxMenuItemStyle}>Paste Style</button>
      </>}
    </div>
  );
})()}
```

Add constant for menu item styling:
```typescript
const ctxMenuItemStyle: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left",
  padding: "7px 12px", border: "none", cursor: "pointer",
  background: "transparent", fontSize: 12, color: "var(--text-main, #1e293b)",
};
```

- [ ] **Step 5: Pass onContextMenu prop from VoxelGrid to GridCell**

Where GridCell is rendered, add:
```typescript
onContextMenu={handleContextMenu}
```

- [ ] **Step 6: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run src/Testing/grid-activation.test.ts -v`
Expected: 0 errors, all pass

- [ ] **Step 7: Browser verify — right-click grid cell → context menu appears**

Right-click an active cell → menu shows "Deactivate", "Set All → Glass", etc.
Right-click an inactive cell → menu shows "Activate" only.
Click "Set All → Glass" → cell turns blue, 3D updates.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/MatrixEditor.tsx src/Testing/grid-activation.test.ts
git commit -m "feat: right-click context menu on grid cells for quick actions"
```
