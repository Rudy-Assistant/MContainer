# Smart Systems Status

**Date:** 2026-03-12
**Sprint:** 16

## Status Matrix

| System | Blueprint Section | Status | Evidence |
|--------|------------------|--------|----------|
| Adjacency auto-merge | SS11.1 | **PRODUCTION** | `refreshAdjacency` runs on move/add/remove. `_preMergeWalls` tracks originals. Only Solid_Steel faces merge to Open. User-painted faces preserved. 448+ tests cover merge/restore. |
| Extension auto-door | SS11 (new) | **PRODUCTION** | Sprint 16: `_applyExtensionDoors` / `_restoreExtensionDoors`. Deck extensions set body boundary faces to Door, interior to Open. Only Solid_Steel modified. `_preExtensionDoors` saves originals for restore. 5 tests (DOOR-AUTO-1 through 5). |
| Staircase auto-void | SS10 | **FUNCTIONAL** | `applyStairsFromFace` voids ceiling above staircase within same container. Cross-container void exists but partial. Level visibility tiers work. |
| Context-aware UI | SS11.2 | **NOT IMPLEMENTED** | Hotbar does not filter based on raycaster target. Same slots shown regardless of hover context. Two-tier hotbar (Rooms/Materials tabs) exists but is mode-based, not context-aware. |
| CSG morphing | SS11.3 | **NOT IMPLEMENTED** | @react-three/csg not installed. Voxel faces use flat planes, not CSG geometry. |
| RevoluteJoint doors | SS10 | **NOT IMPLEMENTED** | Door system uses state cycle (closed/open_swing/open_slide) with simple geometry toggle. No physics hinge joints. |
| Theme texture engine | SS12 | **PRODUCTION** | Sprint 16: Per-theme texture sets (Industrial: corrugated steel/concrete, Japanese: cedar/bamboo/shoji, Desert: stucco/terracotta/plaster). 11 PBR texture directories with color/normal/roughness maps. Auto-loaded via TextureLoader. |
| Furniture GLB loading | SS (asset) | **PRODUCTION** | Sprint 16: 30 Kenney furniture GLBs mapped to catalog. useGLTF + GLBErrorBoundary fallback to colored boxes. Theme-aware material swapping on load. |

## Detailed Notes

### Adjacency Auto-Merge
- Trigger: `moveContainer`, `addContainer`, `removeContainer`, `stackContainer`
- Behavior: When containers are flush (within STICKY_THRESHOLD=0.3), Solid_Steel shared faces become Open
- Restoration: Separation restores original faces from `_preMergeWalls`
- User intent: Painted faces (Glass, Wood, etc.) are never auto-modified

### Extension Auto-Door (NEW Sprint 16)
- Trigger: `setAllExtensions` with any non-'none' config
- Mapping: Row 0 ext -> Row 1 body north, Row 3 ext -> Row 2 body south, Col 0 ext -> Col 1 body west, Col 7 ext -> Col 6 body east
- Deck extensions: body boundary faces become `Door`
- Interior extensions: body boundary faces become `Open`
- Only level 0 affected (level 1 body walls are Open by default)
- Deactivation: `_restoreExtensionDoors` reverses all changes

### Staircase Auto-Void
- Within-container: Works. Ceiling above staircase voxel becomes Open.
- Cross-container: Partial. `applyStairsFromFace` checks `c.supporting` for container above.
- Visual: Staircase geometry renders correctly in realistic mode.

### Items NOT Implemented (Deferred)
- **CSG morphing**: Would require @react-three/csg (experimental). Current approach uses flat voxel face planes.
- **RevoluteJoint doors**: Would require @react-three/rapier. Current approach uses state-based open/close toggle.
- **Context-aware hotbar**: Would require raycaster context detection. Current hotbar uses explicit Rooms/Materials tab selection.
