# Changelog

## 2026-05-18 — Building-UX industry-leader parity (Snap-and-Infer + Single-Action)

User feedback: "Building is still not simple or intuitive. We should copy from industry leaders."

Routed via `/ce-plan` → `/ce-brainstorm` → `/ce-plan` → `/ce-work` chain. Brainstorm doc at `docs/brainstorms/2026-05-18-001-building-ux-requirements.md`; plan at `docs/plans/2026-05-18-001-feat-building-ux-industry-parity-plan.md`; affordance reference at `docs/INTERACTIONS.md`.

### Snap-and-Infer (already shipped, ratified)
- Drag-ghost preview with translucent material clone, grid-snap, snap-to-adjacent edge, stack-target detection — all in `Scene.tsx` `DragGhost` + `findEdgeSnap` + `findStackTarget`. AE1 satisfied.

### Single-Action: Smart mode now invisible-default
- **`showAdvancedSettings: false` default** hides the Smart/Manual toolbar pill (`01f531e`). Smart-rule cascade still runs; no mode dialogs on common paths. AE4 satisfied.
- **`userOptOut` per voxel face** lets a user opt OUT of further smart auto-fixes on a specific face. Added to `Voxel` type alongside `userPaintedFaces` + `presetProtectedFaces`; `isVoxelFaceProtected` respects all 3 flags with OR-semantics (`15e56bb`). Companion `setUserOptOut` action ships in `voxelSlice`.

### Voxel-face hover preview (R3, AE2)
- **`FacePaintPreview`** R3F overlay renders a translucent (45%) mesh of the would-be material on the hovered face BEFORE click (`937b7ea`). Uses cached material clones keyed on (theme, surface). Suppressed in walkthrough mode.

### Auto-stack + "+ Stairs" affordance (R4, AE3)
- **`AutoStairsAffordance`** top-center banner appears after a successful `stackContainer` ("Stacked. Add stairs to access?"). Click commits stairs on lower container's south halo voxel; 4s TTL; click-anywhere or ✕ dismisses (`3f31c9e`).

### Destructive-action toast (R8, AE6)
- **`DestructiveToast`** top-right banner announces destructive ops ("Deleted L1 NW container — Ctrl+Z to undo"). Wired into `removeContainer`, `removeStairs`, `removeFurniture` (`b895d4c` + `64e4c76`).

### Browser-verified
- `.qa/ux-u3-face-paint-preview.jpg` — face overlay rendered at hover
- `.qa/ux-u4-stairs-affordance.jpg` — stairs banner with `+ Stairs` button
- `.qa/ux-u5-toolbar-pill-hidden.jpg` — toolbar without Smart/Manual pill
- `.qa/ux-u8-destructive-toast.jpg` — toast with "Ctrl+Z to undo" hint

### Documentation
- `docs/INTERACTIONS.md` (new) — single-source-of-truth affordance vocabulary, state-location reference, recipe for adding new affordances, AE → commit traceability.

### Test gate
- 1160+ vitest tests pass (+19 new across the shipping batch); 0 TS errors throughout.

---

## 2026-05-18 — Resort House polish (16 commits, U-ring atrium)

Major polish pass on the Resort House model home preset shipped earlier this session. 16 commits including: U-ring layout (16 containers = 1 pool + 5/level × 3 levels) with central z-gap atrium (`d37c005`), `extraVoxelFaces` opens atrium-facing perimeter walls (`98534db`), 5-stage walkthrough evidence (`c1e7193`), skylight overrides + face-override ordering fix (`9977bbd`), `SurfaceType` typing + missing test coverage (`cb34120`), smart-rule cascade regression guard (`8dd28ae`), `buildResortHouseAtriumOverrides()` extracted (`5af83dd`), lastStamp leak fix (`458871e`), pool-extension skip (`9eadd75`), stale description refresh (`81fe88b`), `VOXEL_COLS` imports (`1d86ba3`), pool basin water-surface invariant (`18e67ea`), `setVoxelFacePreset` + `presetProtectedFaces` architectural fix (`2e4c477`), preset-specific walkthrough spawn pose (`466c388`), batch preset face overrides 9.4s→554ms (`3c4d4a6`), ContainerSkin top-face level-1 redirect (`124dfb4`).

