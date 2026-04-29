/**
 * Canonical highlight colors used across 3D meshes and 2D UI.
 * Single source of truth — replace raw hex literals with these imports.
 */

// CSS / SVG string form
export const HIGHLIGHT_COLOR_SELECT = '#00bcd4';
export const HIGHLIGHT_COLOR_HOVER = '#ffcc00';
/** Light blue used when the FaceFilterWidget restricts hover/click to a
 *  specific face category — visually distinct from the default amber so
 *  the user knows the filter is active. */
export const HIGHLIGHT_COLOR_HOVER_FILTERED = '#60a5fa';

// THREE.js numeric form (same values, no parseInt overhead)
export const HIGHLIGHT_HEX_SELECT = 0x00bcd4;
export const HIGHLIGHT_HEX_HOVER = 0xffcc00;
export const HIGHLIGHT_HEX_HOVER_FILTERED = 0x60a5fa;
