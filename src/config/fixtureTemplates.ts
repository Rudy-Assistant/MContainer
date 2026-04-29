/**
 * fixtureTemplates.ts — Catalog of kitchen + bathroom fixtures.
 *
 * Fixtures are wall-anchored or floor-anchored objects that occupy a voxel
 * face: refrigerator, range, dishwasher, sink, toilet, shower, washer/dryer.
 * Like shelves and cabinets, they're an OVERLAY (voxel.fixtureConfig?.[face])
 * rather than a SurfaceType replacement — the wall stays intact behind.
 *
 * Templates declare a body box + a small set of feature meshes (door, knobs,
 * faucet, basin). V1 keeps motion minimal: fridge/oven doors swing on
 * openAmount; everything else is static.
 *
 * Pure data, no React, no Three.js.
 */

import type { CabinetryAnchor } from '@/types/container';

export type FixtureTemplateId =
  | 'fridge_freezer_top'      // standard fridge with freezer compartment up top
  | 'fridge_french_door'      // french-door fridge (two narrow doors + freezer drawer)
  | 'range_4burner'           // freestanding range/stove with 4 burners + oven door
  | 'range_6burner'           // pro-style 6-burner range
  | 'wall_oven'               // built-in wall oven (single)
  | 'dishwasher'              // panel-front dishwasher
  | 'microwave_otr'           // over-the-range microwave (mounts to wall_2door cabinet)
  | 'sink_kitchen_double'     // kitchen sink — double basin + faucet
  | 'sink_kitchen_single'     // kitchen sink — single basin
  | 'sink_pedestal'           // bathroom pedestal sink
  | 'sink_vessel'             // bowl-on-counter bathroom sink
  | 'toilet_standard'         // standard toilet
  | 'toilet_wall_hung'        // wall-hung modern toilet
  | 'shower_stall'            // glass shower stall
  | 'bathtub_alcove'          // alcove bathtub
  | 'washer'                  // front-load washing machine
  | 'dryer';                  // front-load dryer

export type FixtureKind = 'appliance' | 'fixture';

export interface FixtureTemplate {
  id: FixtureTemplateId;
  label: string;
  hint: string;
  kind: FixtureKind;
  /** Body coverage on the wall face. */
  bodyWidth: number;
  bodyHeight: number;
  /** Default vertical anchor. Most appliances are floor-anchored. */
  defaultAnchor: CabinetryAnchor;
  /** Whether the front door/lid animates with openAmount. */
  hasOpeningDoor?: boolean;
  /** Hint for the renderer to choose materials/colors. */
  paletteHint: 'stainless' | 'porcelain' | 'enamel' | 'glass' | 'panel_match';
  /** Estimated installed cost in USD. */
  costUSD: number;
}

