/**
 * windowTemplates.ts — Catalog of window templates.
 *
 * Mirrors `doorTemplates.ts` for fenestration. A "template" defines the
 * structural opening (fixed picture, casement, awning, double-hung, …) while
 * the visible material/finish is selected separately via `windowSkins.ts`.
 *
 * Templates are RESKINNABLE — same body (e.g. a double-hung) can be styled
 * with a black aluminium frame OR a natural-wood frame independently of the
 * underlying geometry.
 *
 * Pure data, no React, no Three.js.
 */

import type { SurfaceType } from "@/types/container";

export type WindowTemplateId =
  | 'fixed_picture'        // single large fixed pane, no opening
  | 'fixed_clerestory'     // narrow horizontal strip near ceiling
  | 'casement_single'      // hinged on one side, swings outward like a door
  | 'casement_double'      // pair of casements meeting in the middle
  | 'awning_top_hinge'     // top-hinged, opens outward like an awning
  | 'hopper_bottom_hinge'  // bottom-hinged, opens inward
  | 'sliding_horizontal'   // panel slides sideways
  | 'double_hung'          // two stacked sashes, slide vertically past each other
  | 'tilt_turn'            // tilts inward at the top OR swings inward — European spec
  | 'bay_three_panel'      // protruding box of three panels (centre fixed, sides angled)
  | 'corner_wraparound'    // L-shaped at a container corner — frameless joint
  | 'jalousie';            // horizontal louvres that crank open

export type WindowMotion = 'fixed' | 'casement' | 'awning' | 'hopper' | 'slide' | 'tilt_turn' | 'louvre';

export interface WindowTemplate {
  id: WindowTemplateId;
  label: string;
  hint: string;
  motion: WindowMotion;
  /** Vertical-coverage hint — informs which existing Window_* surface to pick
   *  if/when the renderer hasn't grown a per-template geometry yet. */
  coverage: 'full' | 'sill' | 'half' | 'clerestory' | 'corner';
  /** Default Window_* surface fallback for the existing renderer. */
  surface: SurfaceType;
  recommendedSkins: string[];
}

export const WINDOW_TEMPLATES: WindowTemplate[] = [
  {
    id: 'fixed_picture',
    label: 'Picture Window',
    hint: 'Single large fixed pane. Doesn’t open — pure view.',
    motion: 'fixed',
    coverage: 'full',
    surface: 'Window_Standard',
    recommendedSkins: ['aluminum_black', 'aluminum_white', 'wood_natural'],
  },
  {
    id: 'fixed_clerestory',
    label: 'Clerestory Strip',
    hint: 'Narrow band of glass high on the wall — privacy + daylight.',
    motion: 'fixed',
    coverage: 'clerestory',
    surface: 'Window_Clerestory',
    recommendedSkins: ['aluminum_black', 'steel_industrial'],
  },
  {
    id: 'casement_single',
    label: 'Casement (Single)',
    hint: 'Hinged on one side — swings outward like a door for full ventilation.',
    motion: 'casement',
    coverage: 'full',
    surface: 'Window_Standard',
    recommendedSkins: ['wood_natural', 'aluminum_black', 'painted_white_window'],
  },
  {
    id: 'casement_double',
    label: 'Casement (Double)',
    hint: 'Two casements meeting in the middle — wide ventilation, no centre post.',
    motion: 'casement',
    coverage: 'full',
    surface: 'Window_Standard',
    recommendedSkins: ['wood_natural', 'aluminum_black', 'painted_white_window'],
  },
  {
    id: 'awning_top_hinge',
    label: 'Awning Window',
    hint: 'Top-hinged, opens outward at the bottom — rain-shedding ventilation.',
    motion: 'awning',
    coverage: 'half',
    surface: 'Window_Half',
    recommendedSkins: ['aluminum_black', 'painted_white_window', 'wood_natural'],
  },
  {
    id: 'hopper_bottom_hinge',
    label: 'Hopper Window',
    hint: 'Bottom-hinged, opens inward — basements, bathrooms, mechanical rooms.',
    motion: 'hopper',
    coverage: 'half',
    surface: 'Window_Half',
    recommendedSkins: ['steel_industrial', 'aluminum_black'],
  },
  {
    id: 'sliding_horizontal',
    label: 'Sliding (Horizontal)',
    hint: 'One panel slides past the other sideways — no swing arc needed.',
    motion: 'slide',
    coverage: 'sill',
    surface: 'Window_Sill',
    recommendedSkins: ['aluminum_white', 'aluminum_black', 'wood_natural'],
  },
  {
    id: 'double_hung',
    label: 'Double Hung',
    hint: 'Classic two-sash design — both sashes slide vertically past each other.',
    motion: 'slide',
    coverage: 'full',
    surface: 'Window_Standard',
    recommendedSkins: ['painted_white_window', 'wood_natural', 'painted_black_window'],
  },
  {
    id: 'tilt_turn',
    label: 'Tilt-Turn',
    hint: 'European spec — tilts inward at the top OR swings inward as a door.',
    motion: 'tilt_turn',
    coverage: 'full',
    surface: 'Window_Standard',
    recommendedSkins: ['aluminum_black', 'aluminum_white', 'wood_natural'],
  },
  {
    id: 'bay_three_panel',
    label: 'Bay Window',
    hint: 'Three angled panels project out from the wall — interior nook.',
    motion: 'fixed',
    coverage: 'full',
    surface: 'Window_Standard',
    recommendedSkins: ['wood_natural', 'painted_white_window', 'painted_black_window'],
  },
  {
    id: 'corner_wraparound',
    label: 'Corner Wraparound',
    hint: 'Frameless glass joint at the container corner — maximises view.',
    motion: 'fixed',
    coverage: 'corner',
    surface: 'Window_Standard',
    recommendedSkins: ['aluminum_black', 'aluminum_white'],
  },
  {
    id: 'jalousie',
    label: 'Jalousie Louvres',
    hint: 'Horizontal slats crank open in unison — tropical / pavilion ventilation.',
    motion: 'louvre',
    coverage: 'half',
    surface: 'Window_Half',
    recommendedSkins: ['aluminum_white', 'aluminum_black'],
  },
];

export const DEFAULT_WINDOW_TEMPLATE: WindowTemplateId = 'fixed_picture';

export function getWindowTemplate(id: WindowTemplateId): WindowTemplate {
  const t = WINDOW_TEMPLATES.find((w) => w.id === id);
  if (!t) return WINDOW_TEMPLATES[0];
  return t;
}
