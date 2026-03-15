/**
 * Container Presets — pre-configured container designs
 *
 * Each preset applies a coordinated set of room modules to specific voxels,
 * creating a complete container design in one click.
 *
 * Voxel indexing (40ft HC, level 0):
 *   Body voxels: rows 1-2, cols 1-6
 *   Row 1: indices 9, 10, 11, 12, 13, 14
 *   Row 2: indices 17, 18, 19, 20, 21, 22
 *   Extension row 0: indices 0-7 (inactive by default)
 *   Extension row 3: indices 24-31 (inactive by default)
 */
import { ContainerSize, type ModuleOrientation } from '@/types/container';

export interface ContainerPresetVoxel {
  voxelIndex: number;
  moduleId: string;
  orientation: ModuleOrientation;
}

export interface ContainerPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  containerSize: ContainerSize;
  voxels: ContainerPresetVoxel[];
  tags?: string[];
}

// ── Residential Presets ──────────────────────────────────────

const studioApartment: ContainerPreset = {
  id: 'studio_apartment',
  label: 'Studio Apartment',
  description: 'Open-plan studio with kitchen, bath, and living area',
  icon: '🏠',
  containerSize: ContainerSize.HighCube40,
  tags: ['residential', 'compact'],
  voxels: [
    // Row 1 (indices 9-14): Kitchen | Living | Living | Living | Bath | Storage
    { voxelIndex: 9,  moduleId: 'kitchen_full', orientation: 'e' },
    { voxelIndex: 10, moduleId: 'living_room',  orientation: 's' },
    { voxelIndex: 11, moduleId: 'living_room',  orientation: 's' },
    { voxelIndex: 12, moduleId: 'bedroom',      orientation: 'w' },
    { voxelIndex: 13, moduleId: 'bathroom_full', orientation: 'n' },
    { voxelIndex: 14, moduleId: 'storage',      orientation: 'n' },
    // Row 2 (indices 17-22): Kitchen | Living | Living | Bedroom | Bath | Laundry
    { voxelIndex: 17, moduleId: 'kitchen_pantry', orientation: 'e' },
    { voxelIndex: 18, moduleId: 'living_room',   orientation: 's' },
    { voxelIndex: 19, moduleId: 'living_room',   orientation: 's' },
    { voxelIndex: 20, moduleId: 'bedroom',       orientation: 'w' },
    { voxelIndex: 21, moduleId: 'bathroom_half', orientation: 'n' },
    { voxelIndex: 22, moduleId: 'laundry',       orientation: 'n' },
  ],
};

const oneBedroom: ContainerPreset = {
  id: 'one_bedroom',
  label: '1-Bedroom',
  description: 'Separated bedroom, living, kitchen, and bath',
  icon: '🛏️',
  containerSize: ContainerSize.HighCube40,
  tags: ['residential', '1br'],
  voxels: [
    // Row 1: Bedroom | Bedroom | Living | Living | Kitchen | Bath
    { voxelIndex: 9,  moduleId: 'bedroom',       orientation: 'e' },
    { voxelIndex: 10, moduleId: 'bedroom',       orientation: 'e' },
    { voxelIndex: 11, moduleId: 'living_room',   orientation: 's' },
    { voxelIndex: 12, moduleId: 'living_room',   orientation: 's' },
    { voxelIndex: 13, moduleId: 'kitchen_full',  orientation: 'w' },
    { voxelIndex: 14, moduleId: 'bathroom_full', orientation: 'n' },
    // Row 2: Bedroom | Bedroom | Living | Office | Kitchen | Storage
    { voxelIndex: 17, moduleId: 'bedroom',        orientation: 'e' },
    { voxelIndex: 18, moduleId: 'bedroom',        orientation: 'e' },
    { voxelIndex: 19, moduleId: 'living_room',    orientation: 's' },
    { voxelIndex: 20, moduleId: 'office',         orientation: 's' },
    { voxelIndex: 21, moduleId: 'kitchen_pantry', orientation: 'w' },
    { voxelIndex: 22, moduleId: 'storage',        orientation: 'n' },
  ],
};

