import type { ExtensionConfig, SurfaceType } from "@/types/container";

export interface WizardStep {
  action: 'extensions' | 'rooftop_deck' | 'vertical_stairs' | 'paint_outer_walls'
        | 'open_interior_walls' | 'set_all_floors' | 'set_all_ceilings' | 'add_door';
  config?: ExtensionConfig;
  wallMaterial?: SurfaceType;
  floorMaterial?: SurfaceType;
  ceilingMaterial?: SurfaceType;
  stairVoxelIndex?: number;
  stairFacing?: 'n' | 's' | 'e' | 'w';
  doorVoxelIndex?: number;
  doorFace?: 'n' | 's' | 'e' | 'w';
}

export interface WizardPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  steps: WizardStep[];
}

export const WIZARD_PRESETS: WizardPreset[] = [
  {
    id: 'glass_box',
    label: 'Glass Box',
    description: 'Floor-to-ceiling glass walls on all sides. Maximum light and views.',
    icon: '🔲',
    steps: [
      { action: 'extensions', config: 'all_glass_interior' },
    ],
  },
  {
    id: 'rooftop_deck',
    label: 'Rooftop Deck',
    description: 'Outdoor deck on top with cable railings. Great for entertaining.',
    icon: '🏗️',
    steps: [
      { action: 'rooftop_deck' },
    ],
  },
  {
    id: 'open_plan',
    label: 'Open Plan',
    description: 'Full floor space with steel walls. No interior divisions.',
    icon: '📐',
    steps: [
      { action: 'extensions', config: 'all_interior' },
    ],
  },
  {
    id: 'studio',
    label: 'Studio + Loft',
    description: 'Glass box with internal staircase to upper level.',
    icon: '🏠',
    steps: [
      { action: 'extensions', config: 'all_glass_interior' },
      { action: 'vertical_stairs', stairVoxelIndex: 9, stairFacing: 's' },
    ],
  },
  {
    id: 'full_glass_home',
    label: 'Glass Home',
    description: 'Full extensions with glass walls, wood floors, open interior — maximum space.',
    icon: '🏡',
    steps: [
      { action: 'extensions', config: 'all_interior' },
      { action: 'open_interior_walls' },
      { action: 'paint_outer_walls', wallMaterial: 'Window_Standard' },
      { action: 'set_all_floors', floorMaterial: 'Deck_Wood' },
      { action: 'add_door', doorVoxelIndex: 27, doorFace: 's' },
    ],
  },
  {
    id: 'roof_deck_combo',
    label: 'Home + Roof Deck',
    description: 'Glass ground floor with stacked rooftop deck, stairs, and railings.',
    icon: '🌇',
    steps: [
      { action: 'extensions', config: 'all_interior' },
      { action: 'open_interior_walls' },
      { action: 'paint_outer_walls', wallMaterial: 'Window_Standard' },
      { action: 'set_all_floors', floorMaterial: 'Deck_Wood' },
      { action: 'add_door', doorVoxelIndex: 27, doorFace: 's' },
      { action: 'rooftop_deck' },
      { action: 'vertical_stairs', stairVoxelIndex: 14, stairFacing: 's' },
    ],
  },
  {
    id: 'steel_fortress',
    label: 'Steel Fortress',
    description: 'Full steel enclosure with no extensions. Industrial bunker style.',
    icon: '🏭',
    steps: [
      { action: 'paint_outer_walls', wallMaterial: 'Solid_Steel' },
      { action: 'open_interior_walls' },
      { action: 'set_all_floors', floorMaterial: 'Concrete' },
    ],
  },
];
