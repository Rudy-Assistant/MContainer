# Sprint: FinishesPanel Concept Art Redesign — Handoff

> **Use this doc to initiate:** `/brainstorming` in a fresh Claude Code session.
> **Paste the prompt at the bottom of this file to start.**

## Goal

Redesign the FinishesPanel to match the concept art: tabbed layout (Flooring/Walls/Lighting/Electrical), texture thumbnail swatches, and wall empty-state fix. Close the visual and interaction gap between current implementation and the aspirational UI.

## Current State (as of Sprint C completion)

### What Works
- Floor face click → FinishesPanel shows Flooring Material section with 6 color swatches ✅
- Ceiling face click → FinishesPanel shows Ceiling Material + Lighting sections ✅
- Selection routing: voxel→WallTypePicker, face→FinishesPanel, object→SkinEditor ✅
- Bottom bar: icon tabs, SVG thumbnails, sidebar-aware positioning, auto-sync ✅

### What's Broken
1. **Wall faces show empty panel** — When wall surface is `Open` (common after auto-merge), `getFinishOptionsForFace('Open', 'n')` returns all-false flags → FinishesPanel renders nothing
2. **No texture thumbnails** — All material swatches are plain color blocks, not the realistic texture previews from concept art
3. **No tab structure** — FinishesPanel is a flat conditional list, not tabbed like the concept art's "Flooring / Walls / Lighting" layout
4. **No voxel-level configuration** — Clicking a voxel body (no face) shows WallTypePicker but no way to configure all faces at once

## Architecture Analysis

### Selection → Panel Routing (Sidebar.tsx lines 505-513)

```
if (selectedObjectId)           → SkinEditor (furniture/lights)
else if (target.type = voxel)   → WallTypePicker (surface type grid)
else if (target.type = face)    → FinishesPanel (material/finish options)
else                            → Container Properties
```

### Key Files

| File | Lines | What It Does |
|------|-------|-------------|
| `src/components/ui/FinishesPanel.tsx` | 249 | Flat conditional sections based on face+surface type |
| `src/components/ui/WallTypePicker.tsx` | 62 | Surface type grid (13 wall / 5 floor / 2 ceiling types) |
| `src/components/ui/Sidebar.tsx` | 505-513 | Routing conditional in Inspector component |
| `src/config/finishPresets.ts` | 142 | `getFinishOptionsForFace(surface, face)` → 10 boolean flags |
| `src/config/wallTypes.ts` | 46 | `getWallTypesForContext(inspectorView, face)` → type entries |
| `src/components/objects/ContainerSkin.tsx` | 2284-2380 | Click handler: setSelectedVoxel + setSelectedFace |
| `src/hooks/useSelectionTarget.ts` | 94 | Derives SelectionTarget from store atoms |
| `src/config/materialCache.ts` | — | PBR material singletons (has texture paths) |
| `src/config/themes.ts` | — | Theme definitions with material mappings |

### FinishesPanel Section Visibility Matrix

| Section | Floor (bottom) | Wall (n/s/e/w) | Ceiling (top) |
|---------|---------------|----------------|---------------|
| Exterior Material | ✗ | ✓ (if wall surface) | ✗ |
| Interior Paint | ✗ | ✓ (if wall surface) | ✗ |
| Glass Tint | ✗ | ✓ (if glass/window) | ✗ |
| Frame Color | ✗ | ✓ (if window/door) | ✗ |
| Door Style | ✗ | ✓ (if door) | ✗ |
| Flooring Material | ✓ | ✗ | ✗ |
| Ceiling Material | ✗ | ✗ | ✓ |
| Lighting | ✗ | ✗ | ✓ |
| Light Color | ✗ | ✗ | ✓ (if light) |
| Electrical | ✗ | ✓ (if wall surface) | ✗ |

### The "Open Wall" Bug

