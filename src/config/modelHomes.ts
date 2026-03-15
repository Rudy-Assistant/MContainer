/**
 * modelHomes.ts — Model Home Templates
 *
 * Pre-designed multi-container layouts that users can spawn as starting points.
 * Each model home defines containers with roles, sizes, relative positions,
 * and connections (adjacency / stacking).
 */

import { ContainerSize } from '@/types/container';

// ── Types ────────────────────────────────────────────────────

export interface ModelHomeContainer {
  role: string;                                  // ContainerRole id
  size: ContainerSize;
  relativePosition: [number, number, number];    // Offset from model home origin [x, y, z]
  extensionConfig?: string;                      // 'none' | 'all_deck' | etc.
}

export interface ModelHomeConnection {
  fromIndex: number;                             // Index into containers array
  toIndex: number;
  type: 'adjacent' | 'stacked';
  stairsVoxelIndex?: number;                     // If stacked, which voxel gets stairs
}

export interface ModelHome {
  id: string;
  label: string;
  description: string;
  icon: string;
  containers: ModelHomeContainer[];
  connections: ModelHomeConnection[];
  tags?: string[];
}

// ── Constants ────────────────────────────────────────────────

/** Container width (Z axis) used for side-by-side offsets */
const WIDTH = 2.44;

/** 40ft container length (X axis) for end-to-end offsets */
const LENGTH_40 = 12.19;

/** Standard 40ft container height (Y axis) for stacking */
const HEIGHT_STD = 2.59;

// ── Model Home Definitions ───────────────────────────────────

export const MODEL_HOMES: ModelHome[] = [
  // ── 1. Micro Studio ──────────────────────────────────────
  {
    id: 'micro_studio',
    label: 'Micro Studio',
    description: 'Smallest livable unit — a single 20ft container with open plan living, sleeping, and cooking in one space.',
    icon: '🏠',
    containers: [
      {
        role: 'open_plan',
        size: ContainerSize.Standard20,
        relativePosition: [0, 0, 0],
        extensionConfig: 'all_interior',
      },
    ],
    connections: [],
    tags: ['tiny', 'starter', 'affordable', 'single'],
  },

  // ── 2. Modern 1-Bedroom ──────────────────────────────────
  {
    id: 'modern_1br',
    label: 'Modern 1-Bedroom',
    description: 'Two 40ft containers side-by-side: living room with kitchen on one side, bedroom and bathroom on the other.',
    icon: '🏡',
    containers: [
      {
        role: 'living_room',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'south_deck',
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, WIDTH],
        extensionConfig: 'none',
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'adjacent' },
    ],
    tags: ['couple', 'modern', '1br'],
  },

  // ── 3. Family 2-Bedroom ──────────────────────────────────
  {
    id: 'family_2br',
    label: 'Family 2-Bedroom',
    description: 'Three 40ft containers in an L-shape: central living hub connects to two private bedroom wings.',
    icon: '👨‍👩‍👧',
    containers: [
      {
        role: 'living_room',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'south_deck',
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, WIDTH],
        extensionConfig: 'none',
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, -WIDTH],
        extensionConfig: 'none',
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'adjacent' },
      { fromIndex: 0, toIndex: 2, type: 'adjacent' },
    ],
    tags: ['family', '2br', 'l-shape'],
  },

  // ── 4. Two-Story Modern ──────────────────────────────────
  {
    id: 'two_story',
    label: 'Two-Story Modern',
    description: 'Two 40ft containers stacked: ground floor for living and kitchen, upper floor for bedrooms with internal staircase.',
    icon: '🏢',
    containers: [
      {
        role: 'living_room',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'south_deck',
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [0, HEIGHT_STD, 0],
        extensionConfig: 'none',
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'stacked', stairsVoxelIndex: 9 },
    ],
    tags: ['2-story', 'modern', 'stacked'],
  },

  // ── 5. Entertainer's Dream ───────────────────────────────
  {
    id: 'entertainer',
    label: "Entertainer's Dream",
    description: 'Two 40ft containers — one for indoor living, one configured as a wraparound deck for outdoor entertaining.',
    icon: '🎉',
    containers: [
      {
        role: 'living_room',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'south_deck',
      },
      {
        role: 'deck_patio',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, WIDTH],
        extensionConfig: 'all_deck',
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'adjacent' },
    ],
    tags: ['entertaining', 'outdoor', 'deck'],
  },

  // ── 6. Family Compound ───────────────────────────────────
  {
    id: 'compound',
    label: 'Family Compound',
    description: 'Four 40ft containers in a 2×2 square: central living + 3 private bedrooms around perimeter.',
    icon: '🏘️',
    containers: [
      {
        role: 'living_room',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, WIDTH],
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [LENGTH_40, 0, 0],
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [LENGTH_40, 0, WIDTH],
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'adjacent' },
      { fromIndex: 0, toIndex: 2, type: 'adjacent' },
      { fromIndex: 1, toIndex: 3, type: 'adjacent' },
      { fromIndex: 2, toIndex: 3, type: 'adjacent' },
    ],
    tags: ['family', '3br', 'compound', 'large'],
  },
];

// ── Lookup ───────────────────────────────────────────────────

export function getModelHome(id: string): ModelHome | undefined {
  return MODEL_HOMES.find((m) => m.id === id);
}
