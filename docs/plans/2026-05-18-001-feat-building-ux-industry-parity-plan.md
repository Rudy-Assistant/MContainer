---
date: 2026-05-18
type: feat
status: active
origin: docs/brainstorms/2026-05-18-001-building-ux-requirements.md
---

# feat: Building-UX industry-leader parity (snap, preview, single-action)

## Summary

Adopt Snap-and-Infer + Single-Action Interaction industry patterns in MContainer's building flow. Seven dependency-ordered implementation units: drag ghost preview, snap-to-grid + snap-to-adjacent, voxel-face hover preview, auto-stack + "+ Stairs" affordance, Smart/Manual mode collapse, visual arrangement gallery, undo button + destructive-action toasts. All changes stay in the interaction layer — voxel data model and R3F rendering pipeline are unchanged (see origin: `docs/brainstorms/2026-05-18-001-building-ux-requirements.md`).

---

## Problem Frame

Per origin, the building UX costs more attention than industry equivalents (Sims, Townscaper, Figma, SketchUp) on every common action: placing a container, painting a face, stacking, switching modes, picking an arrangement. The cost shape is: every action requires extra mental holding because the affordance doesn't show what's about to happen. This plan implements the affordance changes that make actions self-explanatory before commit.

The substrate from this session is supportive: `presetProtectedFaces` (commit `2e4c477`) provides the smart-rule-safe stamping primitive needed for invisible-default Smart mode; `setVoxelFacesPresetBatch` (`3c4d4a6`) provides batched mutations for preview→commit flow; `walkthroughSpawn` (`466c388`) provides the per-preset pose-restoration pattern this plan generalizes; `extraVoxelFaces` (`98534db`) is the precedent for additive interaction-layer additions that don't touch the voxel data model. No rewrites — extend existing structures.

---

## Requirements

Carried forward from origin `docs/brainstorms/2026-05-18-001-building-ux-requirements.md`:

**Snap-and-Infer**
- R1. Container drag shows semi-transparent ghost preview at drop target before commit.
- R2. Containers auto-snap to grid intersections AND to adjacent container edges within snap radius (~0.5m); snap line shown briefly when snap engages.
- R3. Voxel-face hover preview shows translucent overlay of the surface that WOULD be painted, before click.
- R4. Stacking auto-promotes the deck AND offers an inline "+ Stairs" affordance on the lower container's accessible face (click accept, click-anywhere dismiss).

**Single-Action Interaction**
- R5. One verb per click for the common path. No mode-switch dialogs for paint / select / rotate / walkthrough enter-exit.
- R6. Smart/Manual mode collapsed: Smart-rule auto-railing / auto-deck / auto-merge become invisible defaults; per-rule contextual opt-out toggle appears when a rule fires; global toolbar toggle removed.

**Curated Constraints**
- R7. Arrangement picker is a visual gallery (thumbnail + 1-line plain-English caption per arrangement), not a dropdown of CAD identifiers.

**Undo as Core**
- R8. Visible undo button + destructive-action toast announcing what just happened ("Deleted L1 NW — Ctrl+Z to undo"). zundo already implemented; this is discoverability.

Acceptance examples AE1-AE6 from origin are pinned to specific units below.

---

## Actors

Carried forward from origin:
- A1. **Casual home-designer**: No CAD background. Drags containers, paints walls, walks through. Bounces fast.
- A2. **Power user / returning architect**: Knows the model. Frustrated by extra clicks.
- A3. **AI-generated home explorer**: Lands via AI-design entry, wants to refine. Needs clear select-and-change distinct from build-from-scratch.

---

## Key Flows

Carried forward from origin (F1-F3). Each implementation unit advances at least one F-ID.

- **F1**: Place a single container, paint one wall, walk through. → Advanced by U1, U2, U3, U5, U7.
- **F2**: Stack a second container onto a placed one and add stairs. → Advanced by U2, U4, U5.
- **F3**: Place a model home preset and walk through. → Advanced by U7 (toast); already covered by existing `walkthroughSpawn`.

---

## System-Wide Impact

| Surface | Affected | How |
|---|---|---|
| **Drag/drop interaction** | Yes (U1, U2) | New ghost-preview component renders during drag; snap math computes target position |
| **Voxel paint** | Yes (U3) | Hover handlers in ContainerSkin emit a "preview surface" state that an overlay mesh reads |
| **Smart-rule cascade** | Yes (U6) | Existing smart rules keep firing; opt-out is a per-voxel `userOptOut[face]` mark consulted alongside `presetProtectedFaces` |
| **Inspector picker** | Yes (U7) | Arrangement-picker UI rewrite (gallery cards replace dropdown) |
| **Toolbar** | Yes (U5, U8) | Smart/Manual toggle hidden; Undo button added; toast layer added |
| **Voxel data model** | NO | Schema unchanged. `userOptOut` field added to Voxel type is purely additive |
| **R3F rendering pipeline** | NO | ContainerSkin, ContainerMesh, materialCache layers unchanged; overlay meshes are additional render passes |
| **zundo undo stack** | NO | All new mutations route through existing setters that zundo already records |

---

## High-Level Technical Design

The Snap-and-Infer pattern follows a 4-stage interaction lifecycle. Each stage is observable as a distinct React/Zustand state so testing and future visual tuning are easy:

