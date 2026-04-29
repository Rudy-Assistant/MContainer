/**
 * decorTemplates.ts — Wall-mounted decor catalog: pictures, mirrors, TVs,
 * tapestries, wall clocks. Static (no animation), single-mesh-thickness
 * overlay that hangs flat on the wall.
 */

import type { CabinetryAnchor } from '@/types/container';

export type DecorTemplateId =
  | 'framed_picture_landscape'
  | 'framed_picture_portrait'
  | 'gallery_3'         // gallery wall — 3 small frames
  | 'gallery_grid'      // 2×2 framed cluster
  | 'mirror_round'
  | 'mirror_rectangular'
  | 'wall_clock_round'
  | 'tv_55'
  | 'tv_75'
  | 'tapestry'
  | 'floating_canvas'   // unframed canvas
  | 'curtain_drape'     // floor-to-ceiling fabric drape (window treatment)
  | 'blinds_horizontal' // venetian-style horizontal slats
  | 'blinds_vertical'   // vertical blinds
  | 'roman_shade';      // pleated fabric shade

export type DecorPaletteId =
  | 'frame_black'
  | 'frame_white'
  | 'frame_oak'
  | 'frame_walnut'
  | 'frame_brass'
  | 'frame_thin_chrome'
  | 'no_frame';

export interface DecorTemplate {
  id: DecorTemplateId;
  label: string;
  hint: string;
  /** Body coverage on the wall face (normalized fraction). */
  bodyWidth: number;
  bodyHeight: number;
  defaultAnchor: CabinetryAnchor;
  /** Whether this template includes a glass cover (mirror, framed picture). */
  hasGlass?: boolean;
  /** Whether the template is a TV — body is dark + slightly glossy. */
  isTV?: boolean;
  /** Recommended frame palettes for this template. */
  recommendedPalettes: DecorPaletteId[];
  /** Estimated installed cost in USD. */
  costUSD: number;
}

export interface DecorPalette {
  id: DecorPaletteId;
  label: string;
  frameColor: string;
  frameMetal?: boolean;
  /** "Image" colour shown inside the frame for the picker swatch. */
  imageColor: string;
}

export const DECOR_PALETTES: DecorPalette[] = [
  { id: 'frame_black',       label: 'Black Frame',  frameColor: '#0c0c0c', imageColor: '#7c7c8a' },
  { id: 'frame_white',       label: 'White Frame',  frameColor: '#fafaf9', imageColor: '#aebccc' },
  { id: 'frame_oak',         label: 'Oak Frame',    frameColor: '#a07043', imageColor: '#aebccc' },
  { id: 'frame_walnut',      label: 'Walnut Frame', frameColor: '#3a2620', imageColor: '#aebccc' },
  { id: 'frame_brass',       label: 'Brass Frame',  frameColor: '#cba135', frameMetal: true, imageColor: '#aebccc' },
  { id: 'frame_thin_chrome', label: 'Chrome',       frameColor: '#c0c4c8', frameMetal: true, imageColor: '#aebccc' },
  { id: 'no_frame',          label: 'No Frame',     frameColor: '#3a3a3a', imageColor: '#aebccc' },
];

