# Changelog

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
