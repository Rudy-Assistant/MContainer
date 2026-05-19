---
date: 2026-05-18
topic: building-ux-industry-leader-parity
status: ready-for-planning
---

# Building UX: Adopt Industry-Leader Patterns

## Summary

MContainer's current building UX is functional but feels clunky relative to industry-leading 3D/voxel builders (Sims, Minecraft, SketchUp, Figma, Townscaper). This brainstorm picks **Snap-and-Infer + Single-Action Interaction** as the two universal principles to copy first, identifies the 4 specific friction moments in today's flow that violate them, and bounds scope so we keep the voxel-grid data model and R3F rendering engine intact while changing only the interaction layer above them.

---

## Problem Frame

Across the recent Resort House work the user surfaced — and visible-evidence across this session confirms — that the *building* part of MContainer (placing containers, stacking, painting faces, rotating, applying arrangements, entering walkthrough) costs more attention than the equivalent moments in industry-leading apps. The cost shape is:

- **Cognitive load per action.** Placing a container, switching modes, painting a single face, or stacking onto another container all require the user to hold model state in their head (level numbers, mode flag, hit-test face direction, arrangement-id semantics). The reference apps offload this state to the affordance — Sims shows a ghost preview of the next click, SketchUp shows inferenced snap points, Townscaper shows the full building update under the cursor before commit.
- **Modal friction.** Smart vs Manual mode, frame-mode toggle, walkthrough vs 3D vs blueprint view — each is a separate global state that traps state across modes (paint applied in Smart mode survives, manual mode doesn't auto-railing). Reference apps minimize global mode by embedding tools contextually (Figma's tool palette is single-bar; Minecraft has one verb per click).
- **No preview, no inferencing.** Container placement plops at the cursor — no ghost showing where the bounding box lands, no snap-line if it's close to another container, no rotation hint. The user discovers misplacement *after* commit, then uses undo (which itself is invisible if the result looks subtly wrong).
- **Arrangement opacity.** `central_atrium`, `framed_glass_box`, `framed_glass_atrium`, `glass_atrium` — these names are accurate to the system but a user with no architectural-CAD background can't predict what each one does without trying. Lego Studio and Sims solve this with curated visual previews + 1-line plain-English summaries.

The pattern is: every action requires extra mental holding because the affordance doesn't show what's about to happen.

---

## Actors

- A1. **Casual home-designer**: Has no CAD/architecture background. Wants to drag containers around, see them snap, paint walls, walk through. Bounces fast if first 60 seconds feel "engineery."
- A2. **Power user / returning architect**: Already builds with MContainer, knows the model. Frustrated by extra clicks for repetitive ops (paint-many-faces-same-material, stack-3-units-into-a-tower).
- A3. **AI-generated home explorer**: Lands on the app via the AI-design entry point with a generated home, wants to refine it. Currently has no clear "select this thing and change it" flow distinct from creating from scratch.

---

## Key Flows

- F1. **Place a single container, paint one wall, walk through.**
  - Trigger: User clicks "+ Add Container" or drags from Library.
  - Actors: A1
  - Steps: (1) Click "Add Container" → dropdown. (2) Select 40' High Cube. (3) Container drops at origin / cursor. (4) Click container body to enter voxel-painting mode. (5) Hover voxel face — face highlights. (6) Click face → applies current hotbar surface. (7) Switch view-mode to walkthrough. (8) FPV camera spawns at a default pose. (9) Use WASD to enter the container.
  - Outcome: Container painted, user has walked inside.
  - Covered by: R1, R2, R3, R5, R7

- F2. **Stack a second container onto a placed one and add stairs.**
  - Trigger: User has L1 placed and wants L2.
  - Actors: A1, A2
  - Steps: (1) Drag 40HC from Library near the existing container. (2) Container drops adjacent or overlapping — not auto-stacked. (3) User manually positions it on top. (4) Select stacked pair → smart-rule auto-promotes the lower's roof to a deck. (5) Stairs are NOT auto-placed; user must select a face and paint 'Stairs'.
  - Outcome: Two-story building with stair access.
  - Covered by: R2, R4, R6

- F3. **Place a model home preset and walk through.**
  - Trigger: User clicks "Model Homes" → "Resort House".
  - Actors: A1, A3
  - Steps: (1) Click preset. (2) 16 containers materialize. (3) View defaults to 3D. (4) User must manually switch to walkthrough mode. (5) Walkthrough camera lands at the preset's `walkthroughSpawn` pose (newly added — see commit 466c388) OR a generic default.
  - Outcome: User explores a pre-built home.
  - Covered by: R5, R7, R8

---

## Requirements

**Snap-and-Infer (universal principle 1 of 2)**

