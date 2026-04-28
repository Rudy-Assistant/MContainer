# Sprint Bugfix Handoff

**Date:** 2026-03-24 (original); revised 2026-04-28
**Status:** All originally-listed bugs reconciled — 6 fixed, 1 retired as future arc. Active backlog empty pending design-pass brainstorm.

---

## Bugs Fixed This Session

### 1. Window/Railing Half-Bay Openings ✅
**Root cause:** `applyBlockConfig` in voxelSlice.ts didn't call `recomputeSmartRailings` after applying bay presets. Interior 'Open' faces in multi-voxel bays never got auto-railings.
**Fix:** Added `recomputeSmartRailings(grid, updatedContainer)` call at end of `applyBlockConfig` (when not in manual mode).
**File:** `src/store/slices/voxelSlice.ts:1588-1592`

### 2. Shift+Click Drag Race Condition ✅
**Root cause:** ContainerMesh.tsx registered an "early release safety" pointerup handler (line 2338) that raced with DragMoveGhost's handler. Non-deterministic execution order meant sometimes the safety handler called `cancelContainerDrag()` after the commit.
**Fix:** Removed the early-release handler. DragMoveGhost handles all pointerup commit/cancel logic.
**File:** `src/components/three/ContainerMesh.tsx:2329-2335`

### 3. Door Opposite-Face Sync ✅
**Root cause:** `applyDoorModule` in voxelSlice.ts set the adjacent voxel's opposite face to `'Open'` instead of `'Door'`. A door should occupy both sides of the shared face.
**Fix:** Changed line 1472 to set `oppFace` to `'Door'` and mirror the doorConfig.
**File:** `src/store/slices/voxelSlice.ts:1469-1474`

### 4. Ceiling Mode Hover Outline Offset ✅
**Root cause:** `VoxelHoverHighlight` in ContainerMesh.tsx always rendered hover/select outlines at level 0 Y position. When ceiling mode selected level-1 voxels, outlines appeared at floor height.
**Fix:** Added `levelYOffset(idx)` function that computes Y offset based on voxel level. All highlight positions now include `+ yLift`.
**File:** `src/components/three/ContainerMesh.tsx:1985-1989, 2065-2190`

---

## Reconciled 2026-04-28

### 5. Debug/Wireframe Mode Missing from UI ✅ RESOLVED
The toggle exists today in the Settings menu. `toggleDebugMode` is wired at `src/components/ui/SettingsMenuControl.tsx:200`. Doc was stale — closing.

### 6. Frame Mode Rendering Issues ✅ RESOLVED
Re-verified 2026-04-28 against the live dev server. Both originally-listed sub-issues are non-bugs:

- **Materials update correctly.** `__threeScene` traversal confirms pole mesh material is swapped on `setFrameDefaults({ poleMaterial })`: distinct `THREE.MeshStandardMaterial` UUIDs and distinct colors (`8a9aa8` Steel → `9c6b30` Wood). Full-canvas pixel diff after a 2s settle window shows 399,418 pixels (39% of canvas) differ — the visual update happens. The earlier "byte-identical PNG" measurement was a render-timing artifact: a 1.5s settle was too short for the headless renderer to land the new material on screen.
- **Frame mode hides walls/ceilings.** Already implemented: `if (frameMode && dir !== 'bottom') return null;` at `src/components/objects/ContainerSkin.tsx:4344`.

Path verified end-to-end: store (`setFrameDefaults` merges into `container.frameDefaults` with new reference, `containerSlice.ts:2754`) → resolve (`resolveFrameProperty` reruns each render, no memo barrier) → cache (`getFrameThreeMaterial` returns distinct `_themeMats[theme][key]` instances per `materialCache.ts:242-255`) → mesh (`material={poleMat}` prop swaps on every container render). Closing.

### 7. Door Flush Positioning (Cosmetic) ✅ RESOLVED
DEVELOPMENT-ROADMAP.md "Completed Foundation §3" (2026-04-23) reads "Frame/door flush fixes landed and verified." Closing.

---

## Test Status (2026-04-28)
- **121 test files / 1027 tests passing** (vitest)
- `npx tsc --noEmit` → 0 errors
- DISC-1 + DISC-2 (Sidebar discoverability) added; probe S1 + S3 PASS end-to-end

---

## Active Loose Ends

### Pool Container reachable in non-3D modes ✅ RESOLVED 2026-04-28
DISC-2: added Pool Container card to the Library Structure tab (testId `library-pool-container`). Verified reachable in Realistic3D + Blueprint (Walkthrough unmounts the sidebar by design).

