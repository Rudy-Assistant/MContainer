/**
 * doorTemplates.ts — Catalog of door templates.
 *
 * A "template" is a structural opening type — single swing, double swing,
 * sliding patio, bifold, etc. Each template defines:
 *   - Geometry archetype (how the panel(s) are shaped + which axis they move on)
 *   - Default opening behaviour (state/animation hints — actual 3D animation
 *     is a separate concern; this just declares intent)
 *   - Compatibility tags (which faces/widths it makes sense on)
 *
 * Templates are RESKINNABLE — the visual finish (frame colour, panel material,
 * glass tint, hardware) lives in `doorSkins.ts` and is selected independently.
 *
 * Pure data, no React, no Three.js. Renderer maps template + skin → mesh.
 */

import type { SurfaceType } from "@/types/container";

/** Stable IDs — mirrored in DoorConfig.template. Add to the union when a new
 *  template lands. */
export type DoorTemplateId =
  | 'single_swing'    // standard hinged door
  | 'double_swing'    // pair of doors hinged on opposite sides
  | 'french_double'   // double doors with full glass panes
  | 'sliding_single'  // one panel slides past a fixed half
  | 'sliding_double'  // two panels slide past each other
  | 'pocket'          // single panel slides into the wall cavity
  | 'barn'            // single panel slides on an exterior track
  | 'bifold'          // two panels fold accordion-style
  | 'dutch'           // horizontally split — top and bottom open independently
  | 'pivot'           // single oversized panel pivots on a vertical centre axis
  | 'shoji_slide'     // light frame + translucent panel, slides
  | 'garage_roll';    // rolling overhead door (for utility rooms / decks)

export type DoorMotion = 'swing' | 'slide' | 'fold' | 'pivot' | 'roll';

export interface DoorTemplate {
  id: DoorTemplateId;
  label: string;
  /** One-line copy for the picker — what the door does, in plain language. */
  hint: string;
  /** How the panel(s) move open. Drives animation pipeline. */
  motion: DoorMotion;
  /** Number of independent panels (1 single, 2 double, etc). */
  panels: 1 | 2;
  /** Whether the template defaults to a glassy panel (selecting a glass skin
   *  will look natural). Pickers can highlight glass-friendly templates when
   *  a glass skin is selected. */
  defaultsToGlass: boolean;
  /** Surface category — used by the existing wall picker to know what voxel
   *  face material to write when this template is chosen. */
  surface: SurfaceType;
  /** Recommended skin IDs that pair well visually. First entry is the default
   *  applied if the user picks the template without a skin. */
  recommendedSkins: string[];
}

export const DOOR_TEMPLATES: DoorTemplate[] = [
  {
    id: 'single_swing',
    label: 'Single Swing',
    hint: 'Standard hinged door — opens 90° in or out.',
    motion: 'swing',
    panels: 1,
    defaultsToGlass: false,
    surface: 'Door',
    recommendedSkins: ['oak_solid', 'painted_white', 'steel_industrial'],
  },
  {
    id: 'double_swing',
    label: 'Double Swing',
    hint: 'Pair of doors meeting in the middle — wide entry.',
    motion: 'swing',
    panels: 2,
    defaultsToGlass: false,
    surface: 'Door',
    recommendedSkins: ['oak_solid', 'painted_black', 'walnut_dark'],
  },
  {
    id: 'french_double',
    label: 'French Doors',
    hint: 'Double doors with full glass panes — ideal for patio walkouts.',
    motion: 'swing',
    panels: 2,
    defaultsToGlass: true,
    surface: 'Door',
    recommendedSkins: ['painted_white_glazed', 'walnut_glazed', 'aluminum_black_glazed'],
  },
  {
    id: 'sliding_single',
    label: 'Sliding Patio',
    hint: 'Single glass panel slides sideways — fits a wide opening with no swing arc.',
    motion: 'slide',
    panels: 1,
    defaultsToGlass: true,
    surface: 'Door',
    recommendedSkins: ['aluminum_black_glazed', 'aluminum_white_glazed', 'steel_industrial'],
  },
  {
    id: 'sliding_double',
    label: 'Sliding Double',
    hint: 'Two glass panels slide past each other — premium patio entry.',
    motion: 'slide',
    panels: 2,
    defaultsToGlass: true,
    surface: 'Door',
    recommendedSkins: ['aluminum_black_glazed', 'aluminum_white_glazed', 'walnut_glazed'],
  },
  {
    id: 'pocket',
    label: 'Pocket Door',
    hint: 'Slides flush into the wall — great for tight rooms or en-suite closets.',
    motion: 'slide',
    panels: 1,
    defaultsToGlass: false,
    surface: 'Door',
    recommendedSkins: ['oak_solid', 'painted_white', 'walnut_dark'],
  },
  {
    id: 'barn',
    label: 'Barn Slide',
    hint: 'Slides on an exposed exterior track — rustic showpiece.',
    motion: 'slide',
    panels: 1,
    defaultsToGlass: false,
    surface: 'Door',
    recommendedSkins: ['oak_reclaimed', 'walnut_dark', 'steel_industrial'],
  },
  {
    id: 'bifold',
    label: 'Bifold',
    hint: 'Two panels fold accordion-style against the jamb — closets and laundry.',
    motion: 'fold',
    panels: 2,
    defaultsToGlass: false,
    surface: 'Door',
    recommendedSkins: ['painted_white', 'oak_solid', 'walnut_dark'],
  },
  {
    id: 'dutch',
    label: 'Dutch Door',
    hint: 'Top and bottom halves open independently — kitchen back doors and stables.',
    motion: 'swing',
    panels: 2,
    defaultsToGlass: false,
    surface: 'Door',
    recommendedSkins: ['painted_white', 'painted_black', 'oak_solid'],
  },
  {
    id: 'pivot',
    label: 'Pivot Door',
    hint: 'Oversized panel rotates on a vertical centre axis — modernist statement.',
    motion: 'pivot',
    panels: 1,
    defaultsToGlass: true,
    surface: 'Door',
    recommendedSkins: ['walnut_glazed', 'aluminum_black_glazed', 'steel_industrial'],
  },
  {
    id: 'shoji_slide',
    label: 'Shoji Slide',
    hint: 'Translucent rice-paper panels in a light wooden frame — Japanese modern.',
    motion: 'slide',
    panels: 2,
    defaultsToGlass: true,
    surface: 'Glass_Shoji',
    recommendedSkins: ['hinoki_natural', 'walnut_dark'],
  },
  {
    id: 'garage_roll',
    label: 'Garage Roll-Up',
    hint: 'Sectional rolling door for utility rooms or oversize patio openings.',
    motion: 'roll',
    panels: 1,
    defaultsToGlass: false,
    surface: 'Door',
    recommendedSkins: ['steel_industrial', 'aluminum_white_glazed', 'painted_black'],
  },
];

export const DEFAULT_DOOR_TEMPLATE: DoorTemplateId = 'single_swing';

export function getDoorTemplate(id: DoorTemplateId): DoorTemplate {
  const t = DOOR_TEMPLATES.find((d) => d.id === id);
  if (!t) {
    // Defensive: unknown id should not crash; fall back to single swing.
    return DOOR_TEMPLATES[0];
  }
  return t;
}
