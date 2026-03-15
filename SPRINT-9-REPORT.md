# Sprint 9 Report — Extension Overlap, User Save, PBR Textures

**Date:** 2026-03-12
**Baseline:** 157 tests, 0 type errors (post-Sprint 8)
**Final:** 164 tests, 0 type errors

---

## Stream 1: Extension Overlap Prevention (STRUCTURAL BUG)

### Problem
`checkOverlap` and smart placement used body-only AABBs. When extensions activated (e.g., "All Deck"), the expanded physical footprint overlapped adjacent containers without detection.

### Solution
- `getActiveExtensions(c)` — scans voxel grid rows 0/3, cols 0/7 for non-Open faces
- `getFullFootprint(c)` — expands body AABB by `dims.height` per active extension, rotation-aware
- All overlap checks updated: `checkOverlap`, smart placement, drag rejection, extension activation
- `placeModelHome` gets `skipSmartPlacement` + `skipOverlapCheck` bypass flags for pre-designed layouts
- Smart placement offsets enlarged: `dims.length + haloExt + 0.05` (was `dims.length + 0.05`)

### Tests (7 new)
| ID | Status | Description |
|----|--------|-------------|
| OVR-1 | PASS | getFullFootprint returns body AABB when no extensions |
| OVR-2 | PASS | getFullFootprint expands when extensions activated |
| OVR-3 | PASS | checkOverlap detects body vs active extension overlap |
| OVR-4 | PASS | Smart placement offsets account for extensions |
| OVR-5 | PASS | Activating overlapping extensions is blocked |
| OVR-6 | PASS | getActiveExtensions detects north extension only |
| OVR-7 | PASS | Deactivating extensions always succeeds |

---

## Stream 2: User-Saveable Configurations

### Problem
Users could apply presets but not save their own designs back to the library.

### Solution
Three save tiers implemented:
1. **libraryBlocks** — single-voxel 6-face presets (save from inspector)
2. **libraryContainers** — full container templates with voxel grid
3. **libraryHomeDesigns** — multi-container home designs with relative positions

Store actions: `saveHomeDesign(label)`, `loadHomeDesign(designId)`, extended `removeLibraryItem(id)`.

All three included in persist partialize (IndexedDB), export/import, and temporal (undo-tracked).

### UI
- "Saved" tab in UserLibrary.tsx:
  - Model Homes gallery (6 pre-built)
  - My Homes section with save button, name input, load-on-click, trash delete
  - My Blocks / My Containers with placeholder hints
  - Preset sections (Spatial, Styles, Structural)

### Tests (7 new)
| ID | Status | Description |
|----|--------|-------------|
| SAVE-1 | PASS | saveBlockToLibrary adds to libraryBlocks |
| SAVE-2 | PASS | saveContainerToLibrary captures voxel grid |
| SAVE-3 | PASS | saveHomeDesign captures containers with relative positions |
| SAVE-4 | PASS | Applying user voxel preset sets all 6 faces |
| SAVE-5 | PASS | loadHomeDesign creates containers with saved config |
| SAVE-6 | PASS | libraryHomeDesigns in persist partialize |
| SAVE-7 | PASS | Deleting user preset removes from list |

---

## Stream 3: PBR Texture Pipeline

### Problem
All materials were procedural (flat colors + one runtime corrugation normal map). No real textures.

### Solution
- Downloaded CC0 PBR textures from AmbientCG (Metal032, WoodSiding001, Ground037)
- 9 texture files: `public/assets/materials/{Corrugated_Steel,Deck_Wood,Ground}/{color,normal,roughness}.jpg`
- `src/config/pbrTextures.ts` — singleton loader with graceful fallback on failure
- `PBRTextureLoader` component applies textures to industrial theme materials + ground
- Ground plane upgraded from flat green to textured grass
- Sky parameters tuned: midday rayleigh 2.0, turbidity 8

### Glass Verification
Glass already uses `MeshPhysicalMaterial` with `transmission: 1.0`, `ior: 1.5`, `thickness: 0.1`. No changes needed.

### Screenshots Captured
| Time | File | Description |
|------|------|-------------|
| 8:00 AM | sprint9-pbr-morning-8am.png | Cool morning light, grass texture visible |
| 12:00 PM | sprint9-pbr-noon-12pm.png | Bright neutral midday |
| 3:00 PM | sprint9-pbr-industrial-15h.png | Default afternoon view |
| 6:00 PM | sprint9-pbr-golden-6pm.png | Warm golden hour with orange sky |
| — | sprint9-saved-tab-with-home.png | Saved tab with "My Beach House" design |

---

## /simplify Fixes
1. Removed dead `useTextureColor` parameter from `applyTexturesToMaterial`
2. Removed redundant `tex.needsUpdate = true` in texture loader
3. Consolidated ground texture application into `PBRTextureLoader` (removed duplication from Ground)
4. Removed unused imports (`GripVertical`, `Home`) from UserLibrary.tsx
5. Moved mid-file `ContainerSize` import to top of UserLibrary.tsx

---

## Files Changed

| File | Change |
|------|--------|
| `src/store/spatialEngine.ts` | `getActiveExtensions`, `getFullFootprint`, updated `checkOverlap` |
| `src/store/useStore.ts` | Extension overlap guards, `skipSmartPlacement`/`skipOverlapCheck` params, `saveHomeDesign`/`loadHomeDesign` actions, `libraryHomeDesigns` state, persist partialize update |
| `src/types/container.ts` | `LibraryHomeDesign` interface |
| `src/components/ui/UserLibrary.tsx` | My Homes section, save/load/delete UI |
| `src/config/pbrTextures.ts` | NEW — PBR texture loading singleton |
| `src/components/three/Scene.tsx` | PBRTextureLoader component, Ground texture integration, sky parameter tuning |
| `src/__tests__/extension-overlap.test.ts` | NEW — 7 overlap tests |
| `src/__tests__/user-save.test.ts` | NEW — 7 save system tests |
| `src/__tests__/smart-placement.test.ts` | Updated blocker positions for new offsets |
| `public/assets/materials/` | NEW — 9 PBR texture files (CC0, AmbientCG) |
| `MODUHOME-V1-ARCHITECTURE.md` | Sprint 9 sections added |

---

## Completion Criteria

- [x] Extensions cannot overlap other containers' bodies or extensions
- [x] getFullFootprint accounts for active extensions
- [x] User can save voxel presets, container templates, and home designs
- [x] Saved configs persist in IndexedDB (via partialize)
- [x] Saved configs appear in Library UI with apply/delete options
- [x] PBR textures loaded for steel and wood (with graceful fallback)
- [x] Glass uses MeshPhysicalMaterial transmission
- [x] Ground plane textured with grass
- [x] Golden hour screenshot shows material quality improvement
- [x] 164 tests passing (target: 162+)
- [x] 0 type errors
- [x] Architecture doc updated
