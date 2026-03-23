# Bottom Bar & Context-Aware Selection Redesign

**Date:** 2026-03-23
**Status:** Design
**Scope:** BottomPanel layout/visuals, unified selection model, SkinEditor sidebar integration

---

## Problem Statement

Five interrelated issues prevent coherent interaction between the 3D viewport, left sidebar, and bottom bar:

1. **Bottom bar overlaps sidebar** — `BottomPanel.tsx` uses `position: fixed; left: 50%; transform: translateX(-50%)`, centering on the full viewport instead of the canvas area to the right of the 384px sidebar.
2. **Category tabs are text pills** — "Doors", "Windows", "Lights", "Elec" as plain text. Should be icon buttons with hover tooltips.
3. **Form cards lack visual previews** — Text name + cost dots only. Need thumbnail silhouettes.
4. **Inspector preview/grid default open** — `previewCollapsed` and `gridCollapsed` default to `false` in `uiSlice.ts`, cluttering the Inspector on first selection.
5. **Selection systems are disconnected** — Voxel/face selection (`selectedVoxel`, `selectedFace`, `useSelectionTarget()`) and SceneObject selection (`selectedObjectId`) are independent atoms with no mutual exclusion and no cross-communication. The SkinEditor floats as a separate fixed panel overlapping the sidebar.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Selection model | Merged with mutual exclusion | Same user-visible behavior as a unified union, but surgical changes — existing consumers untouched. Additive path to unified union later. |
| Bottom bar ↔ selection | Auto-sync category to selected object | Tight feedback loop: click a door → bar switches to Doors, highlights that form. |
| Form thumbnails | Procedural SVG silhouettes | Crisp at any size, zero loading, tiny bundle, tints with card state. |
| Category tab layout | Icon row above card strip | Tabs above content — clean visual hierarchy, frees horizontal space for cards. |

---

## Section 1: Unified Selection Model

### 1.1 Store Changes (uiSlice.ts)

Enforce mutual exclusion by modifying three existing actions:

**`selectObject(id)`** — add clearing of voxel selection:
```ts
selectObject: (id) => set({
  selectedObjectId: id,
  selectedVoxel: null,
  selectedFace: null,
  selectedVoxels: null,
}),
```

**`selectVoxel(...)` / `selectBay(...)`** — add clearing of object selection:
```ts
// Inside each action that sets selectedVoxel or selectedVoxels:
selectedObjectId: null,
```

**`clearSelection()`** — add clearing of object selection:
```ts
// Add to existing clearSelection logic:
selectedObjectId: null,
```

No new state atoms. No new types.

### 1.2 Sidebar Routing (Sidebar.tsx → Inspector)

The Inspector's contextual area currently routes:
```
voxel | bay       → WallTypePicker
face | bay-face   → FinishesPanel
else              → Container Properties
```

Add one check with **first priority**:
```
selectedObjectId  → SkinEditor          ← NEW
voxel | bay       → WallTypePicker
face | bay-face   → FinishesPanel
else              → Container Properties
```

Implementation: read `selectedObjectId` from the store inside Inspector, check before `useSelectionTarget()` routing.

### 1.3 SkinEditor Refactor (SkinEditor.tsx)

Move from floating overlay to inline Sidebar child:

- **Remove:** `position: fixed`, `top: 60`, `left: 12`, `zIndex: 100` from `panelStyle`
- **Remove:** Close button (`✕` that calls `selectObject(null)`)
- **Keep:** All functional logic unchanged — skin slots, quick skins, door/light controls, duplicate/remove actions
- **Deselection** now handled by: canvas `onPointerMissed`, "← Library" button, `Escape` hotkey — all call `clearSelection()` which now clears `selectedObjectId`

### 1.4 3D Click Handler (ContainerSkin.tsx)

In the click handler, after placement intercept returns false, before default selection mode:

1. Check if the clicked voxel face has an occupied SceneObject slot
2. If yes: call `selectObject(objectId)` — mutual exclusion clears voxel selection
3. If no: existing behavior — `selectVoxel()` which now clears `selectedObjectId`

Detection: iterate `sceneObjects` to find one whose `anchor.containerId`, `anchor.voxelIndex`, and `anchor.face` match the click target. This is a small linear scan over typically < 20 objects.

### 1.5 Data Flow

```
Click placed door in 3D
  → ContainerSkin detects occupied slot → door-uuid-123
  → store.selectObject('door-uuid-123')
    → selectedObjectId = 'door-uuid-123'
    → selectedVoxel = null, selectedFace = null, selectedVoxels = null
  → Sidebar re-renders:
    → selectedObjectId truthy → <SkinEditor />
  → BottomPanel re-renders:
    → reads selectedObjectId → looks up formId → auto-switches category to 'door'

Click empty wall face in 3D
  → store.selectVoxel({...}) + store.selectFace('n')
    → selectedObjectId = null
  → Sidebar: target.type='face' → <FinishesPanel />
  → BottomPanel: no object selected, stays on current category

Click empty space (onPointerMissed)
  → store.clearSelection() → everything nulled
  → Sidebar → Container Properties (or Library if no container)
  → BottomPanel → stays on last manual category
```

---

## Section 2: Bottom Bar Redesign

### 2.1 Sidebar-Aware Positioning (BottomPanel.tsx)

Read `sidebarCollapsed` from the store. Compute centering offset:

```
sidebarWidth = sidebarCollapsed ? 48 : 384
canvasCenter = sidebarWidth + (viewportWidth - sidebarWidth) / 2
```

Apply: `left: canvasCenter` with `transform: translateX(-50%)`.

The bar centers over the 3D canvas area, not the full viewport. When the sidebar collapses/expands, the bar slides to stay centered.

### 2.2 Icon Tab Row Above Card Strip