export const DECOR_TEMPLATES: DecorTemplate[] = [
  {
    id: 'framed_picture_landscape',
    label: 'Framed Picture',
    hint: 'Single landscape-orientation framed print.',
    bodyWidth: 0.4,
    bodyHeight: 0.28,
    defaultAnchor: 'mid',
    hasGlass: true,
    recommendedPalettes: ['frame_black', 'frame_white', 'frame_walnut'],
      costUSD: 120,
  },
  {
    id: 'framed_picture_portrait',
    label: 'Portrait Frame',
    hint: 'Single portrait-orientation framed print.',
    bodyWidth: 0.28,
    bodyHeight: 0.4,
    defaultAnchor: 'mid',
    hasGlass: true,
    recommendedPalettes: ['frame_black', 'frame_white', 'frame_oak'],
      costUSD: 120,
  },
  {
    id: 'gallery_3',
    label: 'Gallery (3)',
    hint: 'Three frames in a row.',
    bodyWidth: 0.7,
    bodyHeight: 0.25,
    defaultAnchor: 'mid',
    hasGlass: true,
    recommendedPalettes: ['frame_black', 'frame_white', 'frame_walnut'],
      costUSD: 240,
  },
  {
    id: 'gallery_grid',
    label: 'Gallery Grid',
    hint: '2×2 cluster of small frames.',
    bodyWidth: 0.45,
    bodyHeight: 0.45,
    defaultAnchor: 'mid',
    hasGlass: true,
    recommendedPalettes: ['frame_black', 'frame_white', 'frame_brass'],
      costUSD: 320,
  },
  {
    id: 'mirror_round',
    label: 'Round Mirror',
    hint: 'Circular wall mirror.',
    bodyWidth: 0.32,
    bodyHeight: 0.32,
    defaultAnchor: 'mid',
    hasGlass: true,
    recommendedPalettes: ['frame_brass', 'frame_thin_chrome', 'frame_black'],
      costUSD: 180,
  },
  {
    id: 'mirror_rectangular',
    label: 'Rectangular Mirror',
    hint: 'Tall rectangular wall mirror.',
    bodyWidth: 0.3,
    bodyHeight: 0.55,
    defaultAnchor: 'mid',
    hasGlass: true,
    recommendedPalettes: ['frame_thin_chrome', 'frame_black', 'frame_walnut'],
      costUSD: 220,
  },
  {
    id: 'wall_clock_round',
    label: 'Wall Clock',
    hint: 'Round wall clock.',
    bodyWidth: 0.18,
    bodyHeight: 0.18,
    defaultAnchor: 'top',
    recommendedPalettes: ['frame_black', 'frame_white', 'frame_brass'],
      costUSD: 60,
  },
  {
    id: 'tv_55',
    label: 'TV 55"',
    hint: 'Wall-mounted 55-inch TV.',
    bodyWidth: 0.55,
    bodyHeight: 0.32,
    defaultAnchor: 'mid',
    isTV: true,
    recommendedPalettes: ['no_frame', 'frame_black'],
      costUSD: 580,
  },
  {
    id: 'tv_75',
    label: 'TV 75"',
    hint: 'Wall-mounted 75-inch TV.',
    bodyWidth: 0.75,
    bodyHeight: 0.42,
    defaultAnchor: 'mid',
    isTV: true,
    recommendedPalettes: ['no_frame', 'frame_black'],
      costUSD: 1200,
  },
  {
    id: 'tapestry',
    label: 'Tapestry',
    hint: 'Soft wall hanging — frameless.',
    bodyWidth: 0.6,
    bodyHeight: 0.85,
    defaultAnchor: 'mid',
    recommendedPalettes: ['no_frame'],
      costUSD: 80,
  },
  {
    id: 'floating_canvas',
    label: 'Canvas',
    hint: 'Unframed canvas print — gallery-wrap.',
    bodyWidth: 0.4,
    bodyHeight: 0.3,
    defaultAnchor: 'mid',
    recommendedPalettes: ['no_frame'],
      costUSD: 140,
  },
  // ── Window treatments ──
  {
    id: 'curtain_drape',
    label: 'Curtain Drape',
    hint: 'Floor-to-ceiling fabric drape — soft elegance.',
    bodyWidth: 0.95,
    bodyHeight: 0.95,
    defaultAnchor: 'mid',
    recommendedPalettes: ['no_frame', 'frame_white'],
    costUSD: 320,
  },
  {
    id: 'blinds_horizontal',
    label: 'Horizontal Blinds',
    hint: 'Venetian-style horizontal slats — privacy + light control.',
    bodyWidth: 0.85,
    bodyHeight: 0.85,
    defaultAnchor: 'mid',
    recommendedPalettes: ['frame_white', 'frame_black', 'frame_oak'],
    costUSD: 180,
  },
  {
    id: 'blinds_vertical',
    label: 'Vertical Blinds',
    hint: 'Vertical slats — sliding-door / wide-window standby.',
    bodyWidth: 0.95,
    bodyHeight: 0.95,
    defaultAnchor: 'mid',
    recommendedPalettes: ['frame_white', 'no_frame'],
    costUSD: 220,
  },
  {
    id: 'roman_shade',
    label: 'Roman Shade',
    hint: 'Pleated fabric shade — pulls up in folds.',
    bodyWidth: 0.85,
    bodyHeight: 0.85,
    defaultAnchor: 'top',
    recommendedPalettes: ['frame_white', 'no_frame', 'frame_walnut'],
    costUSD: 240,
  },
];

export const DEFAULT_DECOR_TEMPLATE: DecorTemplateId = 'framed_picture_landscape';
export const DEFAULT_DECOR_PALETTE: DecorPaletteId = 'frame_black';

import { byId } from './_byId';
export function getDecorTemplate(id: DecorTemplateId): DecorTemplate {
  return byId(DECOR_TEMPLATES, id);
}

export function getDecorPalette(id: DecorPaletteId): DecorPalette {
  return byId(DECOR_PALETTES, id);
}
