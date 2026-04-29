/**
 * cabinetrySkins.ts — Shared skin catalog for shelves and cabinets.
 *
 * A "skin" defines the finish/material applied on top of a shelf or cabinet
 * TEMPLATE. Skins are decoupled from templates so the same shape can be
 * reskinned without touching geometry.
 *
 * Mirrored skins (mirrorDoors: true) make door/drawer fronts highly reflective
 * — body keeps regular material. Implemented as high-metalness/low-roughness
 * MeshStandardMaterial picking up scene IBL (no Reflector cost).
 *
 * Pure data, no React, no Three.js. Renderer maps template + skin → mesh.
 */

export type CabinetrySkinId =
  | 'oak_natural'
  | 'oak_stained'
  | 'walnut_dark'
  | 'shaker_white'
  | 'shaker_navy'
  | 'shaker_sage'
  | 'painted_black_modern'
  | 'slab_white_gloss'
  | 'slab_black_matte'
  | 'hinoki_natural'
  | 'steel_industrial'
  | 'mirror_silver'
  | 'bronze_mirror';

export type CabinetryDoorStyle = 'shaker' | 'slab';
export type CabinetrySwatchHint = 'wood' | 'painted' | 'metal';

export interface CabinetrySkin {
  id: CabinetrySkinId;
  label: string;
  /** Carcass / shelf body / drawer side colour. */
  bodyColor: string;
  /** Door + drawer front colour. Falls back to bodyColor if absent. */
  doorColor: string;
  /** Pull / knob hardware tint. */
  handleColor: string;
  /** Visual styling cue — shaker draws a recessed inset border on door fronts;
   *  slab is flat. */
  doorStyle: CabinetryDoorStyle;
  /** Picker swatch hint. */
  swatchHint: CabinetrySwatchHint;
  /** When true, door + drawer fronts render with a reflective (mirror)
   *  material. Body stays regular. */
  mirrorDoors?: boolean;
}

export const CABINETRY_SKINS: CabinetrySkin[] = [
  {
    id: 'oak_natural',
    label: 'Natural Oak',
    bodyColor: '#c9a274',
    doorColor: '#a07043',
    handleColor: '#3a2410',
    doorStyle: 'shaker',
    swatchHint: 'wood',
  },
  {
    id: 'oak_stained',
    label: 'Stained Oak',
    bodyColor: '#8a5a30',
    doorColor: '#6e4523',
    handleColor: '#1c1a18',
    doorStyle: 'shaker',
    swatchHint: 'wood',
  },
  {
    id: 'walnut_dark',
    label: 'Dark Walnut',
    bodyColor: '#3a2620',
    doorColor: '#241612',
    handleColor: '#0f0a08',
    doorStyle: 'shaker',
    swatchHint: 'wood',
  },
  {
    id: 'shaker_white',
    label: 'Shaker White',
    bodyColor: '#f5f5f4',
    doorColor: '#fafaf9',
    handleColor: '#3a3a3a',
    doorStyle: 'shaker',
    swatchHint: 'painted',
  },
  {
    id: 'shaker_navy',
    label: 'Shaker Navy',
    bodyColor: '#22324a',
    doorColor: '#1a2a40',
    handleColor: '#cba135',
    doorStyle: 'shaker',
    swatchHint: 'painted',
  },
  {
    id: 'shaker_sage',
    label: 'Shaker Sage',
    bodyColor: '#9aaf94',
    doorColor: '#88a182',
    handleColor: '#3a3a3a',
    doorStyle: 'shaker',
    swatchHint: 'painted',
  },
  {
    id: 'painted_black_modern',
    label: 'Modern Black',
    bodyColor: '#1a1a1a',
    doorColor: '#0c0c0c',
    handleColor: '#9c9c9c',
    doorStyle: 'slab',
    swatchHint: 'painted',
  },
  {
    id: 'slab_white_gloss',
    label: 'Gloss White',
    bodyColor: '#f5f5f4',
    doorColor: '#ffffff',
    handleColor: '#9c9c9c',
    doorStyle: 'slab',
    swatchHint: 'painted',
  },
  {
    id: 'slab_black_matte',
    label: 'Matte Black',
    bodyColor: '#161616',
    doorColor: '#1a1a1a',
    handleColor: '#3a3a3a',
    doorStyle: 'slab',
    swatchHint: 'painted',
  },
  {
    id: 'hinoki_natural',
    label: 'Hinoki Cedar',
    bodyColor: '#d4b896',
    doorColor: '#b8956a',
    handleColor: '#6b4f30',
    doorStyle: 'shaker',
    swatchHint: 'wood',
  },
  {
    id: 'steel_industrial',
    label: 'Steel Industrial',
    bodyColor: '#5a6470',
    doorColor: '#2c333b',
    handleColor: '#9aa3ad',
    doorStyle: 'slab',
    swatchHint: 'metal',
  },
  {
    id: 'mirror_silver',
    label: 'Silver Mirror',
    bodyColor: '#3a3a3a',
    doorColor: '#f0f0f0',
    handleColor: '#9c9c9c',
    doorStyle: 'slab',
    swatchHint: 'metal',
    mirrorDoors: true,
  },
  {
    id: 'bronze_mirror',
    label: 'Bronze Mirror',
    bodyColor: '#3a2c1f',
    doorColor: '#cd9b6a',
    handleColor: '#5a3f1c',
    doorStyle: 'slab',
    swatchHint: 'metal',
    mirrorDoors: true,
  },
];

export const DEFAULT_CABINETRY_SKIN: CabinetrySkinId = 'oak_natural';

import { byId } from './_byId';
export function getCabinetrySkin(id: CabinetrySkinId): CabinetrySkin {
  return byId(CABINETRY_SKINS, id);
}
