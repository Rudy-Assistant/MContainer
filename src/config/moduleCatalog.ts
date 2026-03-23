/**
 * Module Preset Catalog
 *
 * Single-voxel room modules — each stamps 6 faces + optional furniture.
 * Orientation resolves abstract faces (inward/outward/left/right) to cardinal directions.
 */
import type { ModulePreset, ModuleOrientation, VoxelFaces, SurfaceType } from '@/types/container';
import { FurnitureType } from '@/types/container';

// ── Orientation Resolution ────────────────────────────────────
// orientation='n': inward=n, outward=s, left=w, right=e
// orientation='e': inward=e, outward=w, left=n, right=s
// orientation='s': inward=s, outward=n, left=e, right=w
// orientation='w': inward=w, outward=e, left=s, right=n

const ORIENT_MAP: Record<ModuleOrientation, { inward: keyof VoxelFaces; outward: keyof VoxelFaces; left: keyof VoxelFaces; right: keyof VoxelFaces }> = {
  n: { inward: 'n', outward: 's', left: 'w', right: 'e' },
  e: { inward: 'e', outward: 'w', left: 'n', right: 's' },
  s: { inward: 's', outward: 'n', left: 'e', right: 'w' },
  w: { inward: 'w', outward: 'e', left: 's', right: 'n' },
};

/** Resolve a module preset's abstract faces to concrete VoxelFaces given an orientation. */
export function resolveModuleFaces(preset: ModulePreset, orientation: ModuleOrientation): VoxelFaces {
  const map = ORIENT_MAP[orientation];
  const faces: VoxelFaces = {
    top: preset.faces.ceiling,
    bottom: preset.faces.floor,
    n: 'Open',
    s: 'Open',
    e: 'Open',
    w: 'Open',
  };
  faces[map.inward] = preset.faces.inward;
  faces[map.outward] = preset.faces.outward;
  faces[map.left] = preset.faces.left;
  faces[map.right] = preset.faces.right;
  return faces;
}

/** Rotation in radians for each module orientation (Y-axis rotation for furniture). */
export const ORIENT_ROTATION: Record<ModuleOrientation, number> = {
  n: 0,
  e: Math.PI / 2,
  s: Math.PI,
  w: (3 * Math.PI) / 2,
};

// ── Module Presets ─────────────────────────────────────────────

