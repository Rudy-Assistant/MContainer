# Handoff Prompt: Block/Bay Tabs + Gizmo Fix

Copy this entire prompt into a new Claude Code chat session.

---

## Context

Read the sprint handoff at `~/.claude/projects/C--MHome/memory/sprint-finishes-panel-handoff.md` for full context on what was just completed. Key facts:

- **FinishesPanel redesign is complete** — tabbed layout with VoxelPreview3D face selector, texture swatches, Open wall fix. All in `src/components/ui/finishes/`.
- **Toolbar migration is complete** — $cost, clock TOD, compass moved to TopToolbar as frameless hover-colored items. BottomDock and SidebarBOMFooter removed.
- **700/700 tests passing**, 0 type errors.

## Task: Block/Bay Tabs + Gizmo Fix

### 1. Block/Bay Tabs (Primary)

The radial context menu icons floating over the 3D canvas when a voxel is right-clicked should be **moved into the left panel as new tabs** in the FinishesPanel:

**Current state:** Right-clicking a voxel shows `VoxelContextMenu.tsx` (radial floating menu with icons for delete, duplicate, lock, stack, rotate, etc.). Right-clicking a bay shows `BayContextMenu.tsx`.

**Target state:** The FinishesPanel tab bar becomes:
```
Flooring | Walls | Ceiling | Electrical | Block | Bay
```

- **Block tab** — visible when a single voxel is selected (target.type === 'voxel' or 'face'). Contains voxel-level configuration actions currently in `VoxelContextMenu.tsx`: delete voxel, duplicate, lock, stack above/below, rotate, copy configuration.
- **Bay tab** — visible when a bay group is selected (target.type === 'bay' or 'bay-face'). Contains bay-level operations currently in `BayContextMenu.tsx`: group/ungroup, bay-wide material application, resize bay.
- After migration, **remove the radial floating menus from the canvas** entirely.
- Block/Bay tabs should be accessible regardless of face selection (they're about the voxel/bay itself, not a specific face).

**Files to read first:**
- `src/components/ui/VoxelContextMenu.tsx` — current radial menu actions
- `src/components/ui/BayContextMenu.tsx` — current bay menu actions
- `src/components/ui/finishes/FinishesPanel.tsx` — the shell that routes to tabs
- `src/components/ui/finishes/FinishesTabBar.tsx` — the tab bar component
- `src/components/ui/Sidebar.tsx` — routing that shows FinishesPanel

### 2. Custom Gizmo (Secondary)

User wants the 3D orientation gizmo to show: **+Y up, ±X horizontal, ±Z horizontal, NO -Y** (viewing from underground is unreasonable). Currently drei's `GizmoViewport` with `hideNegativeAxes` is all-or-nothing.

**Previous attempt failed:** A custom `OrientationGizmo.tsx` in `src/components/three/` crashed the R3F scene with `ReferenceError: OrientationGizmo is not defined` — webpack module resolution issue with new files.

**Approach to try:** Instead of a separate file, define the custom gizmo **inline in Scene.tsx** or use `next/dynamic` with SSR disabled. The gizmo should:
- Show 5 axis arms: +Y, +X, -X, +Z, -Z (no -Y)
- All grey (#94a3b8), no labels
- Dots at axis endpoints that brighten on hover
- Click a dot to snap camera to that view direction
- Lines connect through center (forming a cross on the ground plane + vertical)

**File:** `src/components/three/Scene.tsx` lines ~1403-1414 (GizmoHelper section)

### 3. Design Principle

The user's vision is that the left panel should be the **single control surface** for all voxel/bay configuration. The 3D canvas should be clean — no floating menus, no radial popups. Actions flow through: select in 3D → configure in left panel.