const guestSuite: ContainerPreset = {
  id: 'guest_suite',
  label: 'Guest Suite',
  description: 'Cozy guest bedroom with private bath',
  icon: '🏨',
  containerSize: ContainerSize.HighCube40,
  tags: ['residential', 'guest'],
  voxels: [
    // Row 1: Bedroom x3 | Bath | Storage x2
    { voxelIndex: 9,  moduleId: 'bedroom',       orientation: 's' },
    { voxelIndex: 10, moduleId: 'bedroom',       orientation: 's' },
    { voxelIndex: 11, moduleId: 'bedroom',       orientation: 's' },
    { voxelIndex: 12, moduleId: 'bathroom_full', orientation: 'n' },
    { voxelIndex: 13, moduleId: 'storage',       orientation: 'n' },
    { voxelIndex: 14, moduleId: 'storage',       orientation: 'n' },
    // Row 2: Bedroom x3 | Bath | Storage x2
    { voxelIndex: 17, moduleId: 'bedroom',        orientation: 's' },
    { voxelIndex: 18, moduleId: 'bedroom',        orientation: 's' },
    { voxelIndex: 19, moduleId: 'bedroom',        orientation: 's' },
    { voxelIndex: 20, moduleId: 'bathroom_half',  orientation: 'n' },
    { voxelIndex: 21, moduleId: 'storage',        orientation: 'n' },
    { voxelIndex: 22, moduleId: 'laundry',        orientation: 'n' },
  ],
};

const openLoft: ContainerPreset = {
  id: 'open_loft',
  label: 'Open Loft',
  description: 'Maximum open space with glass walls',
  icon: '🪟',
  containerSize: ContainerSize.HighCube40,
  tags: ['residential', 'loft', 'modern'],
  voxels: [
    // Row 1-2: all living_room with south-facing glass
    { voxelIndex: 9,  moduleId: 'living_room', orientation: 's' },
    { voxelIndex: 10, moduleId: 'living_room', orientation: 's' },
    { voxelIndex: 11, moduleId: 'living_room', orientation: 's' },
    { voxelIndex: 12, moduleId: 'living_room', orientation: 's' },
    { voxelIndex: 13, moduleId: 'living_room', orientation: 's' },
    { voxelIndex: 14, moduleId: 'living_room', orientation: 's' },
    { voxelIndex: 17, moduleId: 'living_room', orientation: 'n' },
    { voxelIndex: 18, moduleId: 'living_room', orientation: 'n' },
    { voxelIndex: 19, moduleId: 'living_room', orientation: 'n' },
    { voxelIndex: 20, moduleId: 'living_room', orientation: 'n' },
    { voxelIndex: 21, moduleId: 'living_room', orientation: 'n' },
    { voxelIndex: 22, moduleId: 'living_room', orientation: 'n' },
  ],
};

// ── Commercial/Utility Presets ──────────────────────────────

const homeOffice: ContainerPreset = {
  id: 'home_office',
  label: 'Home Office',
  description: 'Office space with kitchen and bath',
  icon: '💼',
  containerSize: ContainerSize.HighCube40,
  tags: ['commercial', 'office'],
  voxels: [
    // Row 1: Office x3 | Living | Kitchen | Bath
    { voxelIndex: 9,  moduleId: 'office',        orientation: 's' },
    { voxelIndex: 10, moduleId: 'office',        orientation: 's' },
    { voxelIndex: 11, moduleId: 'office',        orientation: 's' },
    { voxelIndex: 12, moduleId: 'living_room',   orientation: 's' },
    { voxelIndex: 13, moduleId: 'kitchen_full',  orientation: 'w' },
    { voxelIndex: 14, moduleId: 'bathroom_full', orientation: 'n' },
    // Row 2: Office x3 | Living | Pantry | Storage
    { voxelIndex: 17, moduleId: 'office',         orientation: 'n' },
    { voxelIndex: 18, moduleId: 'office',         orientation: 'n' },
    { voxelIndex: 19, moduleId: 'office',         orientation: 'n' },
    { voxelIndex: 20, moduleId: 'living_room',    orientation: 'n' },
    { voxelIndex: 21, moduleId: 'kitchen_pantry', orientation: 'w' },
    { voxelIndex: 22, moduleId: 'storage',        orientation: 'n' },
  ],
};

const workshop: ContainerPreset = {
  id: 'workshop',
  label: 'Workshop',
  description: 'Utility/maker space with storage',
  icon: '🔧',
  containerSize: ContainerSize.HighCube40,
  tags: ['utility', 'workshop'],
  voxels: [
    // Row 1: Storage x2 | Mechanical | Laundry | Storage x2
    { voxelIndex: 9,  moduleId: 'storage',    orientation: 'e' },
    { voxelIndex: 10, moduleId: 'storage',    orientation: 'e' },
    { voxelIndex: 11, moduleId: 'mechanical', orientation: 'n' },
    { voxelIndex: 12, moduleId: 'laundry',    orientation: 'n' },
    { voxelIndex: 13, moduleId: 'storage',    orientation: 'n' },
    { voxelIndex: 14, moduleId: 'storage',    orientation: 'n' },
    // Row 2: Storage x2 | Mechanical | Laundry | Storage x2
    { voxelIndex: 17, moduleId: 'storage',    orientation: 'e' },
    { voxelIndex: 18, moduleId: 'storage',    orientation: 'e' },
    { voxelIndex: 19, moduleId: 'mechanical', orientation: 'n' },
    { voxelIndex: 20, moduleId: 'laundry',    orientation: 'n' },
    { voxelIndex: 21, moduleId: 'storage',    orientation: 'n' },
    { voxelIndex: 22, moduleId: 'storage',    orientation: 'n' },
  ],
};

