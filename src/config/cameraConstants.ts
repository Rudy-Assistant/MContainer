/**
 * Camera safety constants — extracted from Scene.tsx so they can be tested.
 * Any change here will break regression tests by design.
 */

export const CAMERA_MIN_POLAR_ANGLE = 0.05;
// WHY: π/2 - 0.6 ≈ 56° prevents camera from seeing only ground plane.
// Previous value π/2 - 0.08 ≈ 85° allowed camera to orbit below container horizon.
// The ground plane is 200×200m — even at 73° it fills the viewport.
export const CAMERA_MAX_POLAR_ANGLE = Math.PI / 2 - 0.6;
export const CAMERA_MIN_DISTANCE = 3;
export const CAMERA_MAX_DISTANCE = 120;
/** Minimum camera Y position (floor guard clamps below this).
 * WHY 1.0: at 0.5 the camera is below container roof line, showing only ground. */
export const CAMERA_FLOOR_Y = 1.0;
/** camera-controls ACTION.TRUCK = 2 (right-click pans instead of rotates) */
export const CAMERA_MOUSE_RIGHT = 2;
