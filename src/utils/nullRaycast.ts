/**
 * Shared no-op raycast function — disables raycasting on a mesh.
 * Use on visual-only meshes (decorations, highlights, overlays) that
 * should not intercept pointer events or BVH raycasts.
 *
 * Usage: <mesh raycast={nullRaycast} ... />
 */
export const nullRaycast = () => {};
