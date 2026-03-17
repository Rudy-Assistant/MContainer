/**
 * Camera safety constants — extracted from Scene.tsx so they can be tested.
 * Any change here will break regression tests by design.
 *
 * POLAR ANGLE CONVENTION (camera-controls):
 *   0 rad     = looking straight DOWN (bird's eye)
 *   π/2 rad   = looking at the HORIZON (horizontal)
 *   π rad     = looking straight UP
 *
 * SKY VISIBILITY MATH:
 *   With FOV=48°, the top of the viewport is 24° above the look direction.
 *   To keep sky below ~20% of viewport height, the look direction must point
 *   at least ~19° below the horizon → maxPolarAngle ≈ π/2 - 0.34 ≈ 71°.
 *   Current setting: 65° from vertical (25° below horizon) → sky is ~0% of viewport.
 */

/** Minimum polar angle — prevents pure top-down view (camera directly above target) */
export const CAMERA_MIN_POLAR_ANGLE = 0.2;  // ~11.5° from vertical

/** Maximum polar angle — prevents looking above the horizon.
 * π/2 - 0.44 ≈ 65° from vertical ≈ 25° below horizon.
 * With 48° FOV, the top of the viewport is at 25° - 24° = 1° below horizon.
 * Sky mesh may be barely visible at the very top edge — this is natural.
 * Previous value (π/2 - 0.08 ≈ 85.4°) allowed near-horizontal views where
 * 40%+ of the viewport was sky, causing user-reported "blue screen." */
export const CAMERA_MAX_POLAR_ANGLE = Math.PI / 2 - 0.44;

export const CAMERA_MIN_DISTANCE = 3;

/** Maximum orbit distance. Reduced from 120 to 60 — at large distances,
 * the container is a tiny speck and the viewport is mostly sky/ground.
 * 60m is generous for any multi-container layout. */
export const CAMERA_MAX_DISTANCE = 60;

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

/** Maximum orbit target Y — prevents TRUCK from pushing target above scene.
 * A 40ft HC container is ~2.9m tall; 3 stacked levels ≈ 8.7m. Value of 6 covers
 * 2 stacked levels while limiting sky exposure during TRUCK. */
export const CAMERA_TARGET_MAX_Y = 6;

/** Maximum camera Y — prevents TRUCK from pushing camera above scene.
 * Must be > CAMERA_TARGET_MAX_Y so the camera can still look down at the build.
 * 10m is generous enough for bird's-eye views of 2-level stacks. */
export const CAMERA_MAX_Y = 10;

/** Maximum upward viewing angle in radians (~15°). Prevents sky-filling viewport
 * when TRUCK pushes both camera and target upward.
 * RATIONALE: without this, right-drag TRUCK upward raises both camera+target together,
 * and the individual Y clamps alone can't prevent a viewport that's mostly sky.
 * Reduced from 30° to 15° — with FOV=48°, 15° upward means the top of the viewport
 * is 15° + 24° = 39° above horizontal, which still shows plenty of sky.
 * 15° is enough for natural-feeling views without sky domination. */
export const CAMERA_MAX_UPWARD_ANGLE = 15 * (Math.PI / 180);

/** Maximum distance the orbit target can drift from origin XZ before clamping.
 * Prevents right-drag TRUCK from panning camera out of sight of the scene.
 * Reduced from 40 to 25 — keeps the build visible at all times. */
export const CAMERA_TARGET_MAX_RADIUS = 25;
