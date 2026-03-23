// src/config/styleRegistry.ts
// Static catalog of 17 architectural styles with QuickSkin presets.
// Every material ID in defaultMaterials and QuickSkinPreset.slots MUST exist
// in materialRegistry.

import type { StyleDefinition, QuickSkinPreset, StyleId } from '@/types/sceneObject';

// ── Style Definitions ─────────────────────────────────────────────────────────

const STYLES: StyleDefinition[] = [
  // 1. Modern Minimal
  {
    id: 'modern',
    label: 'Modern Minimal',
    description: 'Clean lines, neutral palette, and restrained details for a quietly confident look.',
    defaultMaterials: {
      frame: 'brushed_aluminum',
      glass: 'clear_glass',
      panel: 'white_laminate',
      handle: 'polished_chrome',
      plate: 'brushed_aluminum',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [],
  },

  // 2. Industrial Raw
  {
    id: 'industrial',
    label: 'Industrial Raw',
    description: 'Exposed steel and aged metal surfaces celebrating honest construction.',
    defaultMaterials: {
      frame: 'raw_steel',
      glass: 'smoked_glass',
      panel: 'raw_concrete',
      handle: 'wrought_iron',
      plate: 'diamond_plate',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'patina_tint', color: '#4a8c7a', intensity: 0.4 }],
  },

  // 3. Japanese Wabi
  {
    id: 'japanese',
    label: 'Japanese Wabi',
    description: 'Wabi-sabi philosophy rendered in natural timber, paper, and humble imperfection.',
    defaultMaterials: {
      frame: 'hinoki_cypress',
      glass: 'frosted_glass',
      panel: 'rice_paper_washi',
      handle: 'blackened_brass',
      plate: 'bamboo_composite',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'paper_glow', color: '#f0e8d4', intensity: 0.3 }],
  },

  // 4. Desert Brutalist
  {
    id: 'desert_brutalist',
    label: 'Desert Brutalist',
    description: 'Massive sun-baked concrete and earthen pigment for arid landscape architecture.',
    defaultMaterials: {
      frame: 'raw_concrete',
      glass: 'bronze_tint',
      panel: 'sun_baked_clay',
      handle: 'cerakote_dark_earth',
      plate: 'sand_blasted_steel',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'heat_shimmer', color: '#c8882a', intensity: 0.5 }],
  },

  // 5. Coastal Drift
  {
    id: 'coastal',
    label: 'Coastal Drift',
    description: 'Bleached timbers and sea-glass tones weathered by salt air and ocean light.',
    defaultMaterials: {
      frame: 'bleached_wood',
      glass: 'sea_glass',
      panel: 'light_oak',
      handle: 'anodized_aluminum',
      plate: 'sand_blasted_steel',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'salt_frost', color: '#c8dde8', intensity: 0.35 }],
  },

  // 6. Noir Glass
  {
    id: 'noir_glass',
    label: 'Noir Glass',
    description: 'Dark chrome and deep smoked glass with a cinematic, high-contrast character.',
    defaultMaterials: {
      frame: 'dark_chrome',
      glass: 'smoked_glass',
      panel: 'black_lacquer',
      handle: 'polished_chrome',
      plate: 'carbon_fiber',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'reflection_tint', color: '#1a1c20', intensity: 0.6 }],
  },

  // 7. Solarpunk
  {
    id: 'solarpunk',
    label: 'Solarpunk',
    description: 'Verdant greens and living surfaces blending architecture with ecological optimism.',
    defaultMaterials: {
      frame: 'powder_coat_sage',
      glass: 'frosted_polycarbonate',
      panel: 'bamboo_composite',
      handle: 'oxidized_copper',
      plate: 'cork',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'moss_glow', color: '#4a8c50', intensity: 0.45 }],
  },

  // 8. Frontier Rustic
  {
    id: 'frontier_rustic',
    label: 'Frontier Rustic',
    description: 'Reclaimed timber and worked iron evoking frontier craftsmanship and warmth.',
    defaultMaterials: {
      frame: 'reclaimed_barn',
      glass: 'fluted_glass',
      panel: 'mesquite_wood',
      handle: 'wrought_iron',
      plate: 'cerakote_dark_earth',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'ember_warmth', color: '#c86428', intensity: 0.4 }],
  },

  // 9. Retro Capsule
  {
    id: 'retro_capsule',
    label: 'Retro Capsule',
    description: 'Space-age optimism in powder-coated curves and frosted acrylic panels.',
    defaultMaterials: {
      frame: 'powder_coat_white',
      glass: 'frosted_polycarbonate',
      panel: 'pla_white',
      handle: 'polished_chrome',
      plate: 'brushed_aluminum',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'soft_bloom', color: '#f0f4ff', intensity: 0.3 }],
  },

  // 10. Neo-Tropical
  {
    id: 'neo_tropical',
    label: 'Neo-Tropical',
    description: 'Open lattices and palm fiber weaves filtering dappled equatorial light.',
    defaultMaterials: {
      frame: 'dark_teak',
      glass: 'clear_glass',
      panel: 'woven_rattan',
      handle: 'oxidized_copper',
      plate: 'palm_fiber',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'dappled_light', color: '#a8d478', intensity: 0.4 }],
  },

  // 11. Cyberpunk Edge
  {
    id: 'cyberpunk',
    label: 'Cyberpunk Edge',
    description: 'Neon-lit acrylic trim and carbon-fiber surfaces pulsing with electric intensity.',
    defaultMaterials: {
      frame: 'carbon_fiber',
      glass: 'neon_edge_acrylic',
      panel: 'pla_black',
      handle: 'dark_chrome',
      plate: 'matte_black',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'edge_glow', color: '#00e5ff', intensity: 0.7 }],
  },

  // 12. Maker Raw
  {
    id: 'maker_raw',
    label: 'Maker Raw',
    description: 'FDM layer lines and laser-cut plywood celebrate the handmade prototype aesthetic.',
    defaultMaterials: {
      frame: 'laser_cut_plywood',
      glass: 'frosted_polycarbonate',
      panel: 'pla_grey',
      handle: 'anodized_aluminum',
      plate: 'diamond_plate',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'layer_lines', color: '#c0b8a8', intensity: 0.25 }],
  },

  // 13. Art Deco Revival
  {
    id: 'art_deco',
    label: 'Art Deco Revival',
    description: 'Polished brass accents, terrazzo floors, and sunburst geometry in golden glory.',
    defaultMaterials: {
      frame: 'polished_brass',
      glass: 'fluted_glass',
      panel: 'marble_composite',
      handle: 'polished_brass',
      plate: 'terrazzo',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'gold_gleam', color: '#c9a84c', intensity: 0.55 }],
  },

  // 14. Arctic Bunker
  {
    id: 'arctic_bunker',
    label: 'Arctic Bunker',
    description: 'Gunmetal plates and frosted glass enduring the harshest polar environments.',
    defaultMaterials: {
      frame: 'gunmetal',
      glass: 'frosted_glass',
      panel: 'concrete_grey',
      handle: 'titanium_grey',
      plate: 'sand_blasted_steel',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'frost_rim', color: '#c8dde8', intensity: 0.5 }],
  },

  // 15. Terra Adobe
  {
    id: 'terra_adobe',
    label: 'Terra Adobe',
    description: 'Hand-troweled terracotta and clay warmth rooted in vernacular earth architecture.',
    defaultMaterials: {
      frame: 'sun_baked_clay',
      glass: 'bronze_tint',
      panel: 'terracotta',
      handle: 'cerakote_dark_earth',
      plate: 'cork',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'clay_warmth', color: '#c26f44', intensity: 0.45 }],
  },

  // 16. Memphis Pop
  {
    id: 'memphis_pop',
    label: 'Memphis Pop',
    description: 'Bold powder-coat primaries and playful geometry channeling 1980s design exuberance.',
    defaultMaterials: {
      frame: 'powder_coat_coral',
      glass: 'neon_edge_acrylic',
      panel: 'powder_coat_mustard',
      handle: 'powder_coat_sky',
      plate: 'powder_coat_blush',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'color_punch', color: '#e06050', intensity: 0.6 }],
  },

  // 17. Stealth Military
  {
    id: 'stealth',
    label: 'Stealth Military',
    description: 'Matte OD green and ballistic-grade surfaces engineered to absorb attention.',
    defaultMaterials: {
      frame: 'matte_od_green',
      glass: 'smoked_glass',
      panel: 'ballistic_nylon',
      handle: 'matte_black',
      plate: 'cerakote_dark_earth',
    },
    defaultWallSurface: 'Solid_Steel',
    effects: [{ type: 'matte_absorb', color: '#1c1c1e', intensity: 0.5 }],
  },
];