### Wizard preset name surfacing ✅ RESOLVED 2026-04-28
S3: Inspector now shows the applied wizard preset's label (e.g. "Glass Box") in a dedicated Preset row (testId `inspector-applied-preset`). The probe S3 detector now finds the visible text.

### In-code TODO
- `src/components/three/ContainerMesh.tsx:2768` — *"TODO Phase 4: Rebuild hinged wall animations within the voxel system."* Future arc; not on this branch's scope.

---

## Design Pass Items — RESOLVED 2026-04-28

Closed end-to-end. Items 1, 2, 5, 6 had already shipped from prior sprints; this
session added #3 + #4 polish and #7 regression coverage. Spec recorded at
[docs/superpowers/specs/2026-04-28-design-pass-completion.md](../superpowers/specs/2026-04-28-design-pass-completion.md).

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Block tab isometric previews | ✅ Already shipped | `BlockTab.tsx` renders `IsometricVoxelSVG` (with off-screen 3D thumbnails when ready). Browser: 8 IsometricVoxelSVG cards in Block tab on selected voxel. |
| 2 | Ghost preview on preset hover | ✅ Already shipped | `setGhostPreset` is wired in `BlockTab`, `ContainerPresetRow`, and `ContainerTab` Openings buttons; `HoverPreviewGhost` consumes it. Browser: hovering Glass Box card sets `ghostPreset.arrangementId='largest_glass'`. |
| 3 | PresetCard standardization | ✅ Closed this session | `TemplatePicker.tsx`: 6 bespoke skin/swatch grids (door skin / shelf skin / cabinet skin / counter top / decor palette / window skin) migrated to a new `SkinSwatchCard` helper that wraps the shared `PresetCard`. Browser: 24 PresetCard image-areas render in the door TemplatePicker; 3 ✓ check badges on active template + skin + counter top. |
| 4 | Bottom hotbar improvements | ✅ Closed this session | New `--hotbar-slot-bg`, `--hotbar-slot-border`, `--hotbar-slot-label` tokens in `globals.css` (light + dark). `RecentItemsBar.tsx` migrated from hardcoded `#1e293b/#334155/#cbd5e1` to those tokens with `backdrop-filter: blur(16px) saturate(1.4)`. `SmartHotbar.tsx` (still used as a CssVoxelIcon export) also migrated for consistency. Browser-verified in both light + dark modes. |
| 5 | Inspector cleanup | ✅ Already shipped | Bay/Block toggle moved to Settings dropdown (Sprint 14); legend removed (`MatrixEditor.tsx:30`); no `cable info` / `scope text` / stray label found in the Inspector. Browser: Container Properties shows only Finish + Rooftop Deck on no-face selection. |
| 6 | Container preset tab | ✅ Already shipped | `ContainerTab.tsx` renders `ContainerPresetRow` with all 12 arrangements (Shell, Max Box, Glass Box, Framed Glass Box, Atrium, Framed Glass Atrium, Glass Atrium, Roof Terrace, Glass Terrace, Deck, Patio, Retract) as IsometricVoxelSVG cards grouped by category. |
| 7 | Multi-select with element-type constraint | ✅ Closed this session | Behavior already implemented (Ctrl/Cmd-toggle, Shift-range, marquee-drag, all promoting to `bay` type when count > 1). New regression test `src/__tests__/multi-select-element-type.test.ts` covers type-switching discards old selection, type-stable append/remove, last-item-clears-to-null, and `selectableRectangle` exclusion of inactive + locked cells. |

### Files touched this pass
- `src/components/ui/finishes/TemplatePicker.tsx` — added `SkinSwatchCard`, dropped `skinTileStyle`/`skinLabel`, replaced 6 inline grids
- `src/app/globals.css` — `--hotbar-slot-bg|border|label` tokens for light + dark
- `src/components/ui/SmartHotbar.tsx` — slot button, Rooms cards, Materials swatches, Furniture cards, Light cards, tab pills all migrated to theme tokens
- `src/components/ui/RecentItemsBar.tsx` — bar + chip migrated to theme tokens, added backdrop blur
- `src/__tests__/multi-select-element-type.test.ts` — new (8 tests)
- `docs/superpowers/specs/2026-04-28-design-pass-completion.md` — gap analysis spec

### Verification
- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 122 files / 1034 tests pass (was 121/1027 → +1 file, +7 tests)
- Browser-verified all 7 items via snapshot + inspect at 1440×900 in both light + dark modes
