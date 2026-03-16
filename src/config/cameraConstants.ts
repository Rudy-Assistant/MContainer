/**
 * Camera safety constants — extracted from Scene.tsx so they can be tested.
 * Any change here will break regression tests by design.
 */

export const CAMERA_MIN_POLAR_ANGLE = 0.05;
export const CAMERA_MAX_POLAR_ANGLE = Math.PI / 2 - 0.08;
export const CAMERA_MIN_DISTANCE = 3;
export const CAMERA_MAX_DISTANCE = 120;
/** Minimum camera Y position (floor guard clamps below this) */
export const CAMERA_FLOOR_Y = 0.5;
/** Minimum orbit target Y — prevents looking through the ground */
export const CAMERA_TARGET_MIN_Y = 0.3;
/** Maximum downward viewing angle in radians (~70°). Prevents ground-filling viewport after TRUCK. */
export const CAMERA_MAX_DOWNWARD_ANGLE = 70 * (Math.PI / 180);
/** camera-controls ACTION enum values for mouse button mapping.
 * Values MUST match camera-controls ACTION exactly:
 * NONE=0, ROTATE=1, TRUCK=2, DOLLY=16 */
export const CAMERA_MOUSE_BUTTONS = {
  left: 1,    // ACTION.ROTATE
  right: 2,   // ACTION.TRUCK
  middle: 2,  // ACTION.TRUCK
  wheel: 16,  // ACTION.DOLLY
} as const;
/** Maximum distance the orbit target can drift from origin XZ before clamping.
 * Prevents right-drag TRUCK from panning camera out of sight of the scene.
 * Must be generous enough for multi-container layouts but tight enough to
 * prevent losing the scene entirely. */
export const CAMERA_TARGET_MAX_RADIUS = 40;
