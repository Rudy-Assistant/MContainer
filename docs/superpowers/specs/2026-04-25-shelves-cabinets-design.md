# Shelves & Cabinets — Design Spec

**Date:** 2026-04-25  
**Author:** Claude (perpetual session)  
**Status:** Approved by user — ready for implementation plan

## Goal

Add **shelves** and **cabinets** as wall-mounted features in ModuHome's voxel
designer, parallel to the door + window template/skin/animation pattern shipped
earlier in this session. Users pick from a catalog of templates (geometry/motion)
and skins (finish/material), then place them on any wall face — without
destroying the wall behind them.

## Decisions (locked in via brainstorming Q&A)

| # | Question | Decision |
|---|----------|----------|
| 1 | One combined system or two? | **Two separate categories** — Shelf + Cabinet, parallel to Door + Window |
| 2 | Replace face or overlay on wall? | **Overlay** — separate config field on Voxel; wall surface stays intact behind |
| 3 | Cabinet animation surface? | **Mixed** — templates declare `parts[]` of doors and/or drawers; both motion types |
| 4 | Skin catalog structure? | **Shared cabinetry catalog** for shelves + cabinets (separate from doors/windows) |
| 5 | Mirrored skins? | **Yes** — `mirrorDoors: boolean` flag; door fronts get high-metalness/low-roughness MeshStandardMaterial; body keeps regular material |

## Data Model

### New types in `src/types/container.ts`

```ts
export interface ShelfConfig {
  template: import('@/config/shelfTemplates').ShelfTemplateId;
  skin: import('@/config/cabinetrySkins').CabinetrySkinId;
  verticalAnchor?: 'top' | 'mid' | 'bottom';   // default 'mid'
}

export interface CabinetConfig {
  template: import('@/config/cabinetTemplates').CabinetTemplateId;
  skin: import('@/config/cabinetrySkins').CabinetrySkinId;
  verticalAnchor?: 'top' | 'mid' | 'bottom';   // template's default if absent
  openAmount?: number;                          // 0..1, animates doors AND drawers
}
```

### Voxel extensions

```ts
shelfConfig?:   Partial<Record<keyof VoxelFaces, ShelfConfig>>;
cabinetConfig?: Partial<Record<keyof VoxelFaces, CabinetConfig>>;
```

A face can have **both** a shelfConfig and a cabinetConfig (uncommon but valid),
plus its underlying SurfaceType (Solid_Steel, Wood_Hinoki, etc.) — overlay model.

## New Files

| File | Purpose |
|------|---------|
| `src/config/shelfTemplates.ts` | 8 shelf templates with geometry hints |
| `src/config/cabinetTemplates.ts` | 10 cabinet templates with declarative `parts[]` |
| `src/config/cabinetrySkins.ts` | 13 skins shared by shelves + cabinets (incl. 2 mirrored) |
| `src/utils/cabinetrySkinMaterials.ts` | THREE-material cache (parallel to `doorWindowSkinMaterials.ts`) |

## Modified Files

| File | Change |
|------|--------|
| `src/types/container.ts` | Add `ShelfConfig`, `CabinetConfig` interfaces + voxel fields |
| `src/store/slices/voxelSlice.ts` | Add `setShelfConfig` + `setCabinetConfig` (merge-style, mirroring `setWindowConfig`); add to slice interface |
| `src/store/useStore.ts` | Re-export the two new actions if not auto-flowed by slice composition |
| `src/config/surfaceCategories.ts` | Fill `shelf` placeholder variants; add `cabinet` category. Both flagged `volumetric: true` so the picker knows they don't replace the surface |
| `src/components/objects/ContainerSkin.tsx` | Add `ShelfFace` + `CabinetFace` components; mount overlay in `SingleFace.renderVisual()` after the surface mesh; extend `FaceVisual` props with `shelfConfig` + `cabinetConfig` |
| `src/components/ui/VoxelPreview3D.tsx` | Plumb `shelfConfig` + `cabinetConfig` through `PreviewFace` to `FaceVisual` for inspector preview parity |
| `src/components/ui/finishes/TemplatePicker.tsx` | Extend `mode` union to `'door' \| 'window' \| 'shelf' \| 'cabinet'`; add shelf and cabinet rendering branches |
| `src/components/ui/finishes/WallsTab.tsx` | Add category-gated TemplatePicker mounts for `shelf` and `cabinet`; add a "Remove" link inside each picker that nulls the config field |

## Renderer Architecture

### Mounting strategy