- R1. **Container drag shows a ghost preview** at the drop target before commit. Ghost is semi-transparent, shows the bounding box including extension halo, and updates as the cursor moves. Mirrors SketchUp/Sims.
- R2. **Containers auto-snap to grid intersections and to adjacent container edges** when dragged within a snap radius (~0.5 m of nearest grid line or nearest container edge). Show the snap line briefly when snap engages. Mirrors Figma smart guides.
- R3. **Voxel-face hover preview** shows the surface that WOULD be painted as a faint translucent overlay before click. Currently the surface is applied immediately on click — preview-before-commit eliminates "did I click the right face?" anxiety.
- R4. **Stacking auto-promotes the deck + offers an auto-stairs affordance.** When the user drops a container directly above a placed one (within snap), the stack happens automatically AND a "+ Stairs" inline hint appears on the lower container's accessible face. Click to accept; click anywhere else to dismiss. Mirrors Townscaper's "place a block, full structure updates" feel.

**Single-Action Interaction (universal principle 2 of 2)**

- R5. **One verb per click.** No mode switching for the common path. Painting a face = click the face. Selecting a container = click the container body (not its halo, not its edge — body anywhere). Rotating = drag the rotation handle. Walking through = single button to enter, single Esc to exit. Mirrors Minecraft.
- R6. **Smart/Manual mode collapsed into one mode** for the default user. Smart-rule auto-railing, auto-deck, auto-merge become invisible defaults. Power-users (A2) can opt OUT of any single auto-rule via a contextual toggle that appears when the rule fires; the global Smart/Manual flag is removed from the toolbar. Mirrors Figma (no "auto-layout mode" toggle; auto-layout is per-frame).

**Curated constraints + plain-English previews**

- R7. **Arrangement picker is a visual gallery with plain-English captions**, not a dropdown of CAD-y identifiers. Each arrangement renders a small ghost preview (per-container) showing what it does: "Open glass walls + central courtyard" / "Solid steel envelope + interior atrium" / etc. Mirrors Lego Studio palette + Sims build-mode catalog.

**Undo-as-core**

- R8. **Every building action is undoable in one keystroke (Ctrl+Z), and the undo target is announced as a toast** ("Undid: placed L1 NW container") so the user sees what came back. Already implemented (zundo) — the gap is **discoverability**: no toolbar undo button, no tooltip when the user hovers a destructive action. Add a visible undo button + tooltip on every destructive control.

---

## Acceptance Examples

- AE1. **Covers R1, R2.** Given the user has an empty canvas, when they drag a 40HC container from the Library and approach a grid intersection within 0.5 m, then a semi-transparent ghost snaps to the grid line with a brief snap-line indicator AND the drop on release places the container exactly at the snap point (no manual nudge needed).
- AE2. **Covers R3.** Given the user is in voxel-paint mode with `Solid_Steel` in the hotbar, when they hover a face of the L1 NW south wall, then a faint translucent `Solid_Steel` preview overlays that face before click; clicking commits.
- AE3. **Covers R4.** Given the user has L1 placed at origin, when they drag a second 40HC and release it within snap-radius of the top of L1, then the new container snaps to stacked position (same x, z; y += 2.9), the deck auto-promotes, AND a "+ Stairs" affordance appears on the south face of L1's roof; clicking it places stairs.
- AE4. **Covers R5, R6.** Given the user is in default mode (no Smart/Manual toggle visible), when they click an outer wall face, then the face is painted with the current hotbar surface AND smart-railing fires invisibly — no mode dialog, no auto-rule warning.
- AE5. **Covers R7.** Given the user has selected the Inspector → Container tab, when they open the Arrangement picker, then they see a 4-column grid of arrangement cards (preview thumbnail + 1-line caption) rather than a dropdown of identifiers.
- AE6. **Covers R8.** Given the user has just deleted a container, when they look at the toolbar, then they see a prominent Undo button (with Ctrl+Z keyboard hint) AND a brief toast appears for 2 seconds saying "Deleted L1 NW — Ctrl+Z to undo."

---

## Success Criteria

- **First-touch friction drops measurably.** New users (A1) can place a 2-container house and paint one wall without opening any modal dialog or pressing more than 6 clicks total. Today the equivalent path requires ~12 clicks + at least one mode switch.
- **Power users (A2) report fewer "did I click the right thing?" interruptions.** Anecdotally, the hover-preview + snap affordances should eliminate the "click → undo → re-click" pattern that currently dominates rapid edits.
- **Arrangement adoption rises.** Today the arrangement picker is rarely used outside model-home presets because the names are opaque. With visual gallery, expect arrangement-changes-per-session to triple.
- **Walkthrough as first-impression.** Model-home placement always lands at the preset's `walkthroughSpawn` (Resort House already does this — extend to every preset that has a signature view).

---

## Scope Boundaries

**In scope**
- Container drag + ghost preview + snap-to-grid + snap-to-adjacent
- Voxel-face hover preview before paint commit
- Auto-stack + auto-stairs affordance on adjacent drop
- Collapsing global Smart/Manual mode toggle into invisible-default + contextual opt-out
- Arrangement picker as visual gallery (replaces current dropdown)
- Visible undo button + destructive-action toasts

