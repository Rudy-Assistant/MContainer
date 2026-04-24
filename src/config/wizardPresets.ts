import type { ExtensionConfig, SurfaceType } from "@/types/container";
import type { DesignIntentSpec } from "@/config/designIntents";

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
  designIntent?: DesignIntentSpec;
}

export const WIZARD_PRESETS: WizardPreset[] = [
  {
    id: 'glass_box',
    label: 'Glass Box',
    description: 'Floor-to-ceiling glass walls on all sides. Maximum light and views.',
    icon: '🔲',
    designIntent: {
      kind: 'single_container',
      arrangementId: 'largest_glass',
      expectedOutcome: 'enclosed',
    },
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
    designIntent: {
      kind: 'single_container',
      arrangementId: 'max_closed',
      expectedOutcome: 'enclosed',
    },
    steps: [
      { action: 'extensions', config: 'all_interior' },
    ],
  },
  {
    id: 'atrium_home',
    label: 'Atrium Home',
    description: 'Double-height central atrium with guarded upper opening and enclosed shell.',
    icon: '🕳️',
    designIntent: {
      kind: 'single_container',
      arrangementId: 'central_atrium',
      expectedOutcome: 'enclosed',
    },
    steps: [
      { action: 'extensions', config: 'all_interior' },
    ],
  },
  {
    id: 'glass_atrium_home',
    label: 'Glass Atrium',
    description: 'Glass perimeter with a double-height central light well and guarded upper opening.',
    icon: '🪟',
    designIntent: {
      kind: 'single_container',
      arrangementId: 'glass_atrium',
      expectedOutcome: 'enclosed',
    },
    steps: [
      { action: 'extensions', config: 'all_glass_interior' },
    ],
  },
  {
    id: 'roof_terrace_home',
    label: 'Roof Terrace',
    description: 'Enclosed lower shell with an upper terrace ring for outdoor circulation.',
    icon: '🌤️',
    designIntent: {
      kind: 'single_container',
      arrangementId: 'roof_terrace',
      expectedOutcome: 'enclosed',
    },
    steps: [
      { action: 'extensions', config: 'all_interior' },
    ],
  },
  {
    id: 'glass_terrace_home',
    label: 'Glass Terrace',
    description: 'Glass pavilion below with an upper terrace ring and guarded outdoor edges.',
    icon: '🌇',
    designIntent: {
      kind: 'single_container',
      arrangementId: 'glass_terrace',
      expectedOutcome: 'enclosed',
    },
    steps: [
      { action: 'extensions', config: 'all_glass_interior' },
    ],
  },
  {
    id: 'studio',
    label: 'Studio + Loft',
    description: 'Glass box with internal staircase to upper level.',
    icon: '🏠',
    designIntent: {
      kind: 'single_container',
      arrangementId: 'largest_glass',
      expectedOutcome: 'enclosed',
      stairs: { voxelIndex: 9, facing: 's' },
    },
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
    designIntent: {
      kind: 'single_container',
      arrangementId: 'largest_glass',
      expectedOutcome: 'enclosed',
      door: { voxelIndex: 27, face: 's' },
    },
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
    designIntent: {
      kind: 'single_container',
      arrangementId: 'largest_glass',
      expectedOutcome: 'enclosed',
      door: { voxelIndex: 27, face: 's' },
      rooftopDeck: true,
      stairs: { voxelIndex: 14, facing: 's' },
    },
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