// ── Quick Skin Presets (5 per style = 85 total) ───────────────────────────────

const QUICK_SKIN_PRESETS: QuickSkinPreset[] = [
  // ── modern ──────────────────────────────────────────────────────────────────
  {
    id: 'modern_bright',
    styleId: 'modern',
    label: 'Bright Modern',
    slots: { frame: 'powder_coat_white', glass: 'clear_glass', panel: 'white_laminate', handle: 'polished_chrome' },
  },
  {
    id: 'modern_warm',
    styleId: 'modern',
    label: 'Warm Modern',
    slots: { frame: 'light_oak', glass: 'frosted_glass', panel: 'white_laminate', handle: 'brushed_aluminum' },
  },
  {
    id: 'modern_slate',
    styleId: 'modern',
    label: 'Slate Modern',
    slots: { frame: 'anodized_aluminum', glass: 'smoked_glass', panel: 'concrete_grey', handle: 'titanium_grey' },
  },
  {
    id: 'modern_nordic',
    styleId: 'modern',
    label: 'Nordic Modern',
    slots: { frame: 'bleached_wood', glass: 'frosted_polycarbonate', panel: 'pla_white', handle: 'brushed_aluminum' },
  },
  {
    id: 'modern_charcoal',
    styleId: 'modern',
    label: 'Charcoal Modern',
    slots: { frame: 'gunmetal', glass: 'clear_glass', panel: 'pla_grey', handle: 'dark_chrome' },
  },

  // ── industrial ───────────────────────────────────────────────────────────────
  {
    id: 'industrial_dark',
    styleId: 'industrial',
    label: 'Dark Industrial',
    slots: { frame: 'matte_black', glass: 'smoked_glass', panel: 'raw_steel', handle: 'wrought_iron' },
  },
  {
    id: 'industrial_oxide',
    styleId: 'industrial',
    label: 'Oxide Industrial',
    slots: { frame: 'oxidized_copper', glass: 'bronze_tint', panel: 'raw_concrete', handle: 'blackened_brass' },
  },
  {
    id: 'industrial_diamond',
    styleId: 'industrial',
    label: 'Diamond Industrial',
    slots: { frame: 'diamond_plate', glass: 'frosted_glass', panel: 'raw_steel', handle: 'gunmetal', plate: 'diamond_plate' },
  },
  {
    id: 'industrial_sand',
    styleId: 'industrial',
    label: 'Sand Industrial',
    slots: { frame: 'sand_blasted_steel', glass: 'smoked_glass', panel: 'concrete_grey', handle: 'titanium_grey' },
  },
  {
    id: 'industrial_carbon',
    styleId: 'industrial',
    label: 'Carbon Industrial',
    slots: { frame: 'carbon_fiber', glass: 'smoked_glass', panel: 'matte_black', handle: 'dark_chrome' },
  },

  // ── japanese ─────────────────────────────────────────────────────────────────
  {
    id: 'japanese_cedar',
    styleId: 'japanese',
    label: 'Cedar Wabi',
    slots: { frame: 'light_oak', glass: 'frosted_glass', panel: 'rice_paper_washi', handle: 'blackened_brass' },
  },
  {
    id: 'japanese_bamboo',
    styleId: 'japanese',
    label: 'Bamboo Wabi',
    slots: { frame: 'bamboo_composite', glass: 'frosted_polycarbonate', panel: 'woven_rattan', handle: 'blackened_brass' },
  },
  {
    id: 'japanese_walnut',
    styleId: 'japanese',
    label: 'Dark Wabi',
    slots: { frame: 'walnut', glass: 'smoked_glass', panel: 'rice_paper_washi', handle: 'wrought_iron' },
  },
  {
    id: 'japanese_bleached',
    styleId: 'japanese',
    label: 'Bleached Wabi',
    slots: { frame: 'bleached_wood', glass: 'frosted_glass', panel: 'rice_paper_washi', handle: 'anodized_aluminum' },
  },
  {
    id: 'japanese_zen',
    styleId: 'japanese',
    label: 'Zen Minimal',
    slots: { frame: 'hinoki_cypress', glass: 'frosted_polycarbonate', panel: 'cork', handle: 'blackened_brass' },
  },

  // ── desert_brutalist ─────────────────────────────────────────────────────────
  {
    id: 'desert_ochre',
    styleId: 'desert_brutalist',
    label: 'Ochre Brutalist',
    slots: { frame: 'sun_baked_clay', glass: 'bronze_tint', panel: 'terracotta', handle: 'cerakote_dark_earth' },
  },
  {
    id: 'desert_chalk',
    styleId: 'desert_brutalist',
    label: 'Chalk Brutalist',
    slots: { frame: 'marble_composite', glass: 'frosted_glass', panel: 'raw_concrete', handle: 'sand_blasted_steel' },
  },
  {
    id: 'desert_iron',
    styleId: 'desert_brutalist',
    label: 'Iron Brutalist',
    slots: { frame: 'wrought_iron', glass: 'smoked_glass', panel: 'concrete_grey', handle: 'matte_black' },
  },
  {
    id: 'desert_clay',
    styleId: 'desert_brutalist',
    label: 'Clay Brutalist',
    slots: { frame: 'raw_concrete', glass: 'bronze_tint', panel: 'sun_baked_clay', handle: 'cerakote_dark_earth' },
  },
  {
    id: 'desert_dusk',
    styleId: 'desert_brutalist',
    label: 'Dusk Brutalist',
    slots: { frame: 'gunmetal', glass: 'smoked_glass', panel: 'sand_blasted_steel', handle: 'wrought_iron' },
  },

  // ── coastal ───────────────────────────────────────────────────────────────────
  {
    id: 'coastal_drift',
    styleId: 'coastal',
    label: 'Drift White',
    slots: { frame: 'powder_coat_white', glass: 'sea_glass', panel: 'bleached_wood', handle: 'anodized_aluminum' },
  },
  {
    id: 'coastal_tide',
    styleId: 'coastal',
    label: 'Tide Blue',
    slots: { frame: 'powder_coat_sky', glass: 'sea_glass', panel: 'light_oak', handle: 'brushed_aluminum' },
  },
  {
    id: 'coastal_driftwood',
    styleId: 'coastal',
    label: 'Driftwood',
    slots: { frame: 'reclaimed_barn', glass: 'frosted_glass', panel: 'bleached_wood', handle: 'sand_blasted_steel' },
  },
  {
    id: 'coastal_coral',
    styleId: 'coastal',
    label: 'Coral Reef',
    slots: { frame: 'powder_coat_coral', glass: 'sea_glass', panel: 'cork', handle: 'anodized_aluminum' },
  },
  {
    id: 'coastal_sage',
    styleId: 'coastal',
    label: 'Sea Sage',
    slots: { frame: 'powder_coat_sage', glass: 'sea_glass', panel: 'bamboo_composite', handle: 'brushed_aluminum' },
  },

  // ── noir_glass ────────────────────────────────────────────────────────────────
  {
    id: 'noir_obsidian',
    styleId: 'noir_glass',
    label: 'Obsidian',
    slots: { frame: 'matte_black', glass: 'smoked_glass', panel: 'black_lacquer', handle: 'dark_chrome' },
  },
  {
    id: 'noir_gunmetal',
    styleId: 'noir_glass',
    label: 'Gunmetal Noir',
    slots: { frame: 'gunmetal', glass: 'smoked_glass', panel: 'carbon_fiber', handle: 'polished_chrome' },
  },
  {
    id: 'noir_smoke',
    styleId: 'noir_glass',
    label: 'Smoke & Mirror',
    slots: { frame: 'dark_chrome', glass: 'smoked_glass', panel: 'matte_black', handle: 'polished_chrome' },
  },
  {
    id: 'noir_onyx',
    styleId: 'noir_glass',
    label: 'Onyx',
    slots: { frame: 'carbon_fiber', glass: 'smoked_glass', panel: 'pla_black', handle: 'dark_chrome' },
  },
  {
    id: 'noir_steel',
    styleId: 'noir_glass',
    label: 'Cold Steel',
    slots: { frame: 'brushed_aluminum', glass: 'smoked_glass', panel: 'raw_steel', handle: 'titanium_grey' },
  },

  // ── solarpunk ─────────────────────────────────────────────────────────────────
  {
    id: 'solarpunk_grove',
    styleId: 'solarpunk',
    label: 'Grove',
    slots: { frame: 'bamboo_composite', glass: 'frosted_polycarbonate', panel: 'powder_coat_sage', handle: 'oxidized_copper' },
  },
  {
    id: 'solarpunk_fern',
    styleId: 'solarpunk',
    label: 'Fern',
    slots: { frame: 'powder_coat_sage', glass: 'sea_glass', panel: 'light_oak', handle: 'oxidized_copper' },
  },
  {
    id: 'solarpunk_copper',
    styleId: 'solarpunk',
    label: 'Copper Vine',
    slots: { frame: 'oxidized_copper', glass: 'frosted_polycarbonate', panel: 'bamboo_composite', handle: 'blackened_brass' },
  },
  {
    id: 'solarpunk_sky',
    styleId: 'solarpunk',
    label: 'Sky Garden',
    slots: { frame: 'powder_coat_sky', glass: 'frosted_glass', panel: 'cork', handle: 'anodized_aluminum' },
  },
  {
    id: 'solarpunk_earth',
    styleId: 'solarpunk',
    label: 'Earth Living',
    slots: { frame: 'reclaimed_barn', glass: 'frosted_polycarbonate', panel: 'cork', handle: 'oxidized_copper' },
  },

  // ── frontier_rustic ───────────────────────────────────────────────────────────
  {
    id: 'frontier_barn',
    styleId: 'frontier_rustic',
    label: 'Red Barn',
    slots: { frame: 'reclaimed_barn', glass: 'fluted_glass', panel: 'warm_oak', handle: 'wrought_iron' },
  },
  {
    id: 'frontier_dark',
    styleId: 'frontier_rustic',
    label: 'Dark Frontier',
    slots: { frame: 'dark_teak', glass: 'smoked_glass', panel: 'mesquite_wood', handle: 'wrought_iron' },
  },
  {
    id: 'frontier_hearth',
    styleId: 'frontier_rustic',
    label: 'Hearth',
    slots: { frame: 'mesquite_wood', glass: 'bronze_tint', panel: 'reclaimed_barn', handle: 'blackened_brass' },
  },
  {
    id: 'frontier_walnut',
    styleId: 'frontier_rustic',
    label: 'Walnut Ranch',
    slots: { frame: 'walnut', glass: 'fluted_glass', panel: 'warm_oak', handle: 'cerakote_dark_earth' },
  },
  {
    id: 'frontier_iron',
    styleId: 'frontier_rustic',
    label: 'Iron & Oak',
    slots: { frame: 'wrought_iron', glass: 'frosted_glass', panel: 'reclaimed_barn', handle: 'blackened_brass' },
  },

  // ── retro_capsule ─────────────────────────────────────────────────────────────
  {
    id: 'retro_lunar',
    styleId: 'retro_capsule',
    label: 'Lunar White',
    slots: { frame: 'powder_coat_white', glass: 'frosted_polycarbonate', panel: 'pla_white', handle: 'polished_chrome' },
  },
  {
    id: 'retro_sky',
    styleId: 'retro_capsule',
    label: 'Sky Capsule',
    slots: { frame: 'powder_coat_sky', glass: 'frosted_polycarbonate', panel: 'pla_white', handle: 'brushed_aluminum' },
  },
  {
    id: 'retro_blush',
    styleId: 'retro_capsule',
    label: 'Blush Capsule',
    slots: { frame: 'powder_coat_blush', glass: 'frosted_polycarbonate', panel: 'pla_white', handle: 'polished_chrome' },
  },
  {
    id: 'retro_mustard',
    styleId: 'retro_capsule',
    label: 'Mustard Capsule',
    slots: { frame: 'powder_coat_mustard', glass: 'frosted_polycarbonate', panel: 'pla_white', handle: 'brushed_aluminum' },
  },
  {
    id: 'retro_grey',
    styleId: 'retro_capsule',
    label: 'Grey Capsule',
    slots: { frame: 'pla_grey', glass: 'frosted_polycarbonate', panel: 'pla_white', handle: 'anodized_aluminum' },
  },

  // ── neo_tropical ──────────────────────────────────────────────────────────────
  {
    id: 'neo_trop_teak',
    styleId: 'neo_tropical',
    label: 'Teak Canopy',
    slots: { frame: 'dark_teak', glass: 'clear_glass', panel: 'woven_rattan', handle: 'oxidized_copper' },
  },
  {
    id: 'neo_trop_palm',
    styleId: 'neo_tropical',
    label: 'Palm Weave',
    slots: { frame: 'bamboo_composite', glass: 'sea_glass', panel: 'palm_fiber', handle: 'blackened_brass' },
  },
  {
    id: 'neo_trop_rattan',
    styleId: 'neo_tropical',
    label: 'Rattan Light',
    slots: { frame: 'warm_oak', glass: 'frosted_polycarbonate', panel: 'woven_rattan', handle: 'anodized_aluminum' },
  },
  {
    id: 'neo_trop_copper',
    styleId: 'neo_tropical',
    label: 'Copper Canopy',
    slots: { frame: 'oxidized_copper', glass: 'sea_glass', panel: 'bamboo_composite', handle: 'blackened_brass' },
  },
  {
    id: 'neo_trop_sage',
    styleId: 'neo_tropical',
    label: 'Sage Tropics',
    slots: { frame: 'powder_coat_sage', glass: 'clear_glass', panel: 'woven_rattan', handle: 'anodized_aluminum' },
  },

  // ── cyberpunk ─────────────────────────────────────────────────────────────────
  {
    id: 'cyber_neon',
    styleId: 'cyberpunk',
    label: 'Neon Pulse',
    slots: { frame: 'carbon_fiber', glass: 'neon_edge_acrylic', panel: 'matte_black', handle: 'dark_chrome' },
  },
  {
    id: 'cyber_void',
    styleId: 'cyberpunk',
    label: 'Void Black',
    slots: { frame: 'matte_black', glass: 'smoked_glass', panel: 'carbon_fiber', handle: 'dark_chrome' },
  },
  {
    id: 'cyber_chrome',
    styleId: 'cyberpunk',
    label: 'Chrome Net',
    slots: { frame: 'polished_chrome', glass: 'neon_edge_acrylic', panel: 'pla_black', handle: 'dark_chrome' },
  },
  {
    id: 'cyber_dark_steel',
    styleId: 'cyberpunk',
    label: 'Dark Steel',
    slots: { frame: 'gunmetal', glass: 'smoked_glass', panel: 'matte_black', handle: 'dark_chrome' },
  },
  {
    id: 'cyber_acid',
    styleId: 'cyberpunk',
    label: 'Acid Rain',
    slots: { frame: 'anodized_aluminum', glass: 'neon_edge_acrylic', panel: 'carbon_fiber', handle: 'titanium_grey' },
  },

  // ── maker_raw ─────────────────────────────────────────────────────────────────
  {
    id: 'maker_plywood',
    styleId: 'maker_raw',
    label: 'Plywood Proto',
    slots: { frame: 'laser_cut_plywood', glass: 'frosted_polycarbonate', panel: 'pla_grey', handle: 'anodized_aluminum' },
  },
  {
    id: 'maker_pla',
    styleId: 'maker_raw',
    label: 'PLA White',
    slots: { frame: 'pla_white', glass: 'frosted_polycarbonate', panel: 'laser_cut_plywood', handle: 'brushed_aluminum' },
  },
  {
    id: 'maker_dark',
    styleId: 'maker_raw',
    label: 'Dark Maker',
    slots: { frame: 'pla_black', glass: 'smoked_glass', panel: 'carbon_fiber', handle: 'matte_black' },
  },
  {
    id: 'maker_metal',
    styleId: 'maker_raw',
    label: 'Metal Maker',
    slots: { frame: 'raw_steel', glass: 'frosted_polycarbonate', panel: 'diamond_plate', handle: 'gunmetal' },
  },
  {
    id: 'maker_bamboo',
    styleId: 'maker_raw',
    label: 'Bio Maker',
    slots: { frame: 'bamboo_composite', glass: 'frosted_polycarbonate', panel: 'laser_cut_plywood', handle: 'anodized_aluminum' },
  },

  // ── art_deco ──────────────────────────────────────────────────────────────────
  {
    id: 'deco_gold',
    styleId: 'art_deco',
    label: 'Gilded Deco',
    slots: { frame: 'polished_brass', glass: 'fluted_glass', panel: 'marble_composite', handle: 'polished_brass' },
  },
  {
    id: 'deco_ivory',
    styleId: 'art_deco',
    label: 'Ivory Deco',
    slots: { frame: 'powder_coat_white', glass: 'fluted_glass', panel: 'marble_composite', handle: 'polished_brass' },
  },
  {
    id: 'deco_noir',
    styleId: 'art_deco',
    label: 'Noir Deco',
    slots: { frame: 'blackened_brass', glass: 'smoked_glass', panel: 'black_lacquer', handle: 'polished_brass' },
  },
  {
    id: 'deco_terrazzo',
    styleId: 'art_deco',
    label: 'Terrazzo Deco',
    slots: { frame: 'polished_brass', glass: 'frosted_glass', panel: 'terrazzo', handle: 'polished_chrome' },
  },
  {
    id: 'deco_bronze',
    styleId: 'art_deco',
    label: 'Bronze Revival',
    slots: { frame: 'polished_brass', glass: 'bronze_tint', panel: 'marble_composite', handle: 'blackened_brass' },
  },

  // ── arctic_bunker ─────────────────────────────────────────────────────────────
  {
    id: 'arctic_ice',
    styleId: 'arctic_bunker',
    label: 'Ice Bunker',
    slots: { frame: 'titanium_grey', glass: 'frosted_glass', panel: 'concrete_grey', handle: 'brushed_aluminum' },
  },
  {
    id: 'arctic_steel',
    styleId: 'arctic_bunker',
    label: 'Cold Steel',
    slots: { frame: 'gunmetal', glass: 'smoked_glass', panel: 'raw_concrete', handle: 'titanium_grey' },
  },
  {
    id: 'arctic_white',
    styleId: 'arctic_bunker',
    label: 'Snow White',
    slots: { frame: 'powder_coat_white', glass: 'frosted_polycarbonate', panel: 'concrete_grey', handle: 'brushed_aluminum' },
  },
  {
    id: 'arctic_blast',
    styleId: 'arctic_bunker',
    label: 'Sand Blast',
    slots: { frame: 'sand_blasted_steel', glass: 'frosted_glass', panel: 'concrete_grey', handle: 'gunmetal' },
  },
  {
    id: 'arctic_chrome',
    styleId: 'arctic_bunker',
    label: 'Chrome Ice',
    slots: { frame: 'polished_chrome', glass: 'frosted_polycarbonate', panel: 'raw_concrete', handle: 'titanium_grey' },
  },

  // ── terra_adobe ───────────────────────────────────────────────────────────────
  {
    id: 'adobe_earth',
    styleId: 'terra_adobe',
    label: 'Earth Adobe',
    slots: { frame: 'sun_baked_clay', glass: 'bronze_tint', panel: 'terracotta', handle: 'cerakote_dark_earth' },
  },
  {
    id: 'adobe_rust',
    styleId: 'terra_adobe',
    label: 'Rust Adobe',
    slots: { frame: 'cerakote_dark_earth', glass: 'smoked_glass', panel: 'sun_baked_clay', handle: 'wrought_iron' },
  },
  {
    id: 'adobe_pale',
    styleId: 'terra_adobe',
    label: 'Pale Adobe',
    slots: { frame: 'marble_composite', glass: 'frosted_glass', panel: 'terracotta', handle: 'sand_blasted_steel' },
  },
  {
    id: 'adobe_cork',
    styleId: 'terra_adobe',
    label: 'Cork Adobe',
    slots: { frame: 'sun_baked_clay', glass: 'bronze_tint', panel: 'cork', handle: 'cerakote_dark_earth' },
  },
  {
    id: 'adobe_bronze',
    styleId: 'terra_adobe',
    label: 'Bronze Adobe',
    slots: { frame: 'blackened_brass', glass: 'bronze_tint', panel: 'terracotta', handle: 'wrought_iron' },
  },

  // ── memphis_pop ───────────────────────────────────────────────────────────────
  {
    id: 'memphis_coral',
    styleId: 'memphis_pop',
    label: 'Coral Pop',
    slots: { frame: 'powder_coat_coral', glass: 'neon_edge_acrylic', panel: 'powder_coat_mustard', handle: 'powder_coat_sky' },
  },
  {
    id: 'memphis_mustard',
    styleId: 'memphis_pop',
    label: 'Mustard Pop',
    slots: { frame: 'powder_coat_mustard', glass: 'frosted_polycarbonate', panel: 'powder_coat_coral', handle: 'powder_coat_blush' },
  },
  {
    id: 'memphis_sky',
    styleId: 'memphis_pop',
    label: 'Sky Pop',
    slots: { frame: 'powder_coat_sky', glass: 'neon_edge_acrylic', panel: 'powder_coat_white', handle: 'powder_coat_coral' },
  },
  {
    id: 'memphis_sage',
    styleId: 'memphis_pop',
    label: 'Sage Pop',
    slots: { frame: 'powder_coat_sage', glass: 'sea_glass', panel: 'powder_coat_mustard', handle: 'powder_coat_blush' },
  },
  {
    id: 'memphis_blush',
    styleId: 'memphis_pop',
    label: 'Blush Pop',
    slots: { frame: 'powder_coat_blush', glass: 'frosted_polycarbonate', panel: 'powder_coat_sky', handle: 'polished_chrome' },
  },

  // ── stealth ───────────────────────────────────────────────────────────────────
  {
    id: 'stealth_od',
    styleId: 'stealth',
    label: 'OD Field',
    slots: { frame: 'matte_od_green', glass: 'smoked_glass', panel: 'ballistic_nylon', handle: 'matte_black' },
  },
  {
    id: 'stealth_black',
    styleId: 'stealth',
    label: 'Blackout',
    slots: { frame: 'matte_black', glass: 'smoked_glass', panel: 'carbon_fiber', handle: 'dark_chrome' },
  },
  {
    id: 'stealth_earth',
    styleId: 'stealth',
    label: 'Dark Earth',
    slots: { frame: 'cerakote_dark_earth', glass: 'smoked_glass', panel: 'ballistic_nylon', handle: 'matte_black' },
  },
  {
    id: 'stealth_gunmetal',
    styleId: 'stealth',
    label: 'Urban Ops',
    slots: { frame: 'gunmetal', glass: 'smoked_glass', panel: 'matte_black', handle: 'dark_chrome' },
  },
  {
    id: 'stealth_titanium',
    styleId: 'stealth',
    label: 'Titanium Ops',
    slots: { frame: 'titanium_grey', glass: 'smoked_glass', panel: 'matte_od_green', handle: 'matte_black' },
  },
];

// ── Registry & Helpers ────────────────────────────────────────────────────────

export const styleRegistry: Map<string, StyleDefinition> = new Map(
  STYLES.map((s) => [s.id, s])
);

export function getStyle(id: StyleId): StyleDefinition | undefined {
  return styleRegistry.get(id);
}

export function getQuickSkins(styleId: StyleId): QuickSkinPreset[] {
  return QUICK_SKIN_PRESETS.filter((p) => p.styleId === styleId);
}