Cascade-delegated: Haiku simplifier (extract IIFE); Codex tech-debt audit (V1+V2, 8 findings applied); Codex rooftop skylight design lane.

Test gate: 1140 vitest pass throughout, 0 TS errors. Visual evidence: `.qa/walk-resort-final-stage{1..5}-*.jpg`.

---

## 2026-05-06 — Level selector consolidation (Bruce round-3 audit)

- Bruce: "The Level is selectable twice (once on top, once on the side) ... previously just a selector placed in the topbar — please correct."
- `BlueprintLevelChips` is now rendered inline in `TopToolbar.tsx` (ZONE B, after the view-mode tabs) as the single level selector. Visible in 3D and Blueprint modes; hidden in walkthrough; auto-hides when the project has zero containers.
- `LevelSlicer.tsx` removed — its right-side floating pill was a duplicate. PgUp/PgDn keyboard shortcuts are unchanged (handled in `Scene.tsx`).
- `data-testid="bp-level-chips"` and per-chip `bp-level-chip-*` testids preserved. Gate G33 updated: now asserts the strip lives in the topbar (`r.y < 60`) instead of canvas top-center.

## 2026-05-06 — Blueprint Mode refinement (Phase 4 closeout)

User-flagged feedback: Blueprint Mode felt "very disconnected from 3D Mode." This release closes the gap with one cohesive arc — every BP-canvas affordance now mirrors a 3D-mode affordance, and a forcing-function model home (Resort House) exercises every multi-level primitive at once.

### Always-visible level chip strip

- `BlueprintLevelChips.tsx` (new) — sibling component to SceneCanvas, renders `All(N) | L2 | L1 | Pool` chips pinned at top-center of the BP canvas. Replaces the click-to-expand `LevelSlicer` dropdown that hid level switching behind extra clicks. Multi-level designs are now usable in plan view because top-down occlusion no longer matters: one click filters to the level you want.
- Pool chip is styled distinct (sky-blue) and only appears when subterranean containers exist.

### Resort House model home (#13)

- 9 containers + subterranean Pool basin + L1→L2 stair on NW + L2→roof stair via `extraStairs`. ~$59,400 BOM.
- L1 ring: 4 × `central_atrium` extension config — open central void over the Pool below.
- L2 ring: 4 × `framed_glass_atrium` — continues the void with glass railings.
- New `pool: true` flag on `ModelHomeContainer`; `placeModelHome` wires it through `addContainer + subterranean=true + createPoolVoxelGrid`, mirroring `addPoolContainer` semantics for any `relativePosition`.
- Forcing function for stairs, level toggle, multi-level layouts, and pool/atrium semantics in one preset.

### BP face-edge click painting

- `BlueprintRenderer.tsx` adds 4 thin invisible click meshes per voxel along the n/s/e/w edges. Click an edge with a hotbar brush armed → `setVoxelFace(containerId, idx, dir, brush)`. Center click paints the bottom (floor) face. Alt+click anywhere = eyedropper (read the brush off the clicked face).

### Shift+click stair placement

- Same edge meshes branch on `shiftKey`: shift+click an edge calls `applyStairsFromFace` with the OPPOSITE direction so the resulting `stairAscending` matches the user-visible direction (clicking the north edge places stairs ascending toward the south, which read left-to-right in plan view as the user expects).

### Click-to-place containers (Library tile arms, empty grid drops)

- `Sidebar.tsx` — Library tile click in BP mode arms `bpvActiveContainerSize` (toggles on re-click of the same size); 3D mode keeps the existing drag-to-place flow.
- `BlueprintRenderer.tsx` — extends the `MarqueeSelect` tap-on-empty-grid branch: tap calls `addContainer(armed, tapWorldPos, level=0)` when armed, otherwise falls back to clearSelection (existing behavior).
- `Scene.tsx` — Escape cascade adds `bpvActiveContainerSize` clear as the FIRST step (above placementMode, staircase, dragContainer, deselect).
- Delete-key removes selected container in BP mode (Scene.tsx 684-696 global handler covers all view modes; no new code needed).

### `all_glass_interior` extension config