When two containers are adjacent, `mergeBoundaryVoxels` sets shared wall faces to `Open`. When the user clicks an `Open` wall face:
- `getFinishOptionsForFace('Open', 'n')` returns ALL FALSE
- FinishesPanel renders zero sections
- User sees empty panel → thinks walls are broken

Fix: When all flags are false, show WallTypePicker inline so user can change the surface type first.

### Concept Art Description

The concept art shows:
- **Left panel:** "Interior Finishes" header with ✕ close button
- **Three tabs:** Flooring | Walls | Lighting (horizontal tab bar)
- **Content:** 3-column grid of realistic texture thumbnail swatches (~80×80px each)
  - Flooring tab: Oak Wood, Polished Concrete, White Marble, Bamboo, etc.
  - Walls tab: implied same pattern with wall materials
  - Lighting tab: implied fixture options
- **Each swatch:** Realistic PBR texture crop (not color blocks), label below
- **3D viewport:** Realistic interior view with applied materials visible
- **Bottom bar:** Furniture / Appliances / Fixtures category tabs with thumbnail cards

### Material Texture Assets

The codebase already has PBR material definitions in `materialCache.ts` with texture paths. Each material has:
- `map` (diffuse/albedo texture)
- `normalMap` (surface detail)
- `roughnessMap` / `metalnessMap`

These textures can be cropped/downsampled to create thumbnail swatches. The textures live in `/public/textures/` (if they exist) or are referenced from theme definitions.

**Check:** Verify which texture files actually exist in `/public/textures/`. If none, thumbnails will need to be either:
- Procedural canvas renders using the material colors
- Static PNG sprite sheet (design-time asset)
- Offscreen Three.js renders of material-mapped quads

## Design Decisions Already Made (from this session)

- **Unified selection model:** Mutual exclusion between voxel and object selection ✅
- **SkinEditor inside Sidebar:** No longer floating, routes via selectedObjectId check ✅
- **SVG thumbnails for forms:** `FormThumbnails.tsx` with procedural SVGs ✅
- **CSS variables for theming:** All new UI uses `var(--text-main)` etc. ✅
- **`isWallDirection()` type guard:** Shared in `src/types/sceneObject.ts` ✅
- **`HIGHLIGHT_COLOR_SELECT`:** All highlight colors use canonical constants ✅

## Test Status

- 685 tests passing, 0 type errors
- 81 test files across 20 commits this session

---

## Prompt to Start Brainstorming

Copy and paste this into a new Claude Code session:

```
/brainstorming Full FinishesPanel concept art redesign. Read the handoff doc at docs/handoff/sprint-finishes-panel-redesign.md for complete context.

Three interrelated changes:

1. **Tabbed FinishesPanel** — Replace the flat conditional section list with a tabbed layout: Flooring / Walls / Ceiling / Electrical tabs. Always show all tabs regardless of which face is clicked, but auto-select the relevant tab. The "Walls" tab should combine WallTypePicker (surface type) + wall finish options into one flow: pick surface type first, then see material options for that surface.

2. **Texture thumbnail swatches** — Replace plain color-block swatches with realistic texture previews. Check /public/textures/ for existing PBR textures that can be cropped. If none exist, use procedural canvas renders or static sprites. Each swatch should be ~64×64px with the material name below.

3. **Wall empty-state fix** — When a wall face has surface "Open", show a prompt to change the surface type (inline WallTypePicker) before showing finish options. This fixes the "walls don't work" perception.

Bonus (if scope allows):
4. **Voxel configuration panel** — When target.type is 'voxel' (no face selected), show a panel that lets users apply preset configurations to the entire voxel (all faces at once). E.g., "Studio" preset = glass front wall, solid sides, wood floor.

The concept art reference shows: tabbed "Interior Finishes" panel with Flooring/Walls/Lighting tabs, 3-column grid of ~80×80px realistic texture swatches, and a polished dark-theme aesthetic. See the handoff doc for the full architecture analysis including file locations, routing logic, and the Open-wall bug details.
```