**Deferred for later**
- Component-snap (Figma-style prefab modules with auto-layout). Could land in a follow-up phase once the snap/infer foundation is in place.
- Hierarchical grouping (Lego Studio "wings"/"levels"). Useful for power users (A2) but not first-touch critical.
- Touch / iPad / gesture-first interactions (Procreate-style). Defer until a tablet flow is requested.
- AI-assisted placement suggestions (e.g., "auto-stagger these 3 containers"). Out of scope; orthogonal feature.

**Outside this product's identity**
- Parametric BIM constraints (Revit/AutoCAD). MContainer is not a professional architect's tool; we don't model load-bearing math.
- Full 3D mesh editing (push-pull surfaces, vertex manipulation). MContainer's voxel-grid is the model. SketchUp's surface-edit feel can inspire affordances but the underlying data stays voxel-grid.

---

## Key Decisions

- **Primary reference: Sims + Townscaper hybrid.** Both ship "drag → ghost preview → snap → commit" with no mode switching, and both render the full updated structure under the cursor before click. Sims supplies the affordance vocabulary (hover preview, snap line, single-click commit); Townscaper supplies the "place a piece, full structure updates" auto-promotion semantics for stacking.
- **NOT pure-Minecraft.** Minecraft's "one verb per click" is right, but Minecraft has no snap-to-grid (the grid IS the world) and no curated palette (everything is a block). MContainer needs curated material palettes + snap-to-existing-container, both of which Sims handles better.
- **NOT pure-SketchUp.** SketchUp's push-pull and inferencing are powerful but require a tool-palette mental model that violates Single-Action. We adopt SketchUp's snap-inference idea while keeping Sims' single-verb-per-click.
- **Smart mode default-on, but invisible.** Codex tech-debt findings + this session's `presetProtectedFaces` work confirm Smart can be the default without harming power-user workflows, IF we expose contextual opt-out toggles where rules fire. The global Smart/Manual switch becomes a power-user setting buried in Inspector preferences.
- **Keep voxel data model.** No data-model refactor. All UX changes are in the interaction layer (drag handlers, hover handlers, preview ghosts, snap math).
- **Keep R3F rendering pipeline.** ContainerSkin, ContainerMesh, materialCache layers stay. Preview ghosts are additional render passes, not replacements.

---

## Dependencies / Assumptions

- **Assumption: drag-state is local React state, not Zustand.** Ghost previews must update at 60fps without triggering global re-renders. Existing zundo undo stack handles commit-time persistence; pre-commit ghost state stays in component-local refs.
- **Assumption: snap-to-grid uses the existing voxel grid resolution.** 1.524 m per col, 0.61 m per row (40HC dimensions). Snap radius = 0.5 m feels right based on Figma's ~8px snap zone scaled to world units.
- **Assumption: smart-rule cascade already tolerates "invisible auto-fire" semantics.** The `presetProtectedFaces` + `userPaintedFaces` distinction shipped this session (commit 2e4c477) lets smart rules fire without overwriting user-authored geometry — this is the foundation for collapsing the Smart/Manual mode toggle.
- **Dependency: the existing arrangement system supports preview rendering.** Each arrangement's voxelGrid output can be rendered as a thumbnail in a small off-screen canvas. If not, the gallery picker needs a static thumbnail asset per arrangement (cheap to author once).

---

## Outstanding Questions

- **Should the snap-to-adjacent radius differ by container size?** A 40HC and a 20' standard have very different footprints. Probably yes (snap radius = 33% of container short edge?), but pick a defensible default during planning (~0.5 m) and tune later.
- **What happens to the existing Smart/Manual toolbar toggle?** Recommend: hide it from the toolbar by default; surface it only in an "Advanced" preference panel for A2. Power users won't lose access; new users (A1) won't see it.
- **How do we communicate "+ Stairs" auto-affordance?** Inline button on the container roof? Floating toast? Picking inline + 2s decay feels right but should be A/B-able later.
- **Do we ship behind a feature flag?** Probably yes for the first 1-2 changes (drag ghost, hover preview) to let A2 opt in early without breaking their muscle memory.

---

## Origin Notes

- Cascade Lane A (Haiku industry survey) — output at `C:\Users\ccimi\AppData\Local\Temp\industry_ux_resp.md`. 5 universal principles extracted: Snap-and-Infer, Single-Action, Undo+Preview, Curated Constraints, Hierarchical Organization. This doc adopts the top 4; defers Hierarchical Organization (grouping) to a follow-up phase.
- Cascade Lane B (Codex current-UX audit) — dispatched in parallel via `ask_codex.py`; did NOT return within timeout window. The 4 friction moments in this doc are sourced from firsthand UX observations across the Resort House polish work (16 commits this session, deep familiarity with voxelSlice, librarySlice, ContainerSkin, WalkthroughControls, and the model-home preset flow).
- This session's prior shipped foundations: `presetProtectedFaces` (2e4c477), `setVoxelFacesPresetBatch` (3c4d4a6), `walkthroughSpawn` (466c388), and `extraVoxelFaces` (98534db). These are the substrate the UX redesign builds on; no rewrite needed.
