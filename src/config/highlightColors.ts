/**
 * Canonical highlight colors used across 3D meshes and 2D UI.
 * Single source of truth — replace raw hex literals with these imports.
 */

// CSS / SVG string form
export const HIGHLIGHT_COLOR_SELECT = '#00bcd4';
export const HIGHLIGHT_COLOR_HOVER = '#ffcc00';

// THREE.js numeric form (same values, no parseInt overhead)
export const HIGHLIGHT_HEX_SELECT = 0x00bcd4;
export const HIGHLIGHT_HEX_HOVER = 0xffcc00;
