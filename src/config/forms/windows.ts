// src/config/forms/windows.ts
// 7 window form definitions for the unified placeable object system.

import type { FormDefinition, StyleId } from '@/types/sceneObject';

const ALL_STYLES: StyleId[] = [
  'modern', 'industrial', 'japanese', 'desert_brutalist',
  'coastal', 'noir_glass', 'solarpunk', 'frontier_rustic',
  'retro_capsule', 'neo_tropical', 'cyberpunk', 'maker_raw',
  'art_deco', 'arctic_bunker', 'terra_adobe', 'memphis_pop',
  'stealth',
];

export const WINDOW_FORMS: FormDefinition[] = [
  {
    id: 'window_standard',
    category: 'window',
    name: 'Standard Window',
    description: 'Classic fixed or operable window suitable for any style.',
    styles: ALL_STYLES,
    anchorType: 'face',
    slotWidth: 1,
    dimensions: { w: 0.9, h: 1.2, d: 0.05 },
    skinSlots: [
      {
        id: 'frame',
        label: 'Frame',
        materialOptions: [
          'brushed_aluminum', 'raw_steel', 'painted_white',
          'warm_oak', 'hinoki_cypress', 'matte_black', 'powder_coat_white',
        ],
      },
      {
        id: 'glass',
        label: 'Glass',
        materialOptions: [
          'clear_glass', 'frosted_glass', 'smoked_glass',
          'sea_glass', 'fluted_glass', 'frosted_polycarbonate',
        ],
      },
      {
        id: 'sill',
        label: 'Sill',
        materialOptions: [
          'marble_composite', 'terrazzo', 'painted_white',
          'light_oak', 'concrete_grey', 'ceramic_tile',
        ],
      },
    ],
    defaultSkin: {
      frame: 'brushed_aluminum',
      glass: 'clear_glass',
      sill: 'painted_white',
    },
    geometry: 'procedural',
    costEstimate: 500,
  },

  {
    id: 'window_picture',
    category: 'window',
    name: 'Picture Window',
    description: 'Large fixed glass panel for panoramic views with minimal framing.',
    styles: ['modern', 'noir_glass', 'cyberpunk'],
    anchorType: 'face',
    slotWidth: 3,
    dimensions: { w: 2.4, h: 1.5, d: 0.04 },
    skinSlots: [
      {
        id: 'frame',
        label: 'Frame',
        materialOptions: [
          'brushed_aluminum', 'matte_black', 'dark_chrome',
          'anodized_aluminum', 'carbon_fiber', 'gunmetal',
        ],
      },
      {
        id: 'glass',
        label: 'Glass',
        materialOptions: [
          'clear_glass', 'smoked_glass', 'neon_edge_acrylic',
          'bronze_tint', 'frosted_polycarbonate',
        ],
      },
    ],
    defaultSkin: {
      frame: 'matte_black',
      glass: 'clear_glass',
    },
    geometry: 'procedural',
    costEstimate: 900,
  },

  {
    id: 'window_half',
    category: 'window',
    name: 'Half Window',
    description: 'Low-profile window set at mid-wall height for ventilation and light.',
    styles: ALL_STYLES,
    anchorType: 'face',
    slotWidth: 1,
    dimensions: { w: 0.9, h: 0.6, d: 0.05 },
    skinSlots: [
      {
        id: 'frame',
        label: 'Frame',
        materialOptions: [
          'brushed_aluminum', 'raw_steel', 'painted_white',
          'warm_oak', 'hinoki_cypress', 'matte_black',
        ],
      },
      {
        id: 'glass',
        label: 'Glass',
        materialOptions: [
          'clear_glass', 'frosted_glass', 'sea_glass',
          'fluted_glass', 'smoked_glass', 'frosted_polycarbonate',
        ],
      },
      {
        id: 'wall',
        label: 'Wall Surround',
        materialOptions: [
          'painted_white', 'raw_concrete', 'concrete_grey',
          'ceramic_tile', 'painted_sage', 'terracotta',
        ],
      },
    ],
    defaultSkin: {
      frame: 'brushed_aluminum',
      glass: 'frosted_glass',
      wall: 'painted_white',
    },
    geometry: 'procedural',
    costEstimate: 450,
  },

  {
    id: 'window_clerestory',
    category: 'window',
    name: 'Clerestory Window',
    description: 'High-set narrow window that admits light without sacrificing wall privacy.',
    styles: ['modern', 'industrial', 'desert_brutalist'],
    anchorType: 'face',
    slotWidth: 1,
    dimensions: { w: 0.9, h: 0.4, d: 0.05 },
    skinSlots: [
      {
        id: 'frame',
        label: 'Frame',
        materialOptions: [
          'raw_steel', 'brushed_aluminum', 'matte_black',
          'anodized_aluminum', 'gunmetal', 'sand_blasted_steel',
        ],
      },
      {
        id: 'glass',
        label: 'Glass',
        materialOptions: [
          'clear_glass', 'frosted_glass', 'smoked_glass',
          'frosted_polycarbonate', 'fluted_glass',
        ],
      },
    ],
    defaultSkin: {
      frame: 'raw_steel',
      glass: 'clear_glass',
    },
    geometry: 'procedural',
    costEstimate: 400,
  },

  {
    id: 'window_porthole',
    category: 'window',
    name: 'Porthole Window',
    description: 'Circular porthole window with deep-reveal frame for a nautical or industrial feel.',
    styles: ['industrial', 'coastal', 'stealth'],
    anchorType: 'face',
    slotWidth: 1,
    dimensions: { w: 0.6, h: 0.6, d: 0.12 },
    skinSlots: [
      {
        id: 'frame',
        label: 'Frame',
        materialOptions: [
          'raw_steel', 'wrought_iron', 'gunmetal',
          'matte_black', 'oxidized_copper', 'sand_blasted_steel',
        ],
      },
      {
        id: 'glass',
        label: 'Glass',
        materialOptions: [
          'clear_glass', 'smoked_glass', 'frosted_glass',
          'sea_glass', 'bronze_tint',
        ],
      },
    ],
    defaultSkin: {
      frame: 'raw_steel',
      glass: 'clear_glass',
    },
    geometry: 'procedural',
    costEstimate: 350,
  },

  {
    id: 'window_shoji_screen',
    category: 'window',
    name: 'Shoji Screen Window',
    description: 'Traditional Japanese latticed window with translucent washi paper.',
    styles: ['japanese'],
    anchorType: 'face',
    slotWidth: 2,
    dimensions: { w: 1.2, h: 1.5, d: 0.04 },
    skinSlots: [
      {
        id: 'frame',
        label: 'Frame',
        materialOptions: [
          'hinoki_cypress', 'bamboo_composite', 'light_oak',
          'bleached_wood', 'warm_oak',
        ],
      },
      {
        id: 'paper',
        label: 'Paper',
        materialOptions: [
          'rice_paper_washi', 'frosted_polycarbonate', 'frosted_glass',
          'woven_rattan', 'palm_fiber',
        ],
      },
    ],
    defaultSkin: {
      frame: 'hinoki_cypress',
      paper: 'rice_paper_washi',
    },
    geometry: 'procedural',
    costEstimate: 600,
  },

  {
    id: 'window_double_hung',
    category: 'window',
    name: 'Double-Hung Window',
    description: 'Classic operable window with two sliding sashes for ventilation.',
    styles: ['art_deco', 'frontier_rustic', 'coastal'],
    anchorType: 'face',
    slotWidth: 1,
    dimensions: { w: 0.9, h: 1.2, d: 0.1 },
    skinSlots: [
      {
        id: 'frame',
        label: 'Frame',
        materialOptions: [
          'painted_white', 'warm_oak', 'light_oak',
          'reclaimed_barn', 'bleached_wood', 'powder_coat_white',
        ],
      },
      {
        id: 'glass',
        label: 'Glass',
        materialOptions: [
          'clear_glass', 'frosted_glass', 'sea_glass',
          'fluted_glass', 'bronze_tint', 'frosted_polycarbonate',
        ],
      },
      {
        id: 'sill',
        label: 'Sill',
        materialOptions: [
          'painted_white', 'marble_composite', 'light_oak',
          'ceramic_tile', 'terrazzo',
        ],
      },
    ],
    defaultSkin: {
      frame: 'painted_white',
      glass: 'clear_glass',
      sill: 'painted_white',
    },
    geometry: 'procedural',
    costEstimate: 550,
  },
];
