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
/** camera-controls ACTION.TRUCK = 2 (right-click pans instead of rotates) */
export const CAMERA_MOUSE_RIGHT = 2;
