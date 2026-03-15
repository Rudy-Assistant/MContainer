# ModuHome Quality Standards

This document defines what "done" means for every feature category.
Referenced by every future sprint prompt. The agent must rate its output against these standards.

---

## Container Rendering

- **PRODUCTION**: PBR materials with visible texture detail (normal maps for steel, grain for wood). Theme switching instant. Shadows cast correctly.
- **FUNCTIONAL**: Correct colors per surface type, flat materials acceptable. Themes change colors.
- **BROKEN**: Wrong colors, missing faces, z-fighting, invisible containers.

## Furniture

- **PRODUCTION**: Real 3D models (.glb) at correct scale, casting shadows, positioned correctly in room context.
- **FUNCTIONAL**: Colored boxes at correct dimensions with optional labels (current state).
- **BROKEN**: Wrong positions, overlapping, labels obscuring view, furniture outside containers.

## Multi-Container Layouts

- **PRODUCTION**: Containers properly adjacent, shared walls merged, no overlaps, rooms logically arranged with distinct furniture.
- **FUNCTIONAL**: Containers placed without overlap, merge works, generic room assignment.
- **BROKEN**: Overlapping containers, extensions interpenetrating, nonsensical room placement.

## Model Homes

- **PRODUCTION**: Load and produce a recognizable home layout with distinct rooms, appropriate furniture, and a result a user would save.
- **FUNCTIONAL**: Containers placed at correct positions with roles assigned. Room differentiation via face colors only.
- **BROKEN**: Overlapping containers, missing levels, wrong configurations.

## Walkthrough (First Person)

- **PRODUCTION**: Navigate interior at eye height, see furniture/materials, see through glass, collision with walls, smooth movement.
- **FUNCTIONAL**: Navigate with WASD, correct camera height, can see materials. Collision exists but imperfect.
- **BROKEN**: Camera starts underground, passes through walls freely, visual noise obscures view, controls unresponsive.

## Export

- **PRODUCTION**: GLB opens in Blender/SketchUp with correct geometry and materials. JSON re-imports perfectly.
- **FUNCTIONAL**: JSON state can be re-imported to reconstruct the design. GLB code exists but not in UI.
- **BROKEN**: Export produces empty/corrupt files, import loses data.

## Blueprint Mode

- **PRODUCTION**: Clean 2D floor plan with room labels, wall type colors, dimensions, grid lines, legend. Orthographic projection.
- **FUNCTIONAL**: Top-down view showing container outlines, voxel face colors, basic labels.
- **BROKEN**: 3D perspective instead of orthographic, no labels, no wall differentiation.

## Theme System

- **PRODUCTION**: Each theme produces a visually distinct, cohesive architectural style. Materials have appropriate texture detail.
- **FUNCTIONAL**: Themes change material colors distinctly. PBR properties differ per theme.
- **BROKEN**: Themes look the same, materials don't update, visual artifacts on switch.

## Stacking / Multi-Level

- **PRODUCTION**: Containers stack with correct alignment, staircase openings auto-void across levels, level visibility tiers work.
- **FUNCTIONAL**: Stacking places containers at correct Y, basic level visibility works.
- **BROKEN**: Containers overlap vertically, staircase voids don't propagate, level filtering broken.

## Save/Load System

- **PRODUCTION**: Save/load containers, blocks, and full home designs reliably. Survives page reload. Export/import for sharing.
- **FUNCTIONAL**: IndexedDB persistence works, 3-tier save system functional.
- **BROKEN**: Data lost on reload, save corrupts state, import fails.

## Door System

- **PRODUCTION**: Doors visually animate (swing/slide) on toggle, state persists, undo works.
- **FUNCTIONAL**: Store state cycles correctly, undo works, visual animation exists but not verified close-up.
- **BROKEN**: Toggle doesn't change state, animation broken, undo fails.

## Extension System

- **PRODUCTION**: Deck extensions deploy with railings, wood surface, correct overlap prevention. Visually distinct from interior.
- **FUNCTIONAL**: Extensions activate/deactivate, overlap check blocks adjacent, face materials apply.
- **BROKEN**: Extensions overlap neighboring containers, don't render, or break adjacency.