export const FIXTURE_TEMPLATES: FixtureTemplate[] = [
  {
    id: 'fridge_freezer_top',
    label: 'Refrigerator',
    hint: 'Top-freezer fridge — 28" wide × ~67" tall.',
    kind: 'appliance',
    bodyWidth: 0.45,
    bodyHeight: 0.92,
    defaultAnchor: 'mid',
    hasOpeningDoor: true,
    paletteHint: 'stainless',
      costUSD: 1100,
  },
  {
    id: 'fridge_french_door',
    label: 'French-Door Fridge',
    hint: 'Two top doors + freezer drawer below — premium kitchen.',
    kind: 'appliance',
    bodyWidth: 0.55,
    bodyHeight: 0.92,
    defaultAnchor: 'mid',
    hasOpeningDoor: true,
    paletteHint: 'stainless',
      costUSD: 2400,
  },
  {
    id: 'range_4burner',
    label: 'Range / Stove',
    hint: 'Freestanding 30" range with oven below.',
    kind: 'appliance',
    bodyWidth: 0.45,
    bodyHeight: 0.5,
    defaultAnchor: 'bottom',
    hasOpeningDoor: true,
    paletteHint: 'stainless',
      costUSD: 950,
  },
  {
    id: 'range_6burner',
    label: 'Pro Range',
    hint: 'Pro-style 6-burner range — wider footprint.',
    kind: 'appliance',
    bodyWidth: 0.7,
    bodyHeight: 0.5,
    defaultAnchor: 'bottom',
    hasOpeningDoor: true,
    paletteHint: 'stainless',
      costUSD: 4500,
  },
  {
    id: 'wall_oven',
    label: 'Wall Oven',
    hint: 'Built-in single wall oven — kitchen island compatible.',
    kind: 'appliance',
    bodyWidth: 0.4,
    bodyHeight: 0.35,
    defaultAnchor: 'mid',
    hasOpeningDoor: true,
    paletteHint: 'stainless',
      costUSD: 2200,
  },
  {
    id: 'dishwasher',
    label: 'Dishwasher',
    hint: 'Front-load 24" dishwasher.',
    kind: 'appliance',
    bodyWidth: 0.4,
    bodyHeight: 0.34,
    defaultAnchor: 'bottom',
    hasOpeningDoor: true,
    paletteHint: 'panel_match',
      costUSD: 850,
  },
  {
    id: 'microwave_otr',
    label: 'Over-Range Microwave',
    hint: 'Microwave mounted under upper cabinets, above the range.',
    kind: 'appliance',
    bodyWidth: 0.4,
    bodyHeight: 0.18,
    defaultAnchor: 'top',
    hasOpeningDoor: true,
    paletteHint: 'stainless',
      costUSD: 380,
  },
  {
    id: 'sink_kitchen_double',
    label: 'Kitchen Sink (Double)',
    hint: 'Double-basin kitchen sink + gooseneck faucet.',
    kind: 'fixture',
    bodyWidth: 0.5,
    bodyHeight: 0.06,
    defaultAnchor: 'bottom',
    paletteHint: 'stainless',
      costUSD: 420,
  },
  {
    id: 'sink_kitchen_single',
    label: 'Kitchen Sink (Single)',
    hint: 'Single deep basin + faucet.',
    kind: 'fixture',
    bodyWidth: 0.4,
    bodyHeight: 0.06,
    defaultAnchor: 'bottom',
    paletteHint: 'stainless',
      costUSD: 320,
  },
  {
    id: 'sink_pedestal',
    label: 'Pedestal Sink',
    hint: 'Bathroom sink on a porcelain pedestal — no cabinet needed.',
    kind: 'fixture',
    bodyWidth: 0.3,
    bodyHeight: 0.35,
    defaultAnchor: 'bottom',
    paletteHint: 'porcelain',
      costUSD: 220,
  },
  {
    id: 'sink_vessel',
    label: 'Vessel Sink',
    hint: 'Bowl-on-counter bathroom sink — sits on top of a vanity.',
    kind: 'fixture',
    bodyWidth: 0.25,
    bodyHeight: 0.08,
    defaultAnchor: 'mid',
    paletteHint: 'porcelain',
      costUSD: 180,
  },
  {
    id: 'toilet_standard',
    label: 'Toilet',
    hint: 'Standard two-piece toilet with tank.',
    kind: 'fixture',
    bodyWidth: 0.3,
    bodyHeight: 0.35,
    defaultAnchor: 'bottom',
    paletteHint: 'porcelain',
      costUSD: 280,
  },
  {
    id: 'toilet_wall_hung',
    label: 'Wall-Hung Toilet',
    hint: 'Modern wall-hung toilet — concealed tank behind wall.',
    kind: 'fixture',
    bodyWidth: 0.3,
    bodyHeight: 0.18,
    defaultAnchor: 'mid',
    paletteHint: 'porcelain',
      costUSD: 520,
  },
  {
    id: 'shower_stall',
    label: 'Shower Stall',
    hint: 'Walk-in glass shower stall.',
    kind: 'fixture',
    bodyWidth: 0.5,
    bodyHeight: 0.85,
    defaultAnchor: 'mid',
    paletteHint: 'glass',
      costUSD: 1800,
  },
  {
    id: 'bathtub_alcove',
    label: 'Bathtub',
    hint: 'Standard alcove bathtub.',
    kind: 'fixture',
    bodyWidth: 0.7,
    bodyHeight: 0.22,
    defaultAnchor: 'bottom',
    paletteHint: 'enamel',
      costUSD: 850,
  },
  {
    id: 'washer',
    label: 'Washer',
    hint: 'Front-load washing machine.',
    kind: 'appliance',
    bodyWidth: 0.4,
    bodyHeight: 0.34,
    defaultAnchor: 'bottom',
    hasOpeningDoor: true,
    paletteHint: 'enamel',
      costUSD: 950,
  },
  {
    id: 'dryer',
    label: 'Dryer',
    hint: 'Front-load dryer — pairs with washer.',
    kind: 'appliance',
    bodyWidth: 0.4,
    bodyHeight: 0.34,
    defaultAnchor: 'bottom',
    hasOpeningDoor: true,
    paletteHint: 'enamel',
      costUSD: 850,
  },
];

export const DEFAULT_FIXTURE_TEMPLATE: FixtureTemplateId = 'sink_kitchen_double';

import { byId } from './_byId';
export function getFixtureTemplate(id: FixtureTemplateId): FixtureTemplate {
  return byId(FIXTURE_TEMPLATES, id);
}
