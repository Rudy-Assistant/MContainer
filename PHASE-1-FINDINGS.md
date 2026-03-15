# Phase 1 Findings — V1 Undo/Redo + Persistence Upgrade

## Q1: Store Creation

- **File:** `src/store/useStore.ts`
- **Creation:** `create<StoreState>((set, get) => ({...}))` at line 684
- **Middleware:** NONE — plain zustand `create()` with no middleware chain
- **Exact call signature:**
  ```typescript
  export const useStore = create<StoreState>((set, get) => ({
    // ...all state + actions
  }));
  ```

## Q2: State Shape (Top-Level Keys)

### Data keys (should be undo-tracked):
- `containers` — Record<string, ContainerConfig> — primary design data
- `zones` — Zone[] — spatial grouping
- `environment` — EnvironmentSettings — time, ground, sky
- `furnitureIndex` — number — furniture placement counter

### Persist-only keys (not undo-tracked, but saved):
- `viewMode` — '3d' | 'blueprint'
- `pricing` — PricingConfig
- `libraryBlocks` — SavedBlock[]
- `libraryContainers` — SavedContainer[]
- `customHotbar` — HotbarSlot[]

### UI/ephemeral keys (exclude from both):
- `selection`, `hoveredBay`, `hoveredFace`, `hoveredContainerId`
- `contextMenu`, `showBudgetModal`, `showExportModal`
- `dragState`, `isDragging`, `ghostPosition`, `ghostRotation`, `ghostValid`
- `brushMode`, `activeBrush`, `paintMode`
- `clipboard`, `copiedStyle`
- `canUndo`, `canRedo`, `_undoStack`, `_redoStack`
- `cameraPosition`, `cameraTarget`
- ~22 UI keys total

## Q3: Persistence

- **Mechanism:** Manual localStorage via `window.localStorage`
- **Storage key:** `"moduhome-project-v6"` (in `src/app/page.tsx`)
- **Save trigger:** `setInterval` every 5 seconds (page.tsx lines 66-71)
  ```typescript
  const interval = setInterval(() => {
    const state = useStore.getState().exportState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, 5000);
  ```
- **Load trigger:** On mount in `useEffect`, if `containers` is empty (page.tsx lines 50-62)
- **Serialization:** `exportState()` (lines 1296-1303) returns subset of keys
- **Deserialization:** `importState()` (lines 1305-1348) with legacy migrations

## Q4: Existing Keyboard Handling

- **Method:** `addEventListener('keydown', ...)` in `Scene.tsx`
- **File:** `src/components/three/Scene.tsx`
- **Ctrl+Z:** Already bound at lines 210-211, 243-246 → calls `store.undo()`
- **Ctrl+Shift+Z / Ctrl+Y:** Already bound at lines 248-251 → calls `store.redo()`
- **Relevant code:**
  ```typescript
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    store.undo();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    store.redo();
  }
  ```

## Q5: Dependencies

- **zustand:** 5.0.11
- **immer:** NOT installed
- **zundo:** NOT installed
- **idb-keyval:** NOT installed
- **zod:** NOT installed

## Q6: React Version and Rendering

- **React:** 19.2.3
- **Framework:** Next.js 16.1.6 with App Router (`src/app/` directory)
- **Top-level layout:** `src/app/layout.tsx` — standard Next.js root layout
- **SSR guard:** SceneCanvas loaded via `next/dynamic` with `ssr: false`
- `useSyncExternalStore` is available (React 18+)

## Manual Undo System (existing)

The store has a manual undo/redo implementation:
- `_undoStack: string[]` and `_redoStack: string[]` (lines 658-678)
- `_pushUndo()` snapshots via `structuredClone` of exportable state, max 50 entries
- `undo()` (lines 1872-1888) restores from stack
- `redo()` (lines 1890-1906) restores from redo stack
- `canUndo`/`canRedo` boolean flags

## Critical Finding: Immer Incompatibility

The store's `set()` calls use the spread-return partial merge pattern:
```typescript
set((s) => ({ containers: { ...s.containers, [id]: c }, canUndo: true }))
```

With immer middleware, the callback receives a draft and the returned object becomes a **complete replacement**, not a partial merge. This would silently delete all non-returned keys, breaking the entire store.

**Decision:** Skip immer. Use zundo `temporal` middleware directly (it does not require immer).

## App Verification

- [PASS] App loads without errors (dev server at localhost:3000)
- [PASS] A container renders in 3D
- [PASS] Click on a face → selection/paint works
- [PASS] Toolbar/hotbar is functional