```
HOVER → PREVIEW → SNAP → COMMIT
  │        │        │       │
  │        │        │       └─ Mutation lands in store (existing zundo records it)
  │        │        └─ Snap math computes target; brief snap-line indicator shown
  │        └─ Ghost mesh / face-overlay mesh renders the post-commit state
  └─ Pointer enters interactable surface; ephemeral hover state activates
```

The same lifecycle applies to BOTH container drag (U1+U2) and voxel-face paint (U3). The arrangement gallery (U7) collapses HOVER+PREVIEW into a single thumbnail glance, then COMMIT happens on click — but the underlying pattern is the same.

*This diagram illustrates the intended lifecycle and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

Decision matrix for the auto-stack + "+ Stairs" affordance (U4):

| Drop position relative to existing container | Snap action | Stairs affordance |
|---|---|---|
| Within snap radius of TOP of existing container (same x,z) | Stack: y += container.height | Show "+ Stairs" inline button on lower container's south-facing voxel after stack |
| Within snap radius of side edge (same y, adjacent x or z) | Lateral adjacency snap; share wall | No stairs |
| No snap target within radius | Free placement at cursor | None |

---

## Output Structure

This plan does NOT create a new directory hierarchy. All changes modify or add files within existing structure:

```
src/
├── components/
│   ├── three/
│   │   ├── DragGhost.tsx          [NEW — U1]
│   │   ├── SnapIndicator.tsx      [NEW — U2]
│   │   ├── FacePaintPreview.tsx   [NEW — U3]
│   │   ├── AutoStairsAffordance.tsx [NEW — U4]
│   │   ├── ContainerSkin.tsx      [MODIFY — U3]
│   │   ├── Scene.tsx              [MODIFY — U1, U2, U3, U4]
│   │   └── ...
│   └── ui/
│       ├── ToolbarUndoButton.tsx  [NEW — U7]
│       ├── DestructiveToast.tsx   [NEW — U7]
│       ├── ArrangementGallery.tsx [NEW — U7]
│       ├── Inspector.tsx          [MODIFY — U6, U7]
│       └── ...
├── store/
│   └── slices/
│       ├── interactionSlice.ts    [NEW — U1, U2, U3 — drag/hover/preview state]
│       ├── voxelSlice.ts          [MODIFY — U6 — userOptOut tracking]
│       └── ...
└── types/
    └── container.ts               [MODIFY — U6 — Voxel.userOptOut field]
```

---

### U1. Drag ghost preview for container placement

**Goal**: Show a semi-transparent ghost of the container being dragged at the drop target position, before commit. Eliminates "did it land where I expected?" surprise.

**Requirements**: R1 (origin). Covers AE1 (partial — ghost-side; snap-side in U2).

**Dependencies**: none

**Files**:
- `src/components/three/DragGhost.tsx` (new) — R3F mesh rendering a translucent bounding box of the dragged container at the current cursor target. Reads from `interactionSlice.dragState`.
- `src/store/slices/interactionSlice.ts` (new) — ephemeral drag state: `{ source: 'library'|'canvas', containerSize, cursorTarget: {x,y,z}|null }`. NOT persisted, NOT undoable.
- `src/components/three/Scene.tsx` (modify) — render `<DragGhost>` when drag is active.
- `src/components/ui/Library.tsx` (modify) — drag handlers emit pointer events that drive `interactionSlice.setDragState`.
- `src/__tests__/drag-ghost.test.ts` (new) — test scenarios below.

**Approach**: Drag state lives in a NEW Zustand slice (`interactionSlice`) so it's globally accessible to both UI handlers (Library drag start, drop) and 3D renderers (DragGhost component) WITHOUT triggering zundo persistence. The slice is omitted from zundo's `partialize` allowlist. DragGhost mesh uses Three.js `MeshBasicMaterial({ transparent: true, opacity: 0.4 })`. On commit (drop), call existing `addContainer` — the ghost disappears as drag state clears, the real container appears via the existing render path.

**Execution note**: Test-first. Write the drag-state reducer tests + render test BEFORE wiring UI handlers — the slice contract is the foundation of U2.

**Patterns to follow**:
- Slice structure: mirror `src/store/slices/voxelSlice.ts` (interface + factory function + state shape).
- R3F translucent mesh pattern: see `src/components/objects/ContainerSkin.tsx` SingleFace hitbox materials (alpha=0 for hitboxes vs. opaque for visible faces).
- zundo partialize exclusion: see `src/store/useStore.ts` middleware chain.

**Test scenarios**:
- Happy path: `setDragState({ source: 'library', containerSize: HighCube40, cursorTarget: {x:0,y:0,z:0} })` updates the slice and ghost renders at origin.
- Cursor update: subsequent `setDragState` with new cursorTarget updates ghost position without re-mounting.
- Commit clears: `commitDrag()` calls `addContainer` AND sets drag state to null in one update.
- Covers AE1 (partial): drag starts from Library, ghost appears at cursor; release commits a container at the ghost's position.
- Edge: `setDragState` with cursorTarget=null hides the ghost but keeps drag-source recorded (used by U2 snap logic).
- Integration: zundo does NOT record any state during drag (only the final commit).

**Verification**: Manually drag a container from Library; ghost follows cursor at 60fps; release places real container at ghost's last position; no console errors; undo restores the pre-drag state in one Ctrl+Z.

---

### U2. Snap-to-grid + snap-to-adjacent container edges

