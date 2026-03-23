# GLB Model Conventions for ModuHome Forms

## File Naming
Place GLB files as: `/public/models/forms/{formId}.glb`
Example: `door_single_swing.glb`, `window_standard.glb`, `light_pendant.glb`

## Mesh Naming Convention
Name meshes in Blender to match skin slot IDs from the FormDefinition:
- `frame` — door/window frame geometry
- `panel` — door panel / opaque surface
- `glass` — transparent glass pane
- `handle` — door handle / hardware
- `track` — sliding door track
- `paper` — shoji paper screen
- `sill` — window sill
- `fixture` — light fixture body
- `shade` — lamp shade
- `cord` — pendant cord/chain
- `base` — lamp base
- `heads` — track light heads
- `trim` — recessed light trim
- `housing` — LED strip housing
- `plate` — electrical plate
- `wall` — half-window wall portion

The SceneObjectRenderer applies materials from the skin system
to each named mesh. Unnamed meshes keep their embedded material.

## Dimensions
Models should be authored at 1:1 meter scale.
The FormDefinition `dimensions` field defines the bounding box.
Models should fit within this box — the renderer does NOT rescale.

## Triangle Budget
- Doors: < 3000 triangles
- Windows: < 2000 triangles
- Lights: < 1500 triangles
- Electrical: < 500 triangles

## Orientation
- Models face -Z (north) by default
- The renderer rotates to match the anchor face direction
- Origin should be at the center of the form

## Activating a GLB Model
In the form definition (e.g., `src/config/forms/doors.ts`):
1. Change `geometry: 'procedural'` to `geometry: 'glb'`
2. Add `glbPath: '/models/forms/door_single_swing.glb'`

The renderer will automatically switch from procedural to GLB.