// ── Outdoor/Entertainment Presets ────────────────────────────

const deckHouse: ContainerPreset = {
  id: 'deck_house',
  label: 'Deck House',
  description: 'Indoor living + wraparound deck extensions',
  icon: '🌴',
  containerSize: ContainerSize.HighCube40,
  tags: ['outdoor', 'deck'],
  voxels: [
    // Row 1: Living x3 | Kitchen | Bath | Storage
    { voxelIndex: 9,  moduleId: 'living_room',   orientation: 's' },
    { voxelIndex: 10, moduleId: 'living_room',   orientation: 's' },
    { voxelIndex: 11, moduleId: 'living_room',   orientation: 's' },
    { voxelIndex: 12, moduleId: 'kitchen_full',  orientation: 'w' },
    { voxelIndex: 13, moduleId: 'bathroom_full', orientation: 'n' },
    { voxelIndex: 14, moduleId: 'storage',       orientation: 'n' },
    // Row 2: Living x3 | Kitchen pantry | Bath | Laundry
    { voxelIndex: 17, moduleId: 'living_room',    orientation: 'n' },
    { voxelIndex: 18, moduleId: 'living_room',    orientation: 'n' },
    { voxelIndex: 19, moduleId: 'living_room',    orientation: 'n' },
    { voxelIndex: 20, moduleId: 'kitchen_pantry', orientation: 'w' },
    { voxelIndex: 21, moduleId: 'bathroom_half',  orientation: 'n' },
    { voxelIndex: 22, moduleId: 'laundry',        orientation: 'n' },
    // Extension row 0 (front): deck_open
    { voxelIndex: 1, moduleId: 'deck_open', orientation: 's' },
    { voxelIndex: 2, moduleId: 'deck_open', orientation: 's' },
    { voxelIndex: 3, moduleId: 'deck_open', orientation: 's' },
    { voxelIndex: 4, moduleId: 'deck_open', orientation: 's' },
    { voxelIndex: 5, moduleId: 'deck_open', orientation: 's' },
    { voxelIndex: 6, moduleId: 'deck_open', orientation: 's' },
    // Extension row 3 (back): balcony
    { voxelIndex: 25, moduleId: 'balcony', orientation: 'n' },
    { voxelIndex: 26, moduleId: 'balcony', orientation: 'n' },
    { voxelIndex: 27, moduleId: 'balcony', orientation: 'n' },
    { voxelIndex: 28, moduleId: 'balcony', orientation: 'n' },
    { voxelIndex: 29, moduleId: 'balcony', orientation: 'n' },
    { voxelIndex: 30, moduleId: 'balcony', orientation: 'n' },
  ],
};

const entertainer: ContainerPreset = {
  id: 'entertainer',
  label: 'Entertainer',
  description: 'Open plan with kitchen island + front deck',
  icon: '🎉',
  containerSize: ContainerSize.HighCube40,
  tags: ['outdoor', 'entertainment'],
  voxels: [
    // Row 1: Kitchen x2 | Living x4
    { voxelIndex: 9,  moduleId: 'kitchen_full',  orientation: 'e' },
    { voxelIndex: 10, moduleId: 'kitchen_pantry', orientation: 'e' },
    { voxelIndex: 11, moduleId: 'living_room',   orientation: 's' },
    { voxelIndex: 12, moduleId: 'living_room',   orientation: 's' },
    { voxelIndex: 13, moduleId: 'living_room',   orientation: 's' },
    { voxelIndex: 14, moduleId: 'living_room',   orientation: 's' },
    // Row 2: Kitchen | Storage | Living x4
    { voxelIndex: 17, moduleId: 'kitchen_pantry', orientation: 'e' },
    { voxelIndex: 18, moduleId: 'storage',        orientation: 'e' },
    { voxelIndex: 19, moduleId: 'living_room',    orientation: 'n' },
    { voxelIndex: 20, moduleId: 'living_room',    orientation: 'n' },
    { voxelIndex: 21, moduleId: 'living_room',    orientation: 'n' },
    { voxelIndex: 22, moduleId: 'living_room',    orientation: 'n' },
    // Extension row 0 (front): deck_open
    { voxelIndex: 1, moduleId: 'deck_open', orientation: 's' },
    { voxelIndex: 2, moduleId: 'deck_open', orientation: 's' },
    { voxelIndex: 3, moduleId: 'deck_open', orientation: 's' },
    { voxelIndex: 4, moduleId: 'deck_open', orientation: 's' },
    { voxelIndex: 5, moduleId: 'deck_open', orientation: 's' },
    { voxelIndex: 6, moduleId: 'deck_open', orientation: 's' },
  ],
};

