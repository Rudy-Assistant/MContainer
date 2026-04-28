# Design Pass Completion — 2026-04-28

## Context

The 7 Design Pass items in [docs/handoff/sprint-bugfix-handoff.md](../../handoff/sprint-bugfix-handoff.md) are mostly already shipped from prior sprints. This pass closes the remaining gaps and verifies the shipped items.

## Gap analysis (vs handoff list)

| # | Item | State | Action |
|---|------|-------|--------|
| 1 | Block tab isometric previews | Shipped — `BlockTab.tsx` uses `IsometricVoxelSVG` (with off-screen 3D thumbnails when ready) | Verify only |
| 2 | Ghost preview on preset hover | Shipped — `setGhostPreset` wired in `BlockTab`, `ContainerPresetRow`, `ContainerTab` Openings buttons; `HoverPreviewGhost` consumes it | Verify only |
| 3 | PresetCard standardization | **Partial** — only `TemplatePicker.tsx` has 6 bespoke skin/swatch grids | **Migrate** |
| 4 | Bottom hotbar improvements | **Partial** — already responsive + transparent + white text, but slot background is hardcoded `rgba(0,0,0,0.35)` and there are no theme tokens for hotbar slots | **Polish** |
| 5 | Inspector cleanup | Done in prior sprints — Bay/Block toggle moved to Settings; legend removed; no "cable info"/"scope text" remaining | Verify only |
| 6 | Container preset tab | Shipped — `ContainerTab` shows arrangements with `IsometricVoxelSVG` thumbnails, grouped by category | Verify only |
| 7 | Multi-select with element-type constraint | Shipped — `MatrixEditor` Ctrl/Cmd-toggle + Shift-range-fill + marquee-drag; selection always promoted to `bay` when count > 1; extension cells filtered via `filterSelectableGridIndices` | **Add regression test** |

## Plan

### #3 — TemplatePicker → PresetCard

The 6 bespoke grids share the same shape: button containing a swatch span + label span. Migration:

1. Add a small `SkinSwatchCard` component co-located in `TemplatePicker.tsx` that wraps `PresetCard` with the gradient swatch as `content`.
2. Replace each of the 6 inline grids (door skin, shelf skin, cabinet skin, counter top, decor palette, window skin) with `SkinSwatchCard` instances.
3. Drop the now-unused `skinTileStyle`, `skinLabel`, and `swatchStyle` helpers (still used by template/fixture tiles, so keep the latter).

Per CLAUDE.md UI Card Convention: square image area with highlight on image only, label below outside the highlight. PresetCard already implements this exactly.

Keep the action buttons in `ContainerTab.tsx` lines 104-153 (Atrium / Glass Void) as bespoke — they're discrete commands, not preset selections. The Lucide icon convention (icon left, label right inside a rectangle) is the right shape for action buttons.

### #4 — Hotbar polish

1. Replace hardcoded `rgba(0,0,0,0.35)` slot button background with new CSS var `--hotbar-slot-bg` (theme-aware, light-mode + dark-mode palettes in globals.css).
2. Make label text use `color-mix` against the active accent so contrast holds in both themes.
3. Tighten label legibility: increase label letter-spacing slightly for the tablet zoom level.
4. Audit for stray rarity-dot residues — earlier sprint comments say they were removed; confirm nothing left over.

### #7 — Multi-select element-type constraint

The current behavior:
- Plain click → `{ type: 'voxel', items: [one] }`
- Ctrl/Cmd click → promotes to `{ type: 'bay', items: [..., new] }`
- Shift click → `{ type: 'bay', items: [rect range] }`
- Marquee drag → `{ type: 'bay', items: [rect cells] }`

Constraint that needs verifying: a bay multi-selection cannot contain extension cells (only core 1-6 × 1-2 voxels are bay-aggregable). `filterSelectableGridIndices` already does this for the marquee path. Need to confirm Ctrl+click and Shift+click also honor it.

Action: add a test `multi-select-element-type.test.ts` that exercises:
- Shift+click extension cell → no-op
- Ctrl+click extension cell → no-op
- Marquee over mixed core+extension → only core cells included
- Ctrl+click on bay then click on container background → cleared

## Test plan

- `multi-select-element-type.test.ts` — element-type constraint
- `templatepicker-presetcard-migration.test.ts` — render the picker, assert PresetCard is used (testid), assert active state propagates
- Browser verify (snapshot + inspect):
  - Block tab: hover a preset → `data-testid="preset-ghost"` appears → leave → ghost gone
  - Container tab: same
  - Walls tab → Door category → see Door Skin grid uses standard PresetCard layout
  - Hotbar slots show theme-correct background in both light + dark modes
  - Inspector with no selection → no "scope" / "cable info" / legend text visible

## Out of scope

- ContainerMesh.tsx:2768 Phase 4 hinged-wall TODO — explicitly future-arc per handoff.
- Quick Setup wizard cards — already migrated in S3 work.
- The 193 unrelated uncommitted files in the working tree.