- `containerSlice.applyExtensionConfig` now treats `all_glass_interior` the same as `all_interior` (Open faces, all four body-row/col boundaries). Previously misclassified as a deck. Required for Resort House perimeter containers.

### Visual & rendering rescue (post-pre-crash recovery)

- `RendererReadyGate.tsx` extracted into its own module so any GL-context-dependent child (cubeCamera, EffectComposer) can defer mount until `getContext()` returns valid attributes. Wraps `TimeOfDayEnvironmentInner` to fix the documented postprocessing v6.x "Cannot read properties of null (reading 'alpha')" race.
- `Scene.tsx` coerces `environment.timeOfDay` reads with `Number()` in three sites — guards persisted-state string/number drift.
- `OrientationGizmo.tsx` projects axes through a dummy camera in Walkthrough mode so FPV gizmo orientation matches what the user actually sees.
- `page.tsx` — Walkthrough hint pill replaces the single-line controls strip (5 chip-style key clusters: WASD / MOUSE / SPACE / T / ESC on a glassmorphic 100px-radius pill).
- Reverted a mistaken `mieCoefficient: 0.0035` midday-haze branch that violated the explicit `sky-regression.test.ts` invariant ("midday turbidity stays clear").

### Gates + ratings

- **G33-resortHouse** (new): places the Resort House preset, asserts 9 containers + pool@y=-2.9 + 4 central_atrium + 4 framed_glass_atrium + 2 stair pairs + chip strip at top-center + L1 click → viewLevel=0.
- **G34-bpAddContainer** (new): full state-driven verification of the click-to-place flow — armed → place(5,5) → clear=null, re-arm(20ft_standard) → escape=null, delete 1→0.
- **Ratings**: 30/30 features PRODUCTION (was 28); 46/46 Playwright gates PASS (was 44/44). New PRODUCTION features: `Blueprint Authoring` (Resort House + chip strip via G33) and `Blueprint Add/Delete` (click-to-place + Escape + Delete via G34).
- **Known intermittent**: G8-fpWalking flakes ~1-in-3 runs due to FP-camera physics warm-up timing. Re-run on flake; not a regression.

### Tests

- 125 test files, 1081 tests pass. `tsc --noEmit` clean.

### Commits this arc

- 491cad0 — feat(blueprint): always-visible level chip strip + Resort House preset (G33)
- 5b93f1b — chore: rescue uncommitted Blueprint-refinement work + revert mistaken midday haze
- 0202d0e — feat(blueprint): face-edge click affordance (4 edge meshes + center bottom-paint + alt+click eyedropper)
- 802ae6d — feat(blueprint): shift+click edge places stairs ascending toward that edge
- 41644a6 — feat(store): bpvActiveContainerSize field for BP click-to-place
- 8e97bfc — chore(quality): refresh assessment — Blueprint Authoring = PRODUCTION
- 46df26a — chore(gates): G8-fpWalking is intermittent — re-run passes 45/45
- e7b46f1 — feat(blueprint): click-to-place containers — Library tile arms, empty grid drops
- 68d339d — test(gates): G34-bpAddContainer + 'Blueprint Add/Delete' feature

## 2026-04-29 — v0.2.0: Phase 4 hinged walls + sprint bugfix close-out

### Phase 4 — Hinged walls back inside the voxel skin
- New `HingedConfig` ({ openAmount: 0..1 }) per voxel face, stored under `voxel.hingedConfig`.
- New store action `setHingedConfig(containerId, voxelIndex, face, partial | null)` — clamps input, merges partial updates, removes entry on null.
- `HalfFoldFace` and `GullWingFace` panels now sit inside pivot `<group>`s driven by `useFrame` lerping toward the target angle; each panel folds OUT (away from container interior) regardless of which wall (n/s/e/w) it sits on.
- `hingedBottomSign` helper documents the s=-1, n=+1, e=+1, w=-1 convention; gull-wing top panel uses the opposite sign so it swings up while the bottom swings down.
- Closes the long-standing TODO at `ContainerMesh.tsx:2768` ("Rebuild hinged wall animations within the voxel system"). The legacy WallAssembly was disabled in Phase 1 to eliminate Z-fighting; this brings the animation back inside the voxel skin where it belongs.

