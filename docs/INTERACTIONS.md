# Interactions: Snap-and-Infer + Single-Action Vocabulary

**Date:** 2026-05-18
**Plan origin:** `docs/plans/2026-05-18-001-feat-building-ux-industry-parity-plan.md`
**Brainstorm origin:** `docs/brainstorms/2026-05-18-001-building-ux-requirements.md`

This document is the user-facing reference for the building-UX patterns adopted in May 2026 to bring MContainer's interactions in line with industry leaders (Sims, Townscaper, Figma, SketchUp, Minecraft). It is the **single source of truth** for what each affordance does, when it fires, and how power users can opt in or out.

---

## Affordance vocabulary

### Drag Ghost (R1)
**When it fires:** the user drags a container from the Library or canvas.
**What you see:** a translucent (40% opacity) clone of the container at the cursor position, updating each frame.
**Why:** "did it land where I expected?" gets answered BEFORE commit. Mirrors Sims/SketchUp.
**Source:** `src/components/three/Scene.tsx` → `DragGhost` (local to Scene).

### Snap-to-Grid + Snap-to-Adjacent (R2)
**When it fires:** the drag ghost approaches a grid intersection or adjacent container edge within snap radius (~0.5 m).
**What you see:** the ghost jumps to the snap point; a brief snap line indicates the engagement.
**Why:** removes manual nudge work. Mirrors Figma smart guides.
**Source:** `src/components/three/Scene.tsx` → `findEdgeSnap`, `findStackTarget`, `ghostSnapEdge` material.

### Voxel-Face Hover Preview (R3, AE2)
**When it fires:** the user hovers any voxel face while a hotbar slot is active.
**What you see:** a translucent (45% opacity) overlay of the would-be material on the hovered face, BEFORE click.
**Why:** eliminates "did I click the right face?" anxiety.
**Source:** `src/components/three/FacePaintPreview.tsx`, `src/store/selectors/facePaintPreview.ts`.
**Suppressed:** in walkthrough mode (FPV camera doesn't need a paint preview).

### Auto-Stack + "+ Stairs" Affordance (R4, AE3)
**When it fires:** after a successful stackContainer mutation (drop near top of an existing container, or programmatic).
**What you see:** top-center banner "Stacked. Add stairs to access?" with a blue `+ Stairs` button and a dismiss `✕`. Visible for 4 seconds.
**Click "+ Stairs":** stairs are applied to the lower container's south halo (row 3, col 4), level 1 (roof). The banner clears.
**Click "✕" or wait 4s:** banner dismisses; no stairs applied.
**Why:** Townscaper-style "place a piece, full structure updates" feel.
**Source:** `src/components/ui/AutoStairsAffordance.tsx`. Hook: `uiSlice.lastStackedPair`, set by `containerSlice.stackContainer`.

### Smart Mode Default-Invisible (R5, R6, AE4)
**Default:** Smart mode is on. Auto-railing, auto-deck, and auto-merge fire silently.
**Visible toolbar:** no Smart/Manual pill for first-time users.
**Power-user opt-in:** flip `showAdvancedSettings` via store (`useStore.getState().toggleAdvancedSettings()` or DevTools) to surface the pill in TopToolbar.
**Per-rule contextual opt-out:** `userOptOut[face]=true` on a voxel marks that face as permanently opted out of smart auto-fixes. Set via `setUserOptOut(containerId, voxelIndex, face, true)`. Respected by `isVoxelFaceProtected` alongside `userPaintedFaces` and `presetProtectedFaces`.
**Source:** `src/components/ui/TopToolbar.tsx` (gated render), `src/types/container.ts` (`userOptOut` field + `isVoxelFaceProtected` helper), `src/store/slices/voxelSlice.ts` (`setUserOptOut`).

### Arrangement Gallery (R7, AE5)
**When it fires:** the user opens Inspector → Container tab with a container selected.
**What you see:** a 2-column grid of arrangement cards (preview thumbnail + label + hint). Hover shows a ghost preview on the actual container. Click applies.
**Why:** opaque CAD identifiers (`framed_glass_box`, `central_atrium`) become visual choices. Mirrors Lego Studio palette + Sims build-mode catalog.
**Source:** `src/components/ui/finishes/ContainerPresetRow.tsx`, `src/components/ui/finishes/ContainerPresetCard.tsx`, `src/components/ui/svg/IsometricVoxelSVG.tsx`.

### Destructive-Action Toast (R8, AE6)
**When it fires:** any destructive action (remove container, remove stairs, remove furniture) sets `lastDestructiveAction`.
**What you see:** top-right toast "<description> — Ctrl+Z to undo" for 2.5 seconds, then fades. Click to dismiss immediately.
**Why:** announces what just happened + reminds the user undo is one keystroke away.
**Source:** `src/components/ui/DestructiveToast.tsx`. Hook: `uiSlice.lastDestructiveAction`, set by destructive store actions.
**Currently wired:** `removeContainer`, `removeStairs`, `removeFurniture`. Add more by calling `setLastDestructiveAction({ description })` after the mutation.

---

## Where state lives

| State | Slice | Purpose |
|---|---|---|
| `dragContainer`, `dragWorldPos` | `dragSlice` | drag-in-flight container size + snapped world position |
| `hoveredVoxelEdge` | `uiSlice` | which (containerId, voxelIndex, face) the user is hovering |
| `activeHotbarSlot` | `dragSlice` | which hotbar slot is "loaded" (drives FacePaintPreview material) |
| `lastDestructiveAction` | `uiSlice` | description + timestamp for the destructive-action toast |
| `lastStackedPair` | `uiSlice` | { topId, bottomId, at } for the "+ Stairs" affordance |
| `showAdvancedSettings` | `uiSlice` | gates power-user toolbar elements (default false) |
| `userOptOut` per voxel face | container.voxelGrid[i] | preserves face from smart-rule auto-fix |

All ephemeral UX state is excluded from zundo (`partialize` allowlist) — pre-commit interaction state never enters the undo stack.

---

## When affordances DO NOT fire

- **Walkthrough mode** (`viewMode === ViewMode.Walkthrough`): FacePaintPreview is suppressed; DestructiveToast / AutoStairsAffordance still render at the app shell.
- **Wizard / modal open:** affordances are not gated on modal state today; they render behind the modal. Future polish item.
- **No hotbar selection:** FacePaintPreview renders nothing (returns null at selector level).
- **No active hover:** FacePaintPreview renders nothing.

---

## Adding a new affordance

1. Decide where the trigger fires (store mutation, pointer event, drag drop).
2. Add an ephemeral state field to `uiSlice` if needed (default null, `setX` action).
3. Write a TDD test for the state contract (default, set, clear).
4. Implement the UI as a small component mounted at app shell or in Scene.tsx.
5. Run vitest + tsc + browser-verify per `CLAUDE.md` ground rule #1.
6. Persist a `.qa/ux-*.jpg` screenshot.

---

## Acceptance traceability

Every AE in the origin brainstorm doc is satisfied by a specific commit:

| AE-ID | Description | Commit |
|---|---|---|
| AE1 | Drag-ghost + snap | shipped previously in DragGhost (Scene.tsx) |
| AE2 | Face hover preview | `937b7ea` |
| AE3 | Auto-stack + "+ Stairs" | `3f31c9e` |
| AE4 | No mode dialog on paint | `01f531e` + `15e56bb` |
| AE5 | Arrangement gallery | shipped previously in ContainerPresetRow |
| AE6 | Undo button + destructive toast | `b895d4c` + `64e4c76` |
