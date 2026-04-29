/**
 * roofTypes.ts — Roof shape catalog for containers.
 *
 * The default roof is flat steel (existing behavior, container-native). New
 * options change the visible profile above the container body — pitched
 * gable, single-slope shed, butterfly inverted-V, parapet flat with raised
 * edge, and green roof.
 *
 * The roof is purely cosmetic geometry attached to the container's level-1
 * top. It doesn't affect floor area, rooms, or walkthrough collision.
 */

import { byId } from './_byId';

export type RoofTypeId =
  | 'flat'
  | 'parapet'
  | 'gable'
  | 'shed'
  | 'butterfly'
  | 'green';

export interface RoofType {
  id: RoofTypeId;
  label: string;
  hint: string;
  /** Maximum extra height (m) above the container's top — drives the
   *  scene's bounding box and walkthrough ceiling. */
  peakHeight: number;
  /** Color hint for the renderer's material lookup (see roofMaterials). */
  paletteHint: 'steel_corrugated' | 'membrane_white' | 'asphalt_shingle' | 'standing_seam' | 'green_living';
  /** Cost in USD to build this roof on top of one 40' container. */
  costUSD: number;
}

export const ROOF_TYPES: RoofType[] = [
  { id: 'flat',      label: 'Flat',      hint: 'Default container roof — flat steel.',                      peakHeight: 0.0, paletteHint: 'steel_corrugated', costUSD: 0 },
  { id: 'parapet',   label: 'Parapet',   hint: 'Flat roof with raised perimeter edge — modern.',            peakHeight: 0.4, paletteHint: 'membrane_white',   costUSD: 1800 },
  { id: 'gable',     label: 'Gable',     hint: 'Classic pitched roof — A-frame profile.',                   peakHeight: 1.2, paletteHint: 'asphalt_shingle',  costUSD: 4800 },
  { id: 'shed',      label: 'Shed',      hint: 'Single-slope mono-pitch — modern industrial.',              peakHeight: 0.9, paletteHint: 'standing_seam',    costUSD: 3200 },
  { id: 'butterfly', label: 'Butterfly', hint: 'Inverted-V profile, valley at center — mid-century modern.', peakHeight: 1.0, paletteHint: 'standing_seam',    costUSD: 5400 },
  { id: 'green',     label: 'Green Roof',hint: 'Living roof — sedum + drainage layer.',                     peakHeight: 0.18, paletteHint: 'green_living',    costUSD: 6800 },
];

export const DEFAULT_ROOF_TYPE: RoofTypeId = 'flat';

export function getRoofType(id: RoofTypeId): RoofType {
  return byId(ROOF_TYPES, id);
}