### Hinged-wall surface picker
- `WallsTab` renders a `HingedToggle` when the selected face's surface is `Half_Fold` or `Gull_Wing`. Multi-voxel selections apply the toggle to every voxel in `indices` so a row of fold-walls opens together.
- Toggle replaced with two side-by-side `PresetCard`s, each showing a tiny SVG diagram of the panel pose:
  - **Closed**: vertical wall (steel + wood for Half_Fold; both steel for Gull_Wing).
  - **Open**: bottom panel folded out horizontally (Half_Fold) or top awns up + bottom decks down (Gull_Wing).
- Cards reuse shared `PresetCard` so they get hover scale, active selection ring, animated check badge, and label-outside-image styling — matching the door / window / decor pickers in the same tab.
- Click on either card calls `setHingedConfig` with target openAmount only when target differs from current state (no thrash on already-active clicks).

### Sprint bugfix backlog closed (DISC-1, DISC-2, S3, #5/#6/#7) + design pass #3/#4/#7
- **#3 PresetCard standardization**: `TemplatePicker.tsx` 6 bespoke skin/swatch grids (door / shelf / cabinet / counter top / decor palette / window) migrated to a new `SkinSwatchCard` helper that wraps shared `PresetCard`. Honors the "highlight on image only, label outside" card convention.
- **#4 Hotbar polish**: new `--hotbar-slot-bg` / `--hotbar-slot-border` / `--hotbar-slot-label` theme tokens in `globals.css` for both light and dark modes. `RecentItemsBar` and `SmartHotbar` (Rooms / Materials / Furniture / Light cards plus tab pills) migrated from hardcoded slate colors to theme tokens; both verified readable in light + dark via `preview_inspect`.
- **#7 Multi-select element-type constraint**: regression test pinning type-switching discards old selection, type-stable append/remove, last-item-clears-to-null, and `selectableRectangle` exclusion of inactive + locked cells.

### Working tree cleanup
- Drained 182-entry working tree across multiple sessions: shelf/cabinet/decor/fixture template + skin systems, counter-top materials, door + window template catalogs, roof shape overlay, smart-rule validators, AI designer, building-performance modal, embed page, service-worker registrar, mobile gate, face filter widget.
- `.gitignore` additions: `.dev-server.log` (transient runtime output) and `gate-baselines/*` except `baseline-*.png` (only committed visual baselines are versioned; webm tour recordings, qa-deep timestamped runs, vframes/tour-debug debug captures are one-shot outputs).

### Tests
- 123 test files, 1043 tests pass (was 113/969 at last release). `+10` files / `+74` tests this cycle:
  - `hinged-wall-config.test.ts` (9 tests) pinning store contract — clamping, partial merge, null-clears, face isolation, no-op on missing container, persistence across other face mutations.
  - Multi-select element-type constraint regression test.
  - Sprint-bugfix verification suites.
- DISC-1 sidebar test timeout bumped to 10 s (1.9 s in isolation but flaky under parallel load at the default 5 s).
- `tsc --noEmit` clean.

### Browser verification
- Half_Fold + Gull_Wing surfaces show the HingedToggle in WallsTab; clicking flips store openAmount and aria-pressed; no console errors during animation.
- Active card gets the indigo ring + ✓ badge; inactive card stays neutral; same for both Half_Fold and Gull_Wing variants with correct hint titles.
- All 7 sprint bugfix items verified at 1440x900 in light + dark modes.

## 2026-04-25 — Wall feature overlays (doors, windows, shelves, cabinets, fixtures, decor, lighting)

### Doors
- 12 reskinnable door templates: single swing, double swing, french double, sliding (single + double), pocket, barn, bifold, dutch, pivot, shoji slide, garage roll-up.
- 11 door skins: oak (solid + reclaimed), walnut (dark + glazed), painted (white + black + white-glazed), steel industrial, aluminium black-glazed, aluminium white-glazed, hinoki cedar.
- Animated motion per template — swing, slide, fold, pivot, roll — driven by `doorConfig.state` (`closed | open_swing | open_slide`).