**Goal**: Snap the drag-ghost (from U1) to nearest grid intersection AND to nearest container edge within ~0.5m radius. Show a brief snap line when snap engages.

**Requirements**: R2 (origin). Covers AE1 (snap-side).

**Dependencies**: U1

**Files**:
- `src/utils/snapping.ts` (new) — pure snap math. Inputs: cursorPos, snapRadius, existingContainers. Output: `{ snappedPos, snapLine: {from, to} | null, snapKind: 'grid' | 'adjacent' | 'none' }`.
- `src/components/three/SnapIndicator.tsx` (new) — R3F line2 rendering the snap line briefly (250ms fade-out).
- `src/components/three/DragGhost.tsx` (modify, from U1) — read snapped position from `interactionSlice` instead of raw cursor.
- `src/store/slices/interactionSlice.ts` (modify, from U1) — add `snapResult` derived state.
- `src/__tests__/snapping.test.ts` (new) — pure-function tests for snap math.
- `src/__tests__/snap-indicator.test.ts` (new) — integration with DragGhost.

**Approach**: Snap math is a pure function — easiest to TDD. Grid snap = round(cursor.x / VOXEL_SIZE) * VOXEL_SIZE. Adjacent-edge snap = find closest container edge within radius and align ghost to it. Both candidates computed; whichever is closer wins. Snap line is drawn from ghost to the snap target (grid point or shared edge). Tested at the pure-function level first, then wired into the existing drag flow via interactionSlice derived state.

**Execution note**: Test-first. The pure snap-math function gets dozens of cases (corner alignment, multi-container ambiguity, no-snap fallback). All before any rendering work.

**Patterns to follow**:
- Pure-utility pattern: see `src/utils/snapMath.ts` if it exists, otherwise mirror `src/utils/walkthroughCameraPose.ts` (this session, commit `5af83dd`) for normalize/validate structure.
- Per-frame derived-state recompute pattern: see `src/components/three/WalkthroughControls.tsx` (yaw/pitch recomputation per frame).

**Test scenarios**:
- Pure math — grid snap with cursor at (0.3, 0, 0) snaps to (0, 0, 0) when grid resolution=1.524m and radius=0.5m.
- Pure math — adjacent-edge snap takes precedence over grid snap when an existing container's edge is closer than the nearest grid point.
- Pure math — no snap when cursor is >0.5m from any grid intersection AND any container edge → returns `snapKind: 'none'` and `snapLine: null`.
- Pure math — corner-of-container snap: cursor near the NW corner of an existing container snaps to that corner (not the south wall mid-edge).
- Edge case: empty existingContainers list → grid snap only, no adjacent candidates.
- Edge case: cursor exactly at a grid intersection → snap is identity transform, snap line shown briefly (acknowledges the snap).
- Covers AE1: drag a 40HC, approach a grid intersection within 0.5m, ghost snaps to grid, brief snap-line visible.
- Integration: snap-indicator mesh appears for ~250ms then fades; doesn't block subsequent drag operations.

**Verification**: Drag a container near another's edge; ghost snaps to share wall; snap line briefly visible from ghost to neighbor; release commits at snapped position (verified by reading the container's position from the store).

---

### U3. Voxel-face hover preview before paint commit

**Goal**: When hovering a voxel face with a hotbar-active surface, show a translucent overlay of the would-be material on that face before click. Eliminates "did I click the right face?" anxiety.

**Requirements**: R3 (origin). Covers AE2.

**Dependencies**: U1 (uses `interactionSlice` slice; if U1 not landed yet, this unit creates the slice itself)

**Files**:
- `src/components/three/FacePaintPreview.tsx` (new) — R3F mesh rendering a translucent (alpha=0.4) overlay of the hovered face with the current hotbar's surface material.
- `src/components/objects/ContainerSkin.tsx` (modify) — pointer-over/out handlers on hitboxes emit `interactionSlice.setHoverFace({ containerId, voxelIndex, face })`. Pointer-leave clears.
- `src/store/slices/interactionSlice.ts` (modify, from U1) — add `hoverFace: { containerId, voxelIndex, face } | null` and `setHoverFace` action.
- `src/__tests__/face-paint-preview.test.ts` (new).

**Approach**: ContainerSkin already has pointer-event handlers on hitbox meshes — extend them to emit hover state via the new slice action. The preview mesh reads `(hoverFace, activeHotbarSurface)` and renders an overlay at the same world position as the real face, slightly offset along the face normal to prevent z-fighting. Click handler is unchanged (still calls `setVoxelFace`); only the visual preview is added.

**Execution note**: Test-first. Hover state should be ephemeral (NOT undoable), so the slice contract test (set → read → clear) anchors the unit before any rendering.

**Patterns to follow**:
- ContainerSkin pointer handler shape: see existing `onPointerOver`/`onPointerOut` on SingleFace components (`src/components/objects/ContainerSkin.tsx` ~line 4400). Mirror that handler pattern; just add slice emission.
- Translucent overlay positioning: see `src/components/objects/ContainerSkin.tsx` SingleFace hitbox offset math (the hitbox is offset from the visible face by ~0.001m to prevent z-fighting; preview uses the same trick).

