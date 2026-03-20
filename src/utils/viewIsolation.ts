/** Element types for opacity calculation */
export type ViewElementType = 'floor-face' | 'ceiling-face' | 'frame';

/** Tunable opacity constants */
const OPACITY = {
  FULL: 1.0,
  ACTIVE_WITH_FRAME: 0.4,
  INACTIVE_FACE: 0.15,
  INACTIVE_WITH_FRAME: 0.1,
  FRAME_BACKGROUND: 0.3,
} as const;

/**
 * Compute opacity for a given element type based on current view toggles.
 *
 * @param elementType - The type of element ('floor-face', 'ceiling-face', or 'frame')
 * @param inspectorView - Current view mode ('floor' or 'ceiling')
 * @param frameMode - Whether frame-viewing mode is enabled
 * @returns Opacity value from 0.0 to 1.0
 *
 * Behavior:
 * - When frameMode is ON: frame is full opacity (1.0), active view (floor/ceiling) reduced (0.4),
 *   inactive view faded (0.1)
 * - When frameMode is OFF: active view full (1.0), inactive view faded (0.15), frame background (0.3)
 */
export function getViewOpacity(
  elementType: ViewElementType,
  inspectorView: 'floor' | 'ceiling',
  frameMode: boolean,
): number {
  if (elementType === 'frame') {
    return frameMode ? OPACITY.FULL : OPACITY.FRAME_BACKGROUND;
  }

  const isActive = (elementType === 'floor-face' && inspectorView === 'floor')
    || (elementType === 'ceiling-face' && inspectorView === 'ceiling');

  if (frameMode) {
    return isActive ? OPACITY.ACTIVE_WITH_FRAME : OPACITY.INACTIVE_WITH_FRAME;
  }
  return isActive ? OPACITY.FULL : OPACITY.INACTIVE_FACE;
}