Overlay sits in front of the wall along the face normal:
- NS face (normal ±Z): overlay group at `z = sign × (PANEL_THICK/2 + overlayDepth/2)`
- EW face (normal ±X): overlay group at `x = sign × (PANEL_THICK/2 + overlayDepth/2)`
- Sign comes from `dir` (`'n' | 's' | 'e' | 'w'`) — overlay extends *into* the
  room, never outward.

Vertical anchor offsets the group:
- `top`    → `+h × 0.33` (upper third)
- `mid`    → `0` (centered)
- `bottom` → `-h × 0.33` (lower third)

### ShelfFace

Static geometry. No `useFrame`, no refs. Per-template emits 1-N horizontal
plank meshes plus optional brackets/end-panels.

### CabinetFace

Templates declare parts:

```ts
parts: [
  { kind: 'door',   region: { x: -0.25, y: 0, w: 0.5, h: 0.7 }, hingeEdge: 'left' },
  { kind: 'drawer', region: { x: +0.25, y: 0, w: 0.5, h: 0.2 } },
]
```

- **Static body** (carcass top/bottom/sides/back) renders unanimated.
- **Door parts** wrap in a swing group; `rotateY` driven by `openAmount`.
- **Drawer parts** wrap in a slide group; translated along face normal by `openAmount × drawerDepth`.
- **Single useFrame loop per cabinet face** lerps one `openRef` toward target;
  every part reads its transform from that one value.