**Test scenarios**:
- Happy path: `setHoverFace({ containerId: 'c1', voxelIndex: 8, face: 's' })` sets state; clear with `setHoverFace(null)`.
- Happy path: with hotbar surface = `Solid_Steel` AND hoverFace set, the preview mesh renders at the south face of voxel 8 with `Solid_Steel` material at alpha=0.4.
- Edge: hover with NO hotbar selection → preview mesh does not render (or renders with placeholder material indicating "click to use default").
- Edge: hover transitions from face A to face B without intermediate `null` — preview position updates without re-mounting.
- Edge: hover during walkthrough mode is suppressed (FPV camera doesn't need a preview).
- Covers AE2: hover the L1 NW south face with hotbar=`Solid_Steel`; faint translucent Solid_Steel overlay appears at that face before click; click commits.
- Integration: hover state is ephemeral — zundo does not record it.

**Verification**: Hover a wall in 3D mode with a hotbar surface; translucent preview appears; click commits the real material; preview disappears.

---

### U4. Auto-stack + "+ Stairs" inline affordance

**Goal**: When the user drops a container directly above another (within snap), auto-stack happens AND a "+ Stairs" inline button appears on the lower container's south-facing roof voxel for 2 seconds. Click accept; click-anywhere dismiss.

**Requirements**: R4 (origin). Covers AE3.

**Dependencies**: U2 (snap-to-adjacent identifies the stack case)

**Files**:
- `src/components/three/AutoStairsAffordance.tsx` (new) — R3F billboard-style button positioned at the south-facing roof voxel of the most-recently-stacked container; visible for 2 seconds with fade-out; click handler calls `applyStairsFromFace`.
- `src/store/slices/interactionSlice.ts` (modify) — add `pendingStairsAffordance: { containerId, voxelIndex, face, ttlMs } | null` set after stack-on-drop, cleared on accept/dismiss/timeout.
- `src/components/three/Scene.tsx` (modify) — render `<AutoStairsAffordance>` when `pendingStairsAffordance` is set.
- `src/store/slices/librarySlice.ts` OR `src/store/slices/containerSlice.ts` (modify) — `stackContainer` already exists; on drop-stack, emit `setPendingStairsAffordance` after stack succeeds.
- `src/__tests__/auto-stairs-affordance.test.ts` (new).

**Approach**: When the drop flow (U1+U2 derived snap kind = 'adjacent' AND stack-position match) commits, call existing `stackContainer` AND set `pendingStairsAffordance`. The affordance component reads state, renders the button, and fades out at TTL. Acceptance calls `applyStairsFromFace(lowerContainerId, voxelIndex, face)` and clears the state. Dismissal via click-anywhere or TTL expiry just clears state.

**Execution note**: Test-first. The stack-detection logic in the drop flow is testable in isolation (input: snap result → output: stack action + pending affordance). The 2-second TTL is a side-effect of UI; test the state transitions, not the timer fidelity.

**Patterns to follow**:
- Inline affordance rendering: no direct precedent in MContainer, but the toast pattern from U7 will be similar. If U7 hasn't landed yet, this unit may pick a simple Three.js sprite/billboard.
- `stackContainer` semantics: see `src/store/slices/containerSlice.ts` `stackContainer` (already exists, used by `placeModelHome`).
- `applyStairsFromFace`: see `src/store/slices/voxelSlice.ts` (already exists, used by Resort House preset).

**Test scenarios**:
- Happy path: drop a 40HC within snap-radius of the top of an L1 container; verify `stackContainer` is called AND `pendingStairsAffordance` is set with the lower container's south roof voxel.
- Accept: with affordance pending, calling its onAccept handler calls `applyStairsFromFace` AND clears `pendingStairsAffordance`.
- Dismiss: clicking anywhere else (mocked as `clearPendingStairsAffordance`) clears state without stairs.
- TTL expiry: after 2000ms, state clears automatically (test by advancing fake timers in vitest).
- Edge: dropping NOT in stack position (lateral snap, free placement) does NOT set `pendingStairsAffordance`.
- Covers AE3: drop a 40HC above the existing L1 → snap stacks it (same x,z; y += 2.9) → deck auto-promotes (existing smart-rule path) → "+ Stairs" affordance visible → click commits stairs.
- Integration: undo after accept rolls back stairs AND the stack in a single Ctrl+Z (zundo group).

**Verification**: Drag a second container above an existing one; release; container snaps stacked; "+ Stairs" button appears on the front of L1's roof; click it; stairs appear; undo restores pre-drop state.

---

### U5. Single-action default mode (hide Smart/Manual toolbar toggle)

**Goal**: Remove the global Smart/Manual mode toggle from the toolbar; Smart-rule cascade runs by default (invisible). Power users access the toggle via an Inspector "Advanced" pane. Per-rule contextual opt-out is implemented in U6.

**Requirements**: R5, R6 (origin, partial). Covers AE4 (no mode dialog).

**Dependencies**: U6 (the contextual opt-out is U6's scope; this unit only relocates the global toggle)

**Files**:
- `src/components/ui/Toolbar.tsx` (modify) — remove Smart/Manual toggle button.
- `src/components/ui/Inspector.tsx` (modify) — add "Advanced" tab or section containing the Smart/Manual toggle, the existing frame-mode toggle, and any other A2-power-user globals.
- `src/store/useStore.ts` (modify) — `designMode` is unchanged; only its UI surface moves.
- `src/__tests__/toolbar-mode-hidden.test.ts` (new) — test the toolbar render.
- `src/__tests__/inspector-advanced-tab.test.ts` (new) — test the Inspector exposes the toggle.

**Approach**: Pure UI refactor. The store state (`designMode`) and its behavior are unchanged — Smart is the default, just no longer visible in the toolbar. Inspector Advanced pane is a new collapsible section gated behind "Show advanced settings" preference (default off for A1, on for A2 who flips it once).

**Execution note**: Test-first. Render the toolbar without the toggle; render the Inspector with the toggle in Advanced.

**Patterns to follow**:
- Toolbar refactor: see existing Toolbar implementation (Smart/Manual toggle currently lives there).
- Inspector tab pattern: existing Inspector already has `Block`, `Container`, `Interior`, etc. tabs. Add `Advanced` as a new tab.

**Test scenarios**:
- Happy path: Toolbar renders WITHOUT a Smart/Manual toggle button.
- Happy path: Inspector → Advanced tab shows the Smart/Manual toggle; toggling it still updates `useStore.getState().designMode`.
- Edge: default `designMode` is `'smart'`.
- Edge: per-rule contextual opt-out is NOT in this unit — it's U6 — but assert that `userOptOut[face]` (from U6's schema) is honored if set during this unit's lifetime.
- Covers AE4 (partial): clicking an outer wall face paints it with no mode dialog appearing.
- Regression: existing tests that check Smart-mode behavior (smart-railing, smart-staircase, etc.) still pass — the behavior is unchanged.

**Verification**: Toolbar visually has no Smart/Manual toggle; Inspector → Advanced has it; painting a face in default mode auto-railings (same as smart mode); no mode-dialog appears.

---

### U6. Per-rule contextual Smart opt-out

**Goal**: When a Smart rule fires (auto-railing, auto-deck, auto-merge), show a brief inline toast offering "Undo this auto-fix" + "Don't auto-fix this face again." The second option sets `voxel.userOptOut[face] = true`, which the smart-rule cascade respects alongside `userPaintedFaces` and `presetProtectedFaces`.

**Requirements**: R6 (origin, completion).

**Dependencies**: U5 (toolbar toggle is already gone, so the opt-out is the only Smart escape valve)

**Files**:
- `src/types/container.ts` (modify) — add `userOptOut?: Partial<Record<keyof VoxelFaces, boolean>>` to Voxel type.
- `src/store/slices/voxelSlice.ts` (modify) — `recomputeSmartRailings`, `applySmartRailing`, and any other smart-rule entry points consult `isVoxelFaceProtected` extended to check userOptOut as well; new action `setUserOptOut(containerId, voxelIndex, face, value)`.
- `src/components/ui/SmartRuleToast.tsx` (new) — toast UI rendered when a smart rule recently fired; offers Undo + Don't-auto-fix-this.
- `src/store/slices/interactionSlice.ts` (modify, from U1) — track `lastSmartRuleFire: { containerId, voxelIndex, face, ttlMs } | null`.
- `src/__tests__/user-opt-out.test.ts` (new) — opt-out persists, smart-rule respects it.
- `src/__tests__/smart-rule-toast.test.ts` (new) — toast renders and routes click to opt-out.

**Approach**: Extend the existing protected-face check (`isVoxelFaceProtected`) to consult userOptOut, mirroring the pattern shipped this session for presetProtectedFaces. The toast is a UI manifestation of `lastSmartRuleFire`; it renders for ~3 seconds, offers two clickable affordances. "Undo this auto-fix" calls existing zundo undo. "Don't auto-fix this face again" calls `setUserOptOut(id, idx, face, true)` so future cascades skip it.

**Execution note**: Test-first. TDD the type extension + the smart-rule cascade respecting userOptOut BEFORE writing the toast UI — the data layer change is the high-risk piece.

**Patterns to follow**:
- userPaintedFaces / presetProtectedFaces precedent: see `src/types/container.ts` Voxel type (this session, commit `2e4c477`).
- isVoxelFaceProtected helper: see `src/types/container.ts` ~line 508 (this session).
- Toast rendering: this is the FIRST toast component in MContainer. Use a simple absolute-positioned div with CSS transitions for fade-out. No external lib needed.

**Test scenarios**:
- Type: Voxel type accepts `userOptOut: { s: true }` without TS error.
- Smart-rule respect: `recomputeSmartRailings` with a voxel that has `userOptOut.s = true` does NOT overwrite the s-face (parallel to existing presetProtectedFaces semantics).
- Toast state: when smart-railing fires, `lastSmartRuleFire` is set; TTL expiry clears it.
- Toast click: clicking "Don't auto-fix this face again" calls `setUserOptOut` AND clears `lastSmartRuleFire`.
- Edge: clicking "Undo this auto-fix" triggers zundo undo; the next smart-rule pass might re-fire unless userOptOut is set.
- Covers AE4 (completion): smart-rule fires invisibly on a paint action; toast appears with opt-out option; clicking it sets userOptOut and the rule never fires on that face again.
- Integration: userOptOut is persisted via existing Voxel persistence path (idb-keyval). Reload preserves opt-outs.

**Verification**: Paint a face → smart-railing fires → toast appears for 3s → click "Don't auto-fix this face again" → reload page → re-paint the same face → no auto-railing.

---

### U7. Visual arrangement gallery (Inspector picker rewrite)

**Goal**: Replace the Inspector → Container → Arrangement dropdown with a visual gallery of arrangement cards. Each card shows a thumbnail preview + 1-line plain-English caption. Click selects.

**Requirements**: R7 (origin). Covers AE5.

**Dependencies**: none (independent of U1-U6)

**Files**:
- `src/components/ui/ArrangementGallery.tsx` (new) — grid of cards, each with thumbnail + label + caption.
- `src/components/ui/Inspector.tsx` (modify) — replace the arrangement dropdown with `<ArrangementGallery>`.
- `src/config/containerArrangements.ts` (modify) — add a 1-line `description` field on each arrangement (currently has `hint` which is close; reuse or rename for clarity).
- `public/arrangements/*.png` (new static assets) — pre-rendered thumbnails (8-10 PNG files, one per arrangement). Alternative: generate via off-screen R3F canvas at startup; pick whichever ships faster.
- `src/__tests__/arrangement-gallery.test.ts` (new).

**Approach**: Pure UI surface swap. The store action (`applyContainerArrangement`) and arrangement-system semantics are unchanged. Gallery is a 4-column responsive grid; each card has thumbnail, label, hint/description; clicking calls existing `applyContainerArrangement(id)`. Thumbnails: ship static PNGs in `public/arrangements/` for v1 (cheap, deterministic). If user feedback wants live previews, swap to off-screen canvas later — that's a follow-up.

**Execution note**: Test-first. The gallery rendering test (asserting one card per known arrangement) is the contract. Visual fidelity of thumbnails is a separate, manual-QA concern.

**Patterns to follow**:
- Inspector tab content rendering: see existing Inspector tabs (Container, Interior, etc.).
- Card grid layout: no direct precedent; use Tailwind grid as MContainer's UI does for the rest of Inspector.
- Arrangement registry: see `src/config/containerArrangements.ts` — each arrangement has `id`, `label`, `title`, `hint` already; we surface them all.

**Test scenarios**:
- Happy path: with 10 registered arrangements, gallery renders 10 cards.
- Card content: each card has the arrangement's label, hint text, and a `<img>` tag with `src="/arrangements/<id>.png"`.
- Click: clicking a card calls `applyContainerArrangement(arrangementId)` on the currently-selected container.
- Edge: gallery handles 0 selected containers gracefully (cards disabled / "Select a container first" prompt).
- Edge: missing thumbnail → card renders with placeholder icon; doesn't crash.
- Covers AE5: Inspector → Container tab → Arrangement section is a 4-column grid of arrangement cards (preview + caption), not a dropdown.
- Integration: selecting an arrangement triggers the existing applyContainerArrangement path — voxels void/activate per the arrangement, same as today.

**Verification**: Open Inspector with a container selected; arrangement picker is a card grid; clicking a card applies the arrangement (visible in 3D); existing arrangement tests still pass.

---

### U8. Visible undo button + destructive-action toast

**Goal**: Add a prominent Undo button to the toolbar with Ctrl+Z tooltip. After any destructive action (delete container, clear voxel, remove stairs, replace arrangement), show a brief toast: "Deleted L1 NW — Ctrl+Z to undo."

**Requirements**: R8 (origin). Covers AE6.

**Dependencies**: U1 (uses toast infrastructure shared with U6)

**Files**:
- `src/components/ui/ToolbarUndoButton.tsx` (new) — button calling `useStore.temporal.getState().undo()`; tooltip shows "Undo (Ctrl+Z)".
- `src/components/ui/Toolbar.tsx` (modify) — add `<ToolbarUndoButton>`.
- `src/components/ui/DestructiveToast.tsx` (new) — toast rendered when `interactionSlice.lastDestructiveAction` is set.
- `src/store/slices/interactionSlice.ts` (modify) — add `lastDestructiveAction: { description, ttlMs } | null`.
- Various slices emit `setLastDestructiveAction` after destructive ops: `removeContainer`, `removeStairs`, `applyContainerArrangement` (since it voids cells), `clearVoxelFace`.
- `src/__tests__/toolbar-undo.test.ts` (new).
- `src/__tests__/destructive-toast.test.ts` (new).

**Approach**: Undo button is a thin UI on top of zundo's existing `useStore.temporal.getState().undo()`. The toast layer is shared with U6 — refactor U6's SmartRuleToast into a generic `<Toast>` component that handles both `lastSmartRuleFire` and `lastDestructiveAction` (or simply ship two separate toast components if the abstraction adds complexity). The "description" string is composed at action time (e.g. "Deleted L1 NW container") so the toast can show specifics.

**Execution note**: Test-first. The toast state contract (set → render → TTL clear) is identical to U6; reuse those tests as a template.

**Patterns to follow**:
- zundo temporal access: see `useStore.temporal.getState().undo()` and `.redo()` calls already in the codebase.
- Toast component pattern: from U6's SmartRuleToast (if landed first) or new in this unit.

**Test scenarios**:
- Happy path: clicking the Undo button calls `useStore.temporal.getState().undo()` once.
- Tooltip: hover the Undo button shows "Undo (Ctrl+Z)".
- Toast: calling `setLastDestructiveAction({ description: 'Deleted L1 NW', ttlMs: 2000 })` renders a toast with that text.
- Toast TTL: state clears after 2000ms (test with fake timers).
- Action wiring: `removeContainer(id)` sets `lastDestructiveAction` with a description including the container's name.
- Edge: rapid successive destructive actions queue or replace the toast (pick one and lock in a test).
- Covers AE6: delete a container; Undo button visible in toolbar; toast appears for 2s with "Deleted ... — Ctrl+Z to undo"; click Undo (or press Ctrl+Z) restores it.
- Regression: existing zundo undo behavior (Ctrl+Z keyboard shortcut) still works; this unit ADDS a visible button without changing the keystroke path.

**Verification**: Toolbar shows Undo button with Ctrl+Z tooltip; delete a container; toast appears with name; click toolbar Undo or press Ctrl+Z; container restored.

---

## Acceptance Examples Trace

| AE-ID | Origin description (paraphrased) | Pinned to |
|---|---|---|
| AE1 | Drag a 40HC near grid intersection → ghost snaps, snap-line shown, drop commits | U1 (ghost) + U2 (snap) |
| AE2 | Hover a face with `Solid_Steel` in hotbar → translucent preview before commit | U3 |
| AE3 | Drop a second 40HC above L1 → auto-stack + auto-deck + "+ Stairs" affordance | U4 |
| AE4 | Click an outer wall face → paint commits, smart-rule fires invisibly, no mode dialog | U5 (no dialog) + U6 (invisible smart) |
| AE5 | Open Inspector Arrangement picker → 4-column grid of arrangement cards | U7 |
| AE6 | Delete a container → Undo button visible; toast "Deleted L1 NW — Ctrl+Z to undo" | U8 |

Every AE has a unit; every unit has at least one AE-bearing test scenario.

---

## Key Technical Decisions

- **New `interactionSlice` Zustand slice for ephemeral UX state.** Drag state, hover state, snap result, pending affordances, last-smart-rule-fire, last-destructive-action all live here. The slice is EXCLUDED from zundo's `partialize` allowlist — pre-commit interaction state should never enter the undo stack. (Rationale: keeps the existing 7-slice store structure clean; adds an 8th slice that's purely ephemeral; mirrors React-component-local state at the global store level so 3D and 2D layers share it.)
- **Snap math is a pure function.** All snap logic lives in `src/utils/snapping.ts` taking (cursor, radius, existingContainers) → snap result. No side effects. TDD'd in isolation. (Rationale: testable, reusable, mirrors the pure-function pattern in `walkthroughCameraPose.ts` shipped this session.)
- **Static PNG thumbnails for arrangement gallery v1.** Generate live previews later if needed. (Rationale: ships faster, deterministic, no runtime cost.)
- **Smart/Manual toggle moves to Inspector → Advanced, not removed entirely.** A2 power users keep the escape valve. A1 casual users never see it. (Rationale: per origin Outstanding Question #2, default-on-invisible with opt-out — the toggle becomes the opt-out for the global behavior.)
- **userOptOut field on Voxel parallels presetProtectedFaces.** Same data shape (`Partial<Record<keyof VoxelFaces, boolean>>`), same protection semantics, additional check in `isVoxelFaceProtected`. (Rationale: re-uses this session's freshly-shipped pattern.)
- **Toast layer: 2-3s TTL, click-to-dismiss, NOT persisted.** Toasts are pure UI affordances. (Rationale: matches the brevity industry-standard toasts ship with — no modal trap.)
- **Feature flag: NOT in this plan.** Origin Outstanding Question #4 suggested feature-flagging the first 1-2 changes. Decision: ship behind master directly — the changes are additive (new components, not replacements) and each ships with full test coverage. If A2 friction surfaces post-merge, add a flag in a follow-up. (Rationale: feature flags add carrying cost; the additive nature of these changes makes rollback per-commit cheap if needed.)

---

## Dependencies / Prerequisites

| Item | Owner | Status |
|---|---|---|
| zundo middleware | Existing | ✓ already integrated |
| `presetProtectedFaces` + `isVoxelFaceProtected` helper | This session, commit `2e4c477` | ✓ shipped |
| `setVoxelFacesPresetBatch` perf path | This session, commit `3c4d4a6` | ✓ shipped |
| `walkthroughSpawn` schema | This session, commit `466c388` | ✓ shipped |
| `extraVoxelFaces` override mechanism | This session, commit `98534db` | ✓ shipped |
| idb-keyval persistence layer | Existing | ✓ |
| `applyContainerArrangement` | Existing | ✓ |
| `stackContainer` | Existing | ✓ |
| `applyStairsFromFace` | Existing | ✓ |
| `useStore.temporal.getState().undo()` | Existing (zundo) | ✓ |
| Tailwind CSS in components/ui | Existing | ✓ |

---

## Risk Analysis & Mitigation

- **Risk: ghost preview at 60fps regresses frame rate.** Mitigation: ghost mesh uses shared geometry from `materialCache`; only position/visibility updates per frame. Smoke-test: profile during U1 implementation with > 16 containers in scene.
- **Risk: snap math gets confused with rotated containers.** Mitigation: snap math operates in world coords from `container.position` (which is the bounding-box center) and respects `container.rotation`. TDD a rotation case explicitly.
- **Risk: hover preview spams pointer events.** Mitigation: pointer-over fires on hitbox mesh only (not every face); current ContainerSkin handlers already de-bounce; preview state update is a single-field set, not an expensive recompute.
- **Risk: smart-rule contextual toast becomes noisy.** Mitigation: TTL=3s + click-to-dismiss + ONE toast at a time (newer replaces older). If A2 still finds it noisy, add a "Don't show smart-rule toasts" preference in Inspector → Advanced (out of scope for this plan; flag as follow-up).
- **Risk: userOptOut diverges from presetProtectedFaces semantics over time.** Mitigation: extend `isVoxelFaceProtected` to consult BOTH fields with the same OR-semantics. Add a test that asserts userOptOut behaves identically to presetProtectedFaces in the smart-rule cascade.
- **Risk: arrangement thumbnails go stale when arrangements are added/modified.** Mitigation: thumbnails are committed PNGs; arrangement changes ship as part of the same PR that updates the thumbnail (or use a tiny `regenerate-thumbnails` script if it becomes painful). Document this in a comment in `containerArrangements.ts`.
- **Risk: removing the Smart/Manual toolbar toggle confuses existing A2 users.** Mitigation: Inspector → Advanced is the new home, discoverable via the "Show advanced settings" preference. Ship a one-time tooltip ("Smart mode is now the default — find the toggle in Inspector → Advanced") on first launch post-deploy.

---

## Phased Delivery

The 8 units land in 3 logical phases that can each be released independently:

**Phase 1 — Visual feedback (units U1, U2, U3)**
The ghost preview + snap + face-hover-preview trio. Most user-visible improvement. Lands first.

**Phase 2 — Auto-promotion + mode simplification (units U4, U5, U6)**
The auto-stairs affordance, hidden mode toggle, and contextual opt-out. Builds on Phase 1's interaction patterns.

**Phase 3 — UI polish (units U7, U8)**
Arrangement gallery + undo affordances. Pure surface changes; can ship in either order.

Each phase is shippable on its own. If Phase 1 reveals friction (e.g., ghost preview is jittery), pause and tune before Phase 2.

---

## Documentation Plan

- Update `MODUHOME-V1-ARCHITECTURE-v2.md` §3 (rendering pipeline) to note the new ephemeral-overlay render passes (DragGhost, SnapIndicator, FacePaintPreview, AutoStairsAffordance, DestructiveToast, SmartRuleToast). One paragraph per pass; no exhaustive detail.
- Update `MODUHOME-V1-ARCHITECTURE-v2.md` §6 (feature status) to add the building-UX features as they land.
- Add a `docs/INTERACTIONS.md` companion doc summarizing the Snap-and-Infer + Single-Action affordance vocabulary, with screenshots of each preview/toast/affordance once Phase 1 ships.
- CLAUDE.md unchanged — the TDD discipline and architecture invariants already cover this work.

---

## Outstanding Questions

Carried forward from origin and resolved here:

| Origin question | Resolution in this plan |
|---|---|
| Should snap radius differ by container size? | Default to 0.5m for all sizes in v1 (U2). Add size-scaling as a follow-up if A2 reports issues. |
| What happens to the Smart/Manual toolbar toggle? | U5 hides it from toolbar, surfaces in Inspector → Advanced (gated on "Show advanced settings" preference). |
| How to communicate "+ Stairs" affordance? | U4 ships inline button + 2s TTL + click-anywhere-dismiss. A/B comparison left for follow-up. |
| Feature flag the first 1-2 changes? | NO. Ship to master directly; additive surface means rollback is per-commit (see Key Decisions). |

No remaining blockers.

---

## Scope Boundaries

**In scope (this plan)**
- U1: Drag ghost preview
- U2: Snap-to-grid + snap-to-adjacent
- U3: Voxel-face hover preview
- U4: Auto-stack + "+ Stairs" affordance
- U5: Hide Smart/Manual toolbar toggle (move to Inspector → Advanced)
- U6: Per-rule contextual Smart opt-out (userOptOut + toast)
- U7: Visual arrangement gallery
- U8: Visible undo button + destructive-action toast

**Deferred for later (origin)**
- Component-snap / prefab module library (Figma-style)
- Hierarchical grouping ("wings", "levels", "units")
- Touch / iPad / gesture-first interactions (Procreate-style)
- AI-assisted placement suggestions

**Deferred to follow-up work (this plan)**
- Live R3F-rendered arrangement thumbnails (start with static PNGs; revisit if quality matters)
- Snap-radius scaling per container size (start with 0.5m universal)
- Smart-rule toast frequency preference ("Don't show smart-rule toasts")
- Tooltip on first-launch announcing "Smart mode is now the default"
- A/B testing the stairs-affordance UI variant (inline button vs floating toast vs hover hint)
- Feature-flag infrastructure (not needed for additive changes; add if rollback friction surfaces)

**Outside this product's identity (origin)**
- Parametric BIM constraints (Revit/AutoCAD)
- Full 3D mesh editing (push-pull surfaces, vertex manipulation)

---

## Verification Strategy

Per `CLAUDE.md` ground rule #1: "Do NOT make changes without browser verification. tsc + vitest passing is NOT equivalent to 'done.'"

For each unit:
1. Write failing test(s) first per the unit's `Test scenarios`.
2. Implement minimum code to GREEN.
3. `npx tsc --noEmit` → 0 errors.
4. `npx vitest run` → full suite pass (currently 1140+ tests).
5. Browser verification — open `localhost:3000`, exercise the new affordance, screenshot, Read screenshot, state explicit comparison vs the acceptance example.
6. Commit + push per unit. Commit message references the U-ID and AE-IDs covered.

The DELEGATION-FIRST autowork mandate currently armed on this project will pick up execution after this plan is written: each unit becomes one cascade-aware turn, dispatching mechanical work (snap math TDD, slice setup, etc.) to Codex/Haiku where cheaper, and reserving Claude-direct for visual taste judgment + integration checkpoints.
