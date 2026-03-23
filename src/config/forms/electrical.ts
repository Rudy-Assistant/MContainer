// src/config/forms/electrical.ts
// 4 electrical form definitions for the unified placeable object system.

import type { FormDefinition, StyleId } from '@/types/sceneObject';

const ALL_STYLES: StyleId[] = [
  'modern', 'industrial', 'japanese', 'desert_brutalist',
  'coastal', 'noir_glass', 'solarpunk', 'frontier_rustic',
  'retro_capsule', 'neo_tropical', 'cyberpunk', 'maker_raw',
  'art_deco', 'arctic_bunker', 'terra_adobe', 'memphis_pop',
  'stealth',
];

export const ELECTRICAL_FORMS: FormDefinition[] = [
  {
    id: 'electrical_outlet',
    category: 'electrical',
    name: 'Electrical Outlet',
    description: 'Standard duplex electrical outlet with cover plate.',
    styles: ALL_STYLES,
    anchorType: 'face',
    slotWidth: 1,
    dimensions: { w: 0.07, h: 0.11, d: 0.03 },
    skinSlots: [
      {
        id: 'plate',
        label: 'Cover Plate',
        materialOptions: [
          'powder_coat_white', 'matte_black', 'brushed_aluminum',
          'diamond_plate', 'painted_white', 'polished_chrome',
          'anodized_aluminum',
        ],
      },
    ],
    defaultSkin: {
      plate: 'powder_coat_white',
    },
    geometry: 'procedural',
    costEstimate: 30,
  },

  {
    id: 'electrical_switch',
    category: 'electrical',
    name: 'Light Switch',
    description: 'Single-pole rocker or toggle light switch with cover plate.',
    styles: ALL_STYLES,
    anchorType: 'face',
    slotWidth: 1,
    dimensions: { w: 0.07, h: 0.11, d: 0.03 },
    skinSlots: [
      {
        id: 'plate',
        label: 'Cover Plate',
        materialOptions: [
          'powder_coat_white', 'matte_black', 'brushed_aluminum',
          'diamond_plate', 'painted_white', 'polished_chrome',
          'anodized_aluminum',
        ],
      },
    ],
    defaultSkin: {
      plate: 'powder_coat_white',
    },
    geometry: 'procedural',
    costEstimate: 25,
  },

  {
    id: 'electrical_dimmer',
    category: 'electrical',
    name: 'Dimmer Switch',
    description: 'Rotary or slide dimmer switch for adjustable lighting control.',
    styles: ALL_STYLES,
    anchorType: 'face',
    slotWidth: 1,
    dimensions: { w: 0.07, h: 0.11, d: 0.04 },
    skinSlots: [
      {
        id: 'plate',
        label: 'Cover Plate',
        materialOptions: [
          'powder_coat_white', 'matte_black', 'brushed_aluminum',
          'polished_chrome', 'painted_white', 'anodized_aluminum',
          'dark_chrome',
        ],
      },
    ],
    defaultSkin: {
      plate: 'brushed_aluminum',
    },
    geometry: 'procedural',
    costEstimate: 45,
  },

  {
    id: 'electrical_usb_outlet',
    category: 'electrical',
    name: 'USB Outlet',
    description: 'Combined electrical outlet with integrated USB-A and USB-C charging ports.',
    styles: ['modern', 'cyberpunk', 'retro_capsule'],
    anchorType: 'face',
    slotWidth: 1,
    dimensions: { w: 0.07, h: 0.11, d: 0.04 },
    skinSlots: [
      {
        id: 'plate',
        label: 'Cover Plate',
        materialOptions: [
          'brushed_aluminum', 'matte_black', 'anodized_aluminum',
          'dark_chrome', 'carbon_fiber', 'powder_coat_white',
          'polished_chrome',
        ],
      },
    ],
    defaultSkin: {
      plate: 'brushed_aluminum',
    },
    geometry: 'procedural',
    costEstimate: 50,
  },
];
