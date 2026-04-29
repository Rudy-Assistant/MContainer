/**
 * counterTopMaterials.ts — Counter top material catalog.
 *
 * A counter top is a thin slab that sits on top of a base/vanity cabinet.
 * Two adjacent base-cabinet voxels with the same counter top material
 * render as a visually-continuous run.
 *
 * Pure data. Materials built lazily by `getCounterTopMaterial`.
 */

export type CounterTopMaterialId =
  | 'quartz_white'
  | 'quartz_black'
  | 'marble_carrara'
  | 'butcher_block_oak'
  | 'butcher_block_walnut'
  | 'concrete_polished'
  | 'stainless_steel'
  | 'soapstone';

export interface CounterTopMaterial {
  id: CounterTopMaterialId;
  label: string;
  color: string;
  /** Speckle pattern hint — purely for the picker swatch. Renderer uses
   *  metalness/roughness derived from `kind`. */
  swatchAccent?: string;
  kind: 'stone' | 'wood' | 'metal' | 'concrete';
  /** Cost per voxel-face slab in USD. Adjacent voxels in a run pay
   *  separately, which approximates real linear-foot pricing. */
  costPerSlabUSD: number;
}

export const COUNTER_TOP_MATERIALS: CounterTopMaterial[] = [
  { id: 'quartz_white',         label: 'White Quartz',     color: '#f5f5f3', swatchAccent: '#e0e0dc', kind: 'stone',    costPerSlabUSD: 480 },
  { id: 'quartz_black',         label: 'Black Quartz',     color: '#1a1a1c', swatchAccent: '#3a3a3c', kind: 'stone',    costPerSlabUSD: 520 },
  { id: 'marble_carrara',       label: 'Carrara Marble',   color: '#ecebe7', swatchAccent: '#a3a3a8', kind: 'stone',    costPerSlabUSD: 720 },
  { id: 'butcher_block_oak',    label: 'Oak Butcher Block', color: '#a07043', swatchAccent: '#7a532f', kind: 'wood',    costPerSlabUSD: 320 },
  { id: 'butcher_block_walnut', label: 'Walnut Block',     color: '#3a2620', swatchAccent: '#241612', kind: 'wood',    costPerSlabUSD: 460 },
  { id: 'concrete_polished',    label: 'Polished Concrete', color: '#7a7c7e', swatchAccent: '#5e6062', kind: 'concrete', costPerSlabUSD: 380 },
  { id: 'stainless_steel',      label: 'Stainless Steel',  color: '#c0c4c8', swatchAccent: '#9aa0a6', kind: 'metal',    costPerSlabUSD: 540 },
  { id: 'soapstone',            label: 'Soapstone',        color: '#3a3e44', swatchAccent: '#5a5e64', kind: 'stone',    costPerSlabUSD: 680 },
];

export const DEFAULT_COUNTER_TOP: CounterTopMaterialId = 'quartz_white';

import { byId } from './_byId';
export function getCounterTopMaterial(id: CounterTopMaterialId): CounterTopMaterial {
  return byId(COUNTER_TOP_MATERIALS, id);
}