Replace inline text pills with an icon row positioned above the card bar:

```
              🚪    🪟    💡    🔌          ← tab row (28px icon buttons)
         ┌─────────────────────────────┐
         │ [thumb+name] [thumb+name].. │    ← card strip (64px tall)
         └─────────────────────────────┘
```

**Tab specs:**
- Size: 28x28px each, lucide icons at 16px
- Icons: `DoorOpen`, `AppWindow`, `Lightbulb`, `Plug` from lucide-react
- Active: filled background tint (`rgba(59, 130, 246, 0.25)`) + blue icon (`#93c5fd`)
- Inactive: transparent background, dim icon (`rgba(255,255,255,0.4)`)
- Each button has `title` attribute for tooltip: "Doors", "Windows", "Lights", "Electrical"
- Row: `display: flex`, `gap: 4`, `justify-content: center`, `margin-bottom: 4px`

**Structural change:** The outer bar becomes a `flex-direction: column` container wrapping the tab row and the card row, instead of the current single-row layout.

### 2.3 Card Redesign with SVG Thumbnails

Card grows from 68x40px to 80x64px:

```
  ┌─────────────┐
  │   ┌─────┐   │
  │   │ SVG │   │   ← 32x32 SVG silhouette
  │   │     │   │
  │   └─────┘   │
  │  Barn Door  │   ← 9px name (truncated)
  │    ●●●      │   ← cost dots
  └─────────────┘
```

**New file: `FormThumbnails.tsx`**
- Exports `<FormThumbnail formId={string} size={number} />` component
- Switches on `formId`, renders inline SVG path for each form
- Monochrome strokes using `currentColor` — tints automatically with card text color
- ~15 silhouettes total across 4 categories:
  - **Doors:** barn door panel, sliding rail, french door arches, pocket door recess
  - **Windows:** single pane, double-hung sashes, casement swing, porthole circle
  - **Lights:** pendant drop, recessed circle, track bar
  - **Electrical:** duplex outlet, rocker switch, panel box
- Default fallback: generic rectangle outline for unrecognized formIds

### 2.4 Auto-Sync with Selection

BottomPanel subscribes to the selected object's formId:

```ts
const selectedFormId = useStore(s =>
  s.selectedObjectId ? s.sceneObjects[s.selectedObjectId]?.formId : null
);
```

A `useEffect` auto-switches the local `category` state when `selectedFormId` changes:

```ts
useEffect(() => {
  if (selectedFormId) {
    const form = formRegistry.get(selectedFormId);
    if (form) setCategory(form.category);
  }
}, [selectedFormId]);
```

### 2.5 Selection Badge

Replace the "Placing" badge area with context-dependent content:

| State | Badge | Color |
|-------|-------|-------|
| Placing a form | `Placing [formName] ✕` | Amber (`#fbbf24`) |
| Object selected | `● [formName]` | Cyan (`#00bcd4`) |
| Neither | Hidden | — |

Placing mode takes priority if both are somehow active (shouldn't happen due to mutual exclusion, but defensive).

---

## Section 3: Inspector Defaults + Minor Fixes

### 3.1 Preview & Grid Default to Collapsed

In `uiSlice.ts`, change initial values:

```ts
previewCollapsed: true,   // was: false
gridCollapsed: true,       // was: false
```

Toggle buttons in the Inspector header already render correctly for both states (blue tint when visible, gray when collapsed). No other changes needed.

### 3.2 Existing Deselection Paths Cover SkinEditor

With the close button removed from SkinEditor, these existing paths handle deselection:
- **Canvas `onPointerMissed`** → `clearSelection()` → clears `selectedObjectId`
- **"← Library" button** in Sidebar header → `clearSelection()` → clears `selectedObjectId`
- **`Escape` hotkey** → `clearSelection()` → clears `selectedObjectId`

All three already exist and already call `clearSelection()`, which we modify in Section 1.1 to also clear `selectedObjectId`.

---

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `src/store/slices/uiSlice.ts` | Modify | Mutual exclusion in `selectObject`/`selectVoxel`/`clearSelection`; flip `previewCollapsed`/`gridCollapsed` defaults |
| `src/components/ui/Sidebar.tsx` | Modify | Add `selectedObjectId` check in Inspector routing |
| `src/components/ui/SkinEditor.tsx` | Modify | Remove fixed positioning + close button; become inline Sidebar child |
| `src/components/ui/BottomPanel.tsx` | Modify | Sidebar-aware centering, icon tabs above cards, card resize, auto-sync, selection badge |
| `src/components/ui/FormThumbnails.tsx` | **New** | ~15 inline SVG silhouettes, `<FormThumbnail formId size />` export |
| `src/components/objects/ContainerSkin.tsx` | Modify | Detect occupied SceneObject slot on click → `selectObject(id)` |

**No new store atoms. No new types. No new dependencies. One new file.**

---

## Testing Strategy

1. **Mutual exclusion unit tests** — verify `selectObject` clears voxel state, `selectVoxel` clears object state, `clearSelection` clears both
2. **Sidebar routing test** — when `selectedObjectId` is set, Inspector contextual area renders SkinEditor (not WallTypePicker/FinishesPanel)
3. **BottomPanel auto-sync test** — setting `selectedObjectId` to a door's UUID causes BottomPanel to switch to 'door' category
4. **Anti-pattern tests** — SkinEditor must not have `position: fixed` (add to existing anti-pattern suite)
5. **Existing test suite** — all 448 passing tests must continue to pass (mutual exclusion additions are backward-compatible)

---

## Out of Scope

- Drag-and-drop reordering of bottom bar cards
- Multi-object selection (Shift+click multiple SceneObjects)
- SceneObject hover preview in bottom bar
- Keyboard navigation of bottom bar cards
- Persisting bottom bar category across sessions