Material resolution:
- **Body, drawer side panels** → `bodyColor` (always non-mirrored).
- **Door fronts, drawer fronts** → `doorColor` for non-mirrored skins; mirror
  material (metalness=1.0, roughness=0.05, color=#f0f0f0) for `mirrorDoors: true` skins.
- **Handles** → `handleColor` (small cylinder pulls or knob primitives per template).
- **Glass display cabinet** → door fronts use `MeshPhysicalMaterial` with
  `transmission: 0.85`.

## Catalogs

### Shelf templates (8)

| ID | Label | Geometry |
|----|-------|----------|
| `floating_single` | Floating Shelf | 1 plank, hidden mount |
| `bracket_single` | Bracket Shelf | 1 plank + 2 visible L-brackets |
| `wall_unit_3` | 3-Tier Wall Unit | 3 stacked planks + 2 side panels |
| `wall_unit_5` | 5-Tier Wall Unit | 5 stacked planks + 2 side panels |
| `cube_grid_2x2` | 4-Cube Grid | 2×2 open cube grid |
| `cube_grid_3x2` | 6-Cube Grid | 3×2 open cube grid |
| `ladder` | Ladder Shelf | A-frame leaning, 4 stepped planks |
| `corner_l` | Corner L-Shelf | L-shaped 3-tier (single-face render in V1) |

### Cabinet templates (10) — each with `parts[]`

| ID | Label | Doors | Drawers | Anchor |
|----|-------|------:|--------:|--------|
| `wall_2door` | Wall Cabinet | 2 swing | — | top |
| `wall_1door` | Narrow Wall Cabinet | 1 swing | — | top |
| `base_2door` | Base Cabinet | 2 swing | — | bottom |
| `base_door_drawer` | Base Drawer + Door | 1 swing | 1 slide | bottom |
| `base_4drawer` | 4-Drawer Base | — | 4 slide | bottom |
| `tall_pantry` | Tall Pantry | 2 swing (full height) | — | full |
| `dresser_3drawer` | 3-Drawer Dresser | — | 3 slide | bottom |
| `dresser_6drawer` | 6-Drawer Dresser | — | 6 slide (3 wide × 2 tall) | mid |
| `bathroom_vanity` | Bathroom Vanity | 2 swing | — | bottom |
| `glass_display_2door` | Glass Display | 2 swing (glazed) | — | full |

### Cabinetry skins (13, shared shelf + cabinet)

| ID | Label | Hint | doorStyle | mirrorDoors |
|----|-------|------|-----------|-------------|
| `oak_natural` | Natural Oak | wood | shaker | — |
| `oak_stained` | Stained Oak | wood | shaker | — |
| `walnut_dark` | Dark Walnut | wood | shaker | — |
| `shaker_white` | Shaker White | painted | shaker | — |
| `shaker_navy` | Shaker Navy | painted | shaker | — |
| `shaker_sage` | Shaker Sage | painted | shaker | — |
| `painted_black_modern` | Modern Black | painted | slab | — |
| `slab_white_gloss` | Gloss White | painted | slab | — |
| `slab_black_matte` | Matte Black | painted | slab | — |
| `hinoki_natural` | Hinoki Cedar | wood | shaker | — |
| `steel_industrial` | Steel Industrial | metal | slab | — |
| `mirror_silver` | Silver Mirror | metal | slab | ✓ |
| `bronze_mirror` | Bronze Mirror | metal | slab | ✓ |

Mirrored skins are tagged in `recommendedSkins` for cabinet templates only
(open shelves can fall back to non-mirrored body color when assigned a
mirrored skin — the picker will note this).

## Picker UI

**`TemplatePicker`** — extend the existing `mode` prop:

```ts
mode: 'door' | 'window' | 'shelf' | 'cabinet'
```

Each new mode follows the same layout used by doors/windows:
1. Section header + Open/Close toggle (cabinets only — shelves are static)
2. 2-column template tile grid
3. "Recommended only / Show all" link
4. 3-column skin swatch grid

Mirrored skins render with a metallic-gradient swatch (silver gradient overlay
in the corner of the swatch tile) so users can tell at a glance.

**`WallsTab`** — add category-gated picker mounts:

```tsx
{selectedWallCategory === 'shelf' && (
  <TemplatePicker mode="shelf" containerId={…} voxelIndex={…} face={face} />
)}
{selectedWallCategory === 'cabinet' && (
  <TemplatePicker mode="cabinet" containerId={…} voxelIndex={…} face={face} />
)}
```

The existing door/window picker mounts stay surface-gated (they appear when
`surface === 'Door'` or `surface.startsWith('Window_')`). The new shelf/cabinet
mounts are *category-gated* — they appear when the user selects the Shelf or
Cabinet category chip in `CategoryRow`, regardless of underlying surface. This
is the overlay model in action: a Solid_Steel wall *can* have a shelf on it.

**Default selection** — first time a user picks Shelf or Cabinet for a face:
- Shelf: `{ template: 'wall_unit_3', skin: 'oak_natural' }`
- Cabinet: `{ template: 'wall_2door', skin: 'shaker_white' }`

**Remove** — each picker shows a "Remove shelf" / "Remove cabinet" link button
at the bottom that nulls the config field for that face.

## Test Plan

1. **Behavioral tests** (vitest):
   - `setShelfConfig` / `setCabinetConfig` merge with existing config
   - `clearShelfConfig` / `clearCabinetConfig` (or `set…Config(…, null)`) remove field
   - Two faces of the same voxel can hold independent shelfConfigs
   - A face can hold shelfConfig + cabinetConfig + a SurfaceType simultaneously
   - Catalog round-trips: every templateId is found by `getShelfTemplate(id)` etc.
2. **Type check**: `npx tsc --noEmit` clean.
3. **Browser verification** (probe script):
   - Place a model home, set 3 shelf templates × 3 skins, screenshot inspector preview
   - Set 4 cabinet templates × 3 skins (incl. 1 mirrored), screenshot
   - Open cabinets via the toggle, verify door swing + drawer slide animation
4. **Sprint Close Checklist** items (per `CLAUDE.md`): tsc 0 errors, vitest full pass,
   `/simplify` pass, manual browser walk-through.

## Out of Scope (defer)

- Drei `Reflector` for true mirror reflections (current MeshStandardMaterial
  high-metalness approximation is sufficient and zero-cost).
- Shelf items / decorations (books, vases, plants on shelves).
- Per-part skin override (one cabinet with white body and walnut drawer fronts).
- Built-in vs. surface-mounted variants (V1 always surface-mounted; built-ins
  would require recess geometry into the wall).
- Counter tops on base cabinets (a stretch — kitchen base cabinets ideally
  span multiple voxels and share a continuous counter; defer until a
  voxel-spanning module concept exists).
- Sink + faucet on bathroom vanity (decorative; out of scope).

## Risks

- **Render cost**: each cabinet template emits ~6-12 meshes per face. With many
  cabinets in a kitchen scene this could add up — but each mesh shares a
  cached material from `cabinetrySkinMaterials.ts`, so geometry is the only
  per-instance cost. Still well under existing voxel-renderer budget.
- **Animation timing**: a single `openRef` per cabinet face is cheap; doors and
  drawers all read from it. No risk identified.
- **Picker UI clutter**: with 4 modes (door/window/shelf/cabinet) the
  TemplatePicker grows. If it crosses ~600 lines, split into one file per mode.
  Threshold check during implementation.

## Spec Self-Review (post-write)

- ✓ No "TBD" / "TODO" placeholders.
- ✓ All catalog entries enumerated, no "..." in tables.
- ✓ Internal consistency: data model matches files-list matches renderer
  architecture matches catalogs matches picker UI.
- ✓ Single implementation plan in scope (no decomposition needed).
- ✓ No ambiguities found — every choice is explicit.
- ✓ Render cost flagged as risk; deferred items explicit.

Approved for plan handoff.