// ── Empty Default ────────────────────────────────────────────

const emptySteel: ContainerPreset = {
  id: 'empty_steel',
  label: 'Empty Container',
  description: 'Blank steel box (default)',
  icon: '📦',
  containerSize: ContainerSize.HighCube40,
  tags: ['empty'],
  voxels: [], // No modules applied
};

// ── 20ft Variants ────────────────────────────────────────────
// 20ft body voxels: same grid but smaller physical space

const studio20ft: ContainerPreset = {
  id: 'studio_20ft',
  label: 'Micro Studio',
  description: 'Compact studio for 20ft container',
  icon: '🏠',
  containerSize: ContainerSize.Standard20,
  tags: ['residential', 'compact', '20ft'],
  voxels: [
    // Row 1: Kitchen | Living | Bedroom | Bedroom | Bath | Storage
    { voxelIndex: 9,  moduleId: 'kitchen_full',   orientation: 'e' },
    { voxelIndex: 10, moduleId: 'living_room',    orientation: 's' },
    { voxelIndex: 11, moduleId: 'bedroom',        orientation: 'w' },
    { voxelIndex: 12, moduleId: 'bedroom',        orientation: 'w' },
    { voxelIndex: 13, moduleId: 'bathroom_half',  orientation: 'n' },
    { voxelIndex: 14, moduleId: 'storage',        orientation: 'n' },
    // Row 2: Kitchen | Living | Bedroom | Bedroom | Laundry | Storage
    { voxelIndex: 17, moduleId: 'kitchen_pantry', orientation: 'e' },
    { voxelIndex: 18, moduleId: 'living_room',    orientation: 's' },
    { voxelIndex: 19, moduleId: 'bedroom',        orientation: 'w' },
    { voxelIndex: 20, moduleId: 'bedroom',        orientation: 'w' },
    { voxelIndex: 21, moduleId: 'laundry',        orientation: 'n' },
    { voxelIndex: 22, moduleId: 'storage',        orientation: 'n' },
  ],
};

const office20ft: ContainerPreset = {
  id: 'office_20ft',
  label: 'Compact Office',
  description: 'Small office for 20ft container',
  icon: '💻',
  containerSize: ContainerSize.Standard20,
  tags: ['commercial', 'office', '20ft'],
  voxels: [
    // Row 1: Office x4 | Bath | Storage
    { voxelIndex: 9,  moduleId: 'office',        orientation: 's' },
    { voxelIndex: 10, moduleId: 'office',        orientation: 's' },
    { voxelIndex: 11, moduleId: 'office',        orientation: 's' },
    { voxelIndex: 12, moduleId: 'office',        orientation: 's' },
    { voxelIndex: 13, moduleId: 'bathroom_half', orientation: 'n' },
    { voxelIndex: 14, moduleId: 'storage',       orientation: 'n' },
    // Row 2: Office x4 | Kitchen | Storage
    { voxelIndex: 17, moduleId: 'office',         orientation: 'n' },
    { voxelIndex: 18, moduleId: 'office',         orientation: 'n' },
    { voxelIndex: 19, moduleId: 'office',         orientation: 'n' },
    { voxelIndex: 20, moduleId: 'office',         orientation: 'n' },
    { voxelIndex: 21, moduleId: 'kitchen_full',   orientation: 'w' },
    { voxelIndex: 22, moduleId: 'storage',        orientation: 'n' },
  ],
};

// ── Export ────────────────────────────────────────────────────

export const CONTAINER_PRESETS: ContainerPreset[] = [
  emptySteel,
  studioApartment,
  oneBedroom,
  guestSuite,
  openLoft,
  homeOffice,
  workshop,
  deckHouse,
  entertainer,
  studio20ft,
  office20ft,
];

/** Look up a container preset by ID. */
export function getContainerPreset(id: string): ContainerPreset | undefined {
  return CONTAINER_PRESETS.find(p => p.id === id);
}
