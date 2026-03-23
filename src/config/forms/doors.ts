// src/config/forms/doors.ts
// 8 door form definitions for the unified placeable object system.

import type { FormDefinition, StyleId } from '@/types/sceneObject';

const ALL_STYLES: StyleId[] = [
  'modern', 'industrial', 'japanese', 'desert_brutalist',
  'coastal', 'noir_glass', 'solarpunk', 'frontier_rustic',
  'retro_capsule', 'neo_tropical', 'cyberpunk', 'maker_raw',
  'art_deco', 'arctic_bunker', 'terra_adobe', 'memphis_pop',
  'stealth',
];

export const DOOR_FORMS: FormDefinition[] = [
  {
    id: 'door_single_swing',
    category: 'door',
    name: 'Single Swing Door',
    description: 'Standard single-panel hinged door suitable for all styles.',
    styles: ALL_STYLES,
    anchorType: 'face',
    slotWidth: 2,
    dimensions: { w: 0.9, h: 2.1, d: 0.05 },
    skinSlots: [
      {
        id: 'frame',
        label: 'Frame',
        materialOptions: [
          'raw_steel', 'brushed_aluminum', 'matte_black', 'gunmetal',
          'hinoki_cypress', 'warm_oak', 'painted_white',
        ],
      },
      {
        id: 'panel',
        label: 'Panel',
        materialOptions: [
          'light_oak', 'walnut', 'reclaimed_barn', 'white_laminate',
          'black_lacquer', 'raw_concrete', 'painted_white',
        ],
      },
      {
        id: 'handle',
        label: 'Handle',
        materialOptions: [
          'polished_chrome', 'brushed_aluminum', 'matte_black',
          'blackened_brass', 'polished_brass', 'gunmetal',
        ],
      },
    ],
    defaultSkin: {
      frame: 'brushed_aluminum',
      panel: 'white_laminate',
      handle: 'polished_chrome',
    },
    geometry: 'procedural',
    costEstimate: 800,
  },

  {
    id: 'door_double_swing',
    category: 'door',
    name: 'Double Swing Door',
    description: 'Wide double-panel hinged door for grand entrances.',
    styles: ALL_STYLES,
    anchorType: 'face',
    slotWidth: 3,
    dimensions: { w: 1.8, h: 2.1, d: 0.05 },
    skinSlots: [
      {
        id: 'frame',
        label: 'Frame',
        materialOptions: [
          'raw_steel', 'brushed_aluminum', 'matte_black', 'gunmetal',
          'hinoki_cypress', 'warm_oak', 'painted_white',
        ],
      },
      {
        id: 'panel',
        label: 'Panel',
        materialOptions: [
          'light_oak', 'walnut', 'reclaimed_barn', 'white_laminate',
          'black_lacquer', 'raw_concrete', 'painted_white',
        ],
      },
      {
        id: 'handle',
        label: 'Handle',
        materialOptions: [
          'polished_chrome', 'brushed_aluminum', 'matte_black',
          'blackened_brass', 'polished_brass', 'gunmetal',
        ],
      },
    ],
    defaultSkin: {
      frame: 'brushed_aluminum',
      panel: 'white_laminate',
      handle: 'polished_chrome',
    },
    geometry: 'procedural',
    costEstimate: 1200,
  },

  {
    id: 'door_barn_slide',
    category: 'door',
    name: 'Barn Slide Door',
    description: 'Rustic sliding barn door on an exposed overhead track.',
    styles: ['industrial', 'frontier_rustic', 'maker_raw'],
    anchorType: 'face',
    slotWidth: 2,
    dimensions: { w: 0.9, h: 2.1, d: 0.06 },
    skinSlots: [
      {
        id: 'frame',
        label: 'Frame',
        materialOptions: [
          'raw_steel', 'wrought_iron', 'gunmetal',
          'cerakote_dark_earth', 'sand_blasted_steel',
        ],
      },
      {
        id: 'panel',
        label: 'Panel',
        materialOptions: [
          'reclaimed_barn', 'dark_teak', 'warm_oak',
          'laser_cut_plywood', 'mesquite_wood',
        ],
      },
      {
        id: 'track',
        label: 'Track',
        materialOptions: [
          'raw_steel', 'wrought_iron', 'matte_black',
          'gunmetal', 'cerakote_dark_earth',
        ],
      },
    ],
    defaultSkin: {
      frame: 'raw_steel',
      panel: 'reclaimed_barn',
      track: 'wrought_iron',
    },
    geometry: 'procedural',
    costEstimate: 950,
  },

  {
    id: 'door_pocket_slide',
    category: 'door',
    name: 'Pocket Slide Door',
    description: 'Sleek door that retracts into the wall cavity.',
    styles: ['modern', 'japanese', 'noir_glass'],
    anchorType: 'face',
    slotWidth: 2,
    dimensions: { w: 0.9, h: 2.1, d: 0.04 },
    skinSlots: [
      {
        id: 'frame',
        label: 'Frame',
        materialOptions: [
          'brushed_aluminum', 'anodized_aluminum', 'matte_black',
          'hinoki_cypress', 'bamboo_composite', 'polished_chrome',
        ],
      },
      {
        id: 'panel',
        label: 'Panel',
        materialOptions: [
          'frosted_glass', 'clear_glass', 'smoked_glass',
          'white_laminate', 'black_lacquer', 'hinoki_cypress',
        ],
      },
    ],
    defaultSkin: {
      frame: 'brushed_aluminum',
      panel: 'frosted_glass',
    },
    geometry: 'procedural',
    costEstimate: 1100,
  },

  {
    id: 'door_bifold',
    category: 'door',
    name: 'Bifold Door',
    description: 'Folding door panels that stack to one side when open.',
    styles: ['modern', 'retro_capsule'],
    anchorType: 'face',
    slotWidth: 3,
    dimensions: { w: 1.8, h: 2.1, d: 0.05 },
    skinSlots: [
      {
        id: 'frame',
        label: 'Frame',
        materialOptions: [
          'brushed_aluminum', 'anodized_aluminum', 'matte_black',
          'polished_chrome', 'powder_coat_white', 'powder_coat_sky',
        ],
      },
      {
        id: 'panel',
        label: 'Panel',
        materialOptions: [
          'white_laminate', 'frosted_polycarbonate', 'clear_glass',
          'pla_white', 'powder_coat_blush', 'painted_white',
        ],
      },
      {
        id: 'handle',
        label: 'Handle',
        materialOptions: [
          'polished_chrome', 'brushed_aluminum', 'matte_black',
          'anodized_aluminum', 'powder_coat_sky',
        ],
      },
    ],
    defaultSkin: {
      frame: 'brushed_aluminum',
      panel: 'white_laminate',
      handle: 'polished_chrome',
    },
    geometry: 'procedural',
    costEstimate: 1400,
  },

  {
    id: 'door_french',
    category: 'door',
    name: 'French Door',
    description: 'Elegant double door with divided glass panes.',
    styles: ['art_deco', 'frontier_rustic', 'coastal'],
    anchorType: 'face',
    slotWidth: 3,
    dimensions: { w: 1.5, h: 2.2, d: 0.05 },
    skinSlots: [
      {
        id: 'frame',
        label: 'Frame',
        materialOptions: [
          'painted_white', 'warm_oak', 'light_oak',
          'powder_coat_white', 'bleached_wood', 'reclaimed_barn',
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
        id: 'handle',
        label: 'Handle',
        materialOptions: [
          'polished_brass', 'blackened_brass', 'polished_chrome',
          'brushed_aluminum', 'oxidized_copper',
        ],
      },
    ],
    defaultSkin: {
      frame: 'painted_white',
      glass: 'clear_glass',
      handle: 'polished_brass',
    },
    geometry: 'procedural',
    costEstimate: 1500,
  },

  {
    id: 'door_glass_slide',
    category: 'door',
    name: 'Glass Slide Door',
    description: 'Floor-to-ceiling sliding glass door with minimal framing.',
    styles: ['modern', 'noir_glass', 'cyberpunk'],
    anchorType: 'face',
    slotWidth: 2,
    dimensions: { w: 1.2, h: 2.4, d: 0.04 },
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
          'clear_glass', 'smoked_glass', 'frosted_glass',
          'neon_edge_acrylic', 'bronze_tint', 'fluted_glass',
        ],
      },
      {
        id: 'track',
        label: 'Track',
        materialOptions: [
          'brushed_aluminum', 'matte_black', 'dark_chrome',
          'anodized_aluminum', 'gunmetal',
        ],
      },
    ],
    defaultSkin: {
      frame: 'matte_black',
      glass: 'clear_glass',
      track: 'matte_black',
    },
    geometry: 'procedural',
    costEstimate: 1300,
  },

  {
    id: 'door_shoji',
    category: 'door',
    name: 'Shoji Screen Door',
    description: 'Traditional Japanese sliding screen with translucent washi paper panels.',
    styles: ['japanese'],
    anchorType: 'face',
    slotWidth: 2,
    dimensions: { w: 0.9, h: 2.0, d: 0.04 },
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
    costEstimate: 900,
  },
];