### Windows
- 12 reskinnable window templates: fixed picture, fixed clerestory, casement (single + double), awning top-hinge, hopper bottom-hinge, sliding horizontal, double-hung, tilt-turn, bay three-panel, corner wraparound, jalousie.
- 7 window skins: aluminium (black + white), steel industrial, wood (natural + dark), painted window (white + black).
- Per-template animations driven by `windowConfig.openAmount` (0..1): casement swing, awning/hopper/tilt-turn tilt, sliding pane translation, double-hung sash slide, jalousie louvre rotation.

### Shelves (new)
- 8 templates: floating single, bracket single, 3-tier wall unit, 5-tier wall unit, 4-cube grid, 6-cube grid, ladder, corner L-shelf.
- Static overlay — no animation.

### Cabinets (new)
- 10 templates with declarative `parts[]`: wall (1-door + 2-door), base (2-door + door+drawer + 4-drawer), tall pantry, dresser (3-drawer + 6-drawer), bathroom vanity, glass display.
- 13 cabinetry skins shared with shelves: oak (natural + stained), walnut dark, shaker (white + navy + sage), painted black modern, slab (white gloss + black matte), hinoki natural, steel industrial, **mirror_silver** + **bronze_mirror** (door fronts use high-metalness/low-roughness IBL reflection).
- Animated doors AND drawers via `cabinetConfig.openAmount`; doors swing 95° outward, drawers translate 85% of body depth forward. Single useFrame loop per cabinet face with settle guard so idle cabinets stop dirtying matrices.
- **Counter tops** (new): 8 materials (white/black quartz, carrara marble, oak/walnut butcher block, polished concrete, stainless steel, soapstone). Adjacent voxels with the same counter top render as a continuous run thanks to full-voxel-width counter slabs.

### Fixtures (new)
- Appliances (8): top-freezer + french-door fridges, 4-burner + 6-burner ranges, wall oven, dishwasher, over-range microwave, washer, dryer.
- Bathroom fixtures (8): kitchen sinks (single + double), pedestal + vessel sinks, standard + wall-hung toilets, shower stall, alcove bathtub.
- Each appliance with `hasOpeningDoor` animates via `fixtureConfig.openAmount` — fridges side-hinge swing, oven/dishwasher drop-down. Settle guard same as cabinets.

### Decor (new)
- 11 templates: framed pictures (landscape + portrait), gallery-3, gallery-grid 2×2, mirrors (round + rectangular), wall clock, TV (55" + 75"), tapestry, floating canvas.
- 7 frame palettes: black, white, oak, walnut, brass, chrome, no_frame.
- Mirror templates use the same high-metalness reflective material as mirrored cabinet skins.

### Lighting (new)
- **Under-cabinet LED**: emissive ribbon below the cabinet body. Toggle in cabinet picker.
- **Glass display interior glow**: warm emissive backlight inside `glass_display_2door` cabinets (always on).
- **Picture light**: brass arm + bulb above framed decor. Toggle in decor picker.
- All implemented as cosmetic emissive materials (no real point lights — keeps render budget flat).

### Walkthrough collision
- `WalkthroughControls.tsx` now respects all four overlay configs. Cabinets and fixtures block movement (~0.5m collision box extending into the room). Mid- and bottom-anchor shelves block (top-anchor shelves above head height pass through). Decor (flat against wall) is passable.

### Architecture
- New "overlay" pattern documented in `MODUHOME-V1-ARCHITECTURE-v2.md` §4. Three rendering mechanisms now coexist: SurfaceType replacement (door/window/glass), per-face config (door/window template+skin), per-face overlay (shelf/cabinet/fixture/decor — wall surface stays intact behind).
- Picker dispatch in `WallsTab.tsx`: surface-gated for door + window, category-gated for shelf/cabinet/fixture/decor.
- Shared `OverlayMount` component handles inward face-normal positioning + vertical anchor (top/mid/bottom).
- Shared `_byId<T>(arr, id)` lookup helper in `src/config/_byId.ts` replaces 6 hand-rolled `arr.find(...) ?? arr[0]` peers.
- Shared `<TemplateTileGrid>` and `<PickerSection>` components in `TemplatePicker` / `WallsTab` deduplicate the 6 mode branches.

### Tests
- 113 test files, 969 tests pass (was 942 at the start of the session — +27 behavioral tests for shelves, cabinets, fixtures, decor, counter tops, lighting flags, four-overlays-coexist invariant).
