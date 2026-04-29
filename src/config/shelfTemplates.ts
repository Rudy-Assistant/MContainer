/**
 * shelfTemplates.ts — Catalog of shelf templates.
 *
 * A "template" defines an open-shelf geometry archetype. Skins (cabinetrySkins)
 * are decoupled — same shape can be reskinned without touching geometry.
 *
 * Pure data, no React, no Three.js. Renderer maps template + skin → mesh.
 */

import type { CabinetryAnchor } from '@/types/container';
import type { CabinetrySkinId } from '@/config/cabinetrySkins';

export type ShelfTemplateId =
  | 'floating_single'
  | 'bracket_single'
  | 'wall_unit_3'
  | 'wall_unit_5'
  | 'cube_grid_2x2'
  | 'cube_grid_3x2'
  | 'ladder'
  | 'corner_l';

export interface ShelfTemplate {
  id: ShelfTemplateId;
  label: string;
  /** One-line copy for the picker. */
  hint: string;
  /** Number of horizontal shelf surfaces (planks). */
  shelves: number;
  /** Whether the template draws visible side / end panels around the shelves. */
  hasSidePanels: boolean;
  /** Whether the template draws visible support brackets. */
  hasBrackets: boolean;
  /** Default vertical anchor on the wall face (top / mid / bottom). */
  defaultAnchor: CabinetryAnchor;
  /** Recommended skin IDs that pair well visually. First entry is the default. */
  recommendedSkins: CabinetrySkinId[];
  /** Estimated installed cost in USD (cabinetry-grade materials). */
  costUSD: number;
}

export const SHELF_TEMPLATES: ShelfTemplate[] = [
  {
    id: 'floating_single',
    label: 'Floating Shelf',
    hint: 'Single horizontal plank with hidden mounts — clean modern look.',
    shelves: 1,
    hasSidePanels: false,
    hasBrackets: false,
    defaultAnchor: 'mid',
    recommendedSkins: ['oak_natural', 'walnut_dark', 'shaker_white'],
      costUSD: 80,
  },
  {
    id: 'bracket_single',
    label: 'Bracket Shelf',
    hint: 'Single plank on visible L-brackets — utilitarian.',
    shelves: 1,
    hasSidePanels: false,
    hasBrackets: true,
    defaultAnchor: 'mid',
    recommendedSkins: ['oak_natural', 'oak_stained', 'steel_industrial'],
      costUSD: 60,
  },
  {
    id: 'wall_unit_3',
    label: '3-Tier Wall Unit',
    hint: 'Three stacked planks with side panels — open bookshelf.',
    shelves: 3,
    hasSidePanels: true,
    hasBrackets: false,
    defaultAnchor: 'mid',
    recommendedSkins: ['oak_natural', 'walnut_dark', 'shaker_white'],
      costUSD: 220,
  },
  {
    id: 'wall_unit_5',
    label: '5-Tier Wall Unit',
    hint: 'Five stacked planks — full-height storage.',
    shelves: 5,
    hasSidePanels: true,
    hasBrackets: false,
    defaultAnchor: 'mid',
    recommendedSkins: ['oak_stained', 'walnut_dark', 'shaker_navy'],
      costUSD: 350,
  },
  {
    id: 'cube_grid_2x2',
    label: '4-Cube Grid',
    hint: '2×2 grid of open cubes — modular storage.',
    shelves: 2,
    hasSidePanels: true,
    hasBrackets: false,
    defaultAnchor: 'mid',
    recommendedSkins: ['shaker_white', 'oak_natural', 'walnut_dark'],
      costUSD: 240,
  },
  {
    id: 'cube_grid_3x2',
    label: '6-Cube Grid',
    hint: '3×2 grid of open cubes — wide modular unit.',
    shelves: 2,
    hasSidePanels: true,
    hasBrackets: false,
    defaultAnchor: 'mid',
    recommendedSkins: ['shaker_white', 'oak_natural', 'painted_black_modern'],
      costUSD: 360,
  },
  {
    id: 'ladder',
    label: 'Ladder Shelf',
    hint: 'A-frame leaning against the wall with stepped planks — casual.',
    shelves: 4,
    hasSidePanels: true,
    hasBrackets: false,
    defaultAnchor: 'mid',
    recommendedSkins: ['oak_natural', 'walnut_dark', 'hinoki_natural'],
      costUSD: 180,
  },
  {
    id: 'corner_l',
    label: 'Corner L-Shelf',
    hint: 'L-shaped 3-tier wrapping a corner — uses dead space.',
    shelves: 3,
    hasSidePanels: true,
    hasBrackets: false,
    defaultAnchor: 'mid',
    recommendedSkins: ['oak_natural', 'shaker_white', 'walnut_dark'],
      costUSD: 280,
  },
];

export const DEFAULT_SHELF_TEMPLATE: ShelfTemplateId = 'wall_unit_3';

import { byId } from './_byId';
export function getShelfTemplate(id: ShelfTemplateId): ShelfTemplate {
  return byId(SHELF_TEMPLATES, id);
}
