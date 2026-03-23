# Sprint: UI Interaction Redesign — Bottom Bar + Context-Aware Selection

## Brainstorm Prompt

```
/brainstorming We need to redesign the ModuHome bottom bar and fix context-aware selection. There are 5 interrelated problems:

1. **Bottom bar overlaps left sidebar** — The form picker strip (BottomPanel.tsx) is position:fixed centered at bottom, ignoring the 384px sidebar. It must offset left by sidebar width when sidebar is visible.

2. **Bottom bar category tabs should be icons, not text** — Currently "Doors" "Windows" "Lights" "Elec" as text pills. Should be small icons (e.g. lucide Door/Window/Lightbulb/Plug) with hover tooltips, positioned as a vertical column or horizontal strip ABOVE the card row.

3. **Form cards need visual previews** — Currently just text names + cost dots. Need thumbnail silhouettes showing what the form actually looks like. Options: procedural SVG silhouettes per category, canvas-rendered 3D thumbnails, or static PNG sprites.

4. **Preview and Grid default visibility** — Inspector icon toggles for Preview (IsoEditor) and Grid (MatrixEditor) should default to collapsed=true. Currently the store defaults may still be false.

5. **Context-aware selection is completely broken** — This is the big one. When a user clicks:
   - A wall face → left panel should show WallTypePicker + material options for that face
   - A floor face → left panel should show floor material options
   - A placed SceneObject (door/window/light) → left panel should show SkinEditor for that object
   - The bottom bar should highlight the relevant category when a SceneObject is selected
   - Empty space → deselect, show default Container Properties

   Currently none of this works because the Form+Skin system (sceneObjectSlice) was added alongside the old wall/face selection system (WallTypePicker, FinishesPanel) but they don't talk to each other. The `useSelectionTarget()` hook in the Sidebar drives WallTypePicker/FinishesPanel based on voxel/face selection, but SceneObject selection uses a separate `selectedObjectId` in uiSlice.

Read these files to understand the current state:
- src/components/ui/Sidebar.tsx (1003 lines — Inspector component, line 325+)
- src/components/ui/BottomPanel.tsx (213 lines — thin form picker)
- src/hooks/useSelectionTarget.ts (selection target hook)
- src/store/slices/uiSlice.ts (selectedObjectId, activePlacementFormId, placementMode)
- src/store/slices/selectionSlice.ts (voxel/face/bay selection)
- src/components/ui/WallTypePicker.tsx (wall material assignment)
- src/components/ui/FinishesPanel.tsx (surface finish assignment)
- src/components/ui/IsoEditor.tsx (3D container preview)
- src/components/ui/MatrixEditor.tsx (2D bay grid editor)

The goal: a unified selection model where clicking anything in the 3D viewport updates BOTH the left panel content AND the bottom bar state coherently.
```

## Current State (as of commit 7e19e8b)

### What works
- Bottom bar renders 4 category text pills + horizontal form card row
- Cards click to enter placement mode (activePlacementFormId in store)
- Inspector header is compact (name + icon row)
- IsoEditor and MatrixEditor toggle via icon buttons
- WallTypePicker appears when a voxel/bay is selected
- FinishesPanel appears when a face is selected
- SceneObjects can be placed via the placement flow

### What's broken
- Bottom bar overlaps sidebar (position:fixed, no sidebar-awareness)
- Category tabs are text, not icons
- Form cards have no visual preview (just truncated names)
- Selecting a placed SceneObject doesn't show SkinEditor anywhere
- Selecting a voxel doesn't change the bottom bar
- No visual feedback linking 3D selection to panel content
- Preview/Grid may not default to collapsed in store

### Key Files

| File | Lines | Role |
|------|-------|------|
| `src/components/ui/BottomPanel.tsx` | 213 | Thin form picker strip |
| `src/components/ui/Sidebar.tsx` | ~1003 | Library/Inspector left panel |
| `src/hooks/useSelectionTarget.ts` | ~80 | Derives selection type from store |
| `src/store/slices/uiSlice.ts` | ~200 | UI state (selectedObjectId, placementMode) |
| `src/store/slices/selectionSlice.ts` | ~300 | Voxel/face/bay selection |
| `src/components/ui/WallTypePicker.tsx` | ~400 | Wall material buttons |
| `src/components/ui/FinishesPanel.tsx` | ~300 | Surface finish dropdowns |
| `src/store/slices/sceneObjectSlice.ts` | ~350 | SceneObject CRUD |
| `src/types/sceneObject.ts` | ~100 | Form+Skin type definitions |

### Architecture Constraints
- Store: zustand v5, immer inner → zundo → persist outer
- Selectors: atomic only (never subscribe to entire store)
- R3F: frameloop="demand" with invalidate()
- Anti-patterns: no derived objects in selectors without useShallow
- Test: 664 vitest tests must continue passing
