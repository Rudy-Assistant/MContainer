// src/config/forms/lights.ts
// 8 light form definitions for the unified placeable object system.

import type { FormDefinition, StyleId } from '@/types/sceneObject';

const ALL_STYLES: StyleId[] = [
  'modern', 'industrial', 'japanese', 'desert_brutalist',
  'coastal', 'noir_glass', 'solarpunk', 'frontier_rustic',
  'retro_capsule', 'neo_tropical', 'cyberpunk', 'maker_raw',
  'art_deco', 'arctic_bunker', 'terra_adobe', 'memphis_pop',
  'stealth',
];

export const LIGHT_FORMS: FormDefinition[] = [
  {
    id: 'light_pendant',
    category: 'light',
    name: 'Pendant Light',
    description: 'Suspended ceiling fixture hanging on a cord or rod for focused ambient light.',
    styles: ALL_STYLES,
    anchorType: 'ceiling',
    slotWidth: 1,
    dimensions: { w: 0.3, h: 0.4, d: 0.3 },
    skinSlots: [
      {
        id: 'fixture',
        label: 'Fixture',
        materialOptions: [
          'brushed_aluminum', 'matte_black', 'polished_brass',
          'blackened_brass', 'oxidized_copper', 'raw_steel',
          'powder_coat_white',
        ],
      },
      {
        id: 'cord',
        label: 'Cord',
        materialOptions: [
          'ballistic_nylon', 'leather', 'woven_rattan',
          'rice_paper_washi', 'palm_fiber',
        ],
      },
    ],
    defaultSkin: {
      fixture: 'matte_black',
      cord: 'ballistic_nylon',
    },
    geometry: 'procedural',
    costEstimate: 250,
  },

  {
    id: 'light_flush_mount',
    category: 'light',
    name: 'Flush Mount Light',
    description: 'Ceiling-hugging fixture for low-clearance rooms with clean profiles.',
    styles: ['modern', 'industrial', 'noir_glass'],
    anchorType: 'ceiling',
    slotWidth: 1,
    dimensions: { w: 0.3, h: 0.08, d: 0.3 },
    skinSlots: [
      {
        id: 'fixture',
        label: 'Fixture',
        materialOptions: [
          'brushed_aluminum', 'matte_black', 'raw_steel',
          'gunmetal', 'anodized_aluminum', 'dark_chrome',
          'powder_coat_white',
        ],
      },
    ],
    defaultSkin: {
      fixture: 'brushed_aluminum',
    },
    geometry: 'procedural',
    costEstimate: 180,
  },

  {
    id: 'light_track',
    category: 'light',
    name: 'Track Light',
    description: 'Adjustable multi-head ceiling track for directed task and accent lighting.',
    styles: ['modern', 'industrial', 'cyberpunk'],
    anchorType: 'ceiling',
    slotWidth: 1,
    dimensions: { w: 1.2, h: 0.08, d: 0.06 },
    skinSlots: [
      {
        id: 'track',
        label: 'Track',
        materialOptions: [
          'brushed_aluminum', 'matte_black', 'raw_steel',
          'anodized_aluminum', 'gunmetal',
        ],
      },
      {
        id: 'heads',
        label: 'Heads',
        materialOptions: [
          'matte_black', 'brushed_aluminum', 'woven_rattan',
          'ballistic_nylon', 'palm_fiber',
        ],
      },
    ],
    defaultSkin: {
      track: 'matte_black',
      heads: 'matte_black',
    },
    geometry: 'procedural',
    costEstimate: 350,
  },

  {
    id: 'light_recessed',
    category: 'light',
    name: 'Recessed Downlight',
    description: 'In-ceiling recessed can light with a flush trim ring.',
    styles: ['modern', 'noir_glass'],
    anchorType: 'ceiling',
    slotWidth: 1,
    dimensions: { w: 0.15, h: 0.12, d: 0.15 },
    skinSlots: [
      {
        id: 'trim',
        label: 'Trim',
        materialOptions: [
          'brushed_aluminum', 'matte_black', 'powder_coat_white',
          'dark_chrome', 'neon_edge_acrylic',
        ],
      },
    ],
    defaultSkin: {
      trim: 'brushed_aluminum',
    },
    geometry: 'procedural',
    costEstimate: 150,
  },

  {
    id: 'light_wall_sconce',
    category: 'light',
    name: 'Wall Sconce',
    description: 'Wall-mounted light fixture for ambient or accent illumination.',
    styles: ALL_STYLES,
    anchorType: 'face',
    slotWidth: 1,
    dimensions: { w: 0.15, h: 0.3, d: 0.2 },
    skinSlots: [
      {
        id: 'fixture',
        label: 'Fixture',
        materialOptions: [
          'brushed_aluminum', 'matte_black', 'polished_brass',
          'blackened_brass', 'oxidized_copper', 'wrought_iron',
          'powder_coat_white',
        ],
      },
      {
        id: 'shade',
        label: 'Shade',
        materialOptions: [
          'rice_paper_washi', 'woven_rattan', 'frosted_glass',
          'smoked_glass', 'ballistic_nylon', 'leather',
        ],
      },
    ],
    defaultSkin: {
      fixture: 'matte_black',
      shade: 'frosted_glass',
    },
    geometry: 'procedural',
    costEstimate: 200,
  },

  {
    id: 'light_strip_led',
    category: 'light',
    name: 'LED Strip Light',
    description: 'Adhesive LED strip for under-cabinet, cove, or accent lighting.',
    styles: ['modern', 'cyberpunk', 'noir_glass'],
    anchorType: 'face',
    slotWidth: 1,
    dimensions: { w: 1.0, h: 0.02, d: 0.02 },
    skinSlots: [
      {
        id: 'housing',
        label: 'Housing',
        materialOptions: [
          'brushed_aluminum', 'matte_black', 'anodized_aluminum',
          'dark_chrome', 'carbon_fiber',
        ],
      },
    ],
    defaultSkin: {
      housing: 'brushed_aluminum',
    },
    geometry: 'procedural',
    costEstimate: 120,
  },

  {
    id: 'light_floor_lamp',
    category: 'light',
    name: 'Floor Lamp',
    description: 'Freestanding floor lamp for ambient or reading light.',
    styles: ALL_STYLES,
    anchorType: 'floor',
    slotWidth: 1,
    dimensions: { w: 0.3, h: 1.6, d: 0.3 },
    skinSlots: [
      {
        id: 'base',
        label: 'Base',
        materialOptions: [
          'brushed_aluminum', 'matte_black', 'polished_brass',
          'blackened_brass', 'raw_steel', 'marble_composite',
          'terrazzo',
        ],
      },
      {
        id: 'shade',
        label: 'Shade',
        materialOptions: [
          'rice_paper_washi', 'woven_rattan', 'frosted_glass',
          'ballistic_nylon', 'leather', 'palm_fiber',
        ],
      },
    ],
    defaultSkin: {
      base: 'brushed_aluminum',
      shade: 'rice_paper_washi',
    },
    geometry: 'procedural',
    costEstimate: 300,
  },

  {
    id: 'light_table_lamp',
    category: 'light',
    name: 'Table Lamp',
    description: 'Desktop or side-table lamp for task and accent lighting.',
    styles: ALL_STYLES,
    anchorType: 'floor',
    slotWidth: 1,
    dimensions: { w: 0.2, h: 0.5, d: 0.2 },
    skinSlots: [
      {
        id: 'base',
        label: 'Base',
        materialOptions: [
          'polished_brass', 'brushed_aluminum', 'matte_black',
          'marble_composite', 'terrazzo', 'ceramic_tile',
          'oxidized_copper',
        ],
      },
      {
        id: 'shade',
        label: 'Shade',
        materialOptions: [
          'rice_paper_washi', 'woven_rattan', 'ballistic_nylon',
          'leather', 'frosted_glass', 'palm_fiber',
        ],
      },
    ],
    defaultSkin: {
      base: 'polished_brass',
      shade: 'rice_paper_washi',
    },
    geometry: 'procedural',
    costEstimate: 200,
  },
];