export const MODULE_PRESETS: ModulePreset[] = [
  {
    id: 'kitchen_full',
    label: 'Kitchen',
    category: 'kitchen',
    icon: '🍳',
    faces: { inward: 'Open', outward: 'Solid_Steel', left: 'Glass_Pane', right: 'Solid_Steel', floor: 'Deck_Wood', ceiling: 'Solid_Steel' },
    furnitureType: FurnitureType.Kitchen,
    description: 'Full kitchen with window',
  },
  {
    id: 'kitchen_pantry',
    label: 'Pantry',
    category: 'kitchen',
    icon: '🥫',
    faces: { inward: 'Solid_Steel', outward: 'Solid_Steel', left: 'Solid_Steel', right: 'Solid_Steel', floor: 'Deck_Wood', ceiling: 'Solid_Steel' },
    furnitureType: FurnitureType.Storage,
    description: 'Enclosed pantry storage',
  },
  {
    id: 'bathroom_full',
    label: 'Bathroom',
    category: 'bathroom',
    icon: '🚿',
    faces: { inward: 'Glass_Pane', outward: 'Solid_Steel', left: 'Solid_Steel', right: 'Solid_Steel', floor: 'Concrete', ceiling: 'Solid_Steel' },
    furnitureType: FurnitureType.Bathroom,
    description: 'Full bathroom with glass shower wall',
  },
  {
    id: 'bathroom_half',
    label: 'Half Bath',
    category: 'bathroom',
    icon: '🚽',
    faces: { inward: 'Solid_Steel', outward: 'Solid_Steel', left: 'Solid_Steel', right: 'Solid_Steel', floor: 'Concrete', ceiling: 'Solid_Steel' },
    furnitureType: FurnitureType.Bathroom,
    description: 'Compact half bathroom',
  },
  {
    id: 'living_room',
    label: 'Living Room',
    category: 'living',
    icon: '🛋️',
    faces: { inward: 'Glass_Pane', outward: 'Solid_Steel', left: 'Open', right: 'Open', floor: 'Deck_Wood', ceiling: 'Solid_Steel' },
    furnitureType: FurnitureType.Sofa,
    description: 'Living space with large window',
  },
  {
    id: 'bedroom',
    label: 'Bedroom',
    category: 'living',
    icon: '🛏️',
    faces: { inward: 'Open', outward: 'Solid_Steel', left: 'Solid_Steel', right: 'Solid_Steel', floor: 'Deck_Wood', ceiling: 'Solid_Steel' },
    furnitureType: FurnitureType.Bed,
    description: 'Private bedroom',
  },
  {
    id: 'office',
    label: 'Office',
    category: 'living',
    icon: '💻',
    faces: { inward: 'Glass_Pane', outward: 'Solid_Steel', left: 'Solid_Steel', right: 'Open', floor: 'Deck_Wood', ceiling: 'Solid_Steel' },
    furnitureType: FurnitureType.Desk,
    description: 'Home office with window',
  },
  {
    id: 'deck_open',
    label: 'Open Deck',
    category: 'outdoor',
    icon: '☀️',
    faces: { inward: 'Railing_Cable', outward: 'Railing_Cable', left: 'Railing_Cable', right: 'Railing_Cable', floor: 'Deck_Wood', ceiling: 'Open' },
    description: 'Open-air deck with cable railings',
  },
  {
    id: 'balcony',
    label: 'Balcony',
    category: 'outdoor',
    icon: '🌅',
    faces: { inward: 'Open', outward: 'Railing_Cable', left: 'Railing_Cable', right: 'Railing_Cable', floor: 'Deck_Wood', ceiling: 'Open' },
    description: 'Balcony open toward interior',
  },
  {
    id: 'storage',
    label: 'Storage',
    category: 'utility',
    icon: '📦',
    faces: { inward: 'Solid_Steel', outward: 'Solid_Steel', left: 'Solid_Steel', right: 'Solid_Steel', floor: 'Concrete', ceiling: 'Solid_Steel' },
    furnitureType: FurnitureType.Storage,
    description: 'Enclosed storage room',
  },
  {
    id: 'laundry',
    label: 'Laundry',
    category: 'utility',
    icon: '🧺',
    faces: { inward: 'Open', outward: 'Solid_Steel', left: 'Solid_Steel', right: 'Solid_Steel', floor: 'Concrete', ceiling: 'Solid_Steel' },
    description: 'Laundry room',
  },
  {
    id: 'mechanical',
    label: 'Mechanical',
    category: 'utility',
    icon: '⚙️',
    faces: { inward: 'Solid_Steel', outward: 'Solid_Steel', left: 'Solid_Steel', right: 'Solid_Steel', floor: 'Solid_Steel', ceiling: 'Solid_Steel' },
    description: 'Mechanical/HVAC room',
  },
  {
    id: 'stairs',
    label: 'Stairs',
    category: 'utility',
    icon: '🪜',
    faces: { inward: 'Open', outward: 'Open', left: 'Solid_Steel', right: 'Solid_Steel', floor: 'Deck_Wood', ceiling: 'Open' },
    description: 'Staircase — delegates to applyStairsFromFace',
  },
  {
    id: 'entry_door',
    label: 'Entry Door',
    category: 'utility',
    icon: '🚪',
    faces: { inward: 'Open', outward: 'Door', left: 'Solid_Steel', right: 'Solid_Steel', floor: 'Deck_Wood', ceiling: 'Solid_Steel' },
    description: 'Entry door — places Door on outward face with smart config',
  },
];

/** Look up a module preset by ID. */
export function getModulePreset(id: string): ModulePreset | undefined {
  return MODULE_PRESETS.find((p) => p.id === id);
}
