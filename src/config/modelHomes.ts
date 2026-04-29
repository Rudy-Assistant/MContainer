/**
 * modelHomes.ts — Model Home Templates
 *
 * Pre-designed multi-container layouts that users can spawn as starting points.
 * Each model home defines containers with roles, sizes, relative positions,
 * and connections (adjacency / stacking).
 */

import { ContainerSize, type ContainerArrangementId, FurnitureType } from '@/types/container';

// ── Types ────────────────────────────────────────────────────

export interface ModelHomePresetFurniture {
  type: FurnitureType;
  /** Local-space position relative to the container's origin. */
  position: { x: number; y: number; z: number };
  /** Y-rotation in radians (default 0). */
  rotation?: number;
}

export interface ModelHomeContainer {
  role: string;                                  // ContainerRole id
  size: ContainerSize;
  relativePosition: [number, number, number];    // Offset from model home origin [x, y, z]
  extensionConfig?: string;                      // 'none' | 'all_deck' | etc.
  arrangementId?: ContainerArrangementId;
  /** Optional entry door — installed at the given voxel face after arrangement
   *  is applied. Provided so walkthrough-ready presets can drop the user into
   *  a habitable interior with a working door, no manual editing required. */
  entryDoor?: { voxelIndex: number; face: 'n' | 's' | 'e' | 'w' };
  /** Optional furniture instances to drop into the container after placement.
   *  Each item is added via `addFurniture` so it appears in the BOM and renders
   *  in 3D. Positions are LOCAL to the container origin. */
  furniture?: ModelHomePresetFurniture[];
}

export interface ModelHomeConnection {
  fromIndex: number;                             // Index into containers array
  toIndex: number;
  type: 'adjacent' | 'stacked';
  stairsVoxelIndex?: number;                     // If stacked, which voxel gets stairs
  /** Stair direction passed to applyStairsFromFace. Defaults to `'n'`.
   *  Use `'top'` to ascend onto the rooftop deck of the destination
   *  container instead of into its body — needed for the L2→roof stair
   *  in the Glass Atrium Showcase. */
  stairsFace?: 'n' | 's' | 'e' | 'w' | 'top';
}

export interface ModelHome {
  id: string;
  label: string;
  description: string;
  icon: string;
  containers: ModelHomeContainer[];
  connections: ModelHomeConnection[];
  /** Stairs that aren't tied to a stacking event — e.g. an upper-floor stair
   *  ascending onto the rooftop deck. Each entry calls applyStairsFromFace
   *  on the named container after all stacking is complete. */
  extraStairs?: Array<{ containerIndex: number; voxelIndex: number; face: 'n' | 's' | 'e' | 'w' | 'top' }>;
  tags?: string[];
}

// ── Constants ────────────────────────────────────────────────

/** Container width (Z axis) used for side-by-side offsets */
const WIDTH = 2.44;

/** 40ft container length (X axis) for end-to-end offsets */
const LENGTH_40 = 12.19;

/** Standard 40ft container height (Y axis) for stacking */
const HEIGHT_STD = 2.59;

/** 40ft High-Cube container height (Y axis) for stacking. Glass-walled
 *  showcase presets use HighCubes so the upper-floor walkway doesn't feel
 *  cramped when the L2 floor is partially open as an atrium. */
const HEIGHT_HC = 2.90;

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

  // ── 7. Atrium Gallery ────────────────────────────────────
  {
    id: 'atrium_gallery',
    label: 'Atrium Gallery',
    description: 'Two adjacent 40ft containers configured as enclosed atrium volumes for double-height circulation and light.',
    icon: '🪟',
    containers: [
      {
        role: 'open_plan',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'none',
        arrangementId: 'central_atrium',
      },
      {
        role: 'open_plan',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, WIDTH],
        extensionConfig: 'none',
        arrangementId: 'central_atrium',
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'adjacent' },
    ],
    tags: ['atrium', 'gallery', '2br', 'light'],
  },
  {
    id: 'glass_atrium_pair',
    label: 'Glass Atrium Pair',
    description: 'Two adjacent 40ft containers as transparent atrium pavilions with a shared light-filled seam.',
    icon: '🏛️',
    containers: [
      {
        role: 'open_plan',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'none',
        arrangementId: 'glass_atrium',
      },
      {
        role: 'open_plan',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, WIDTH],
        extensionConfig: 'none',
        arrangementId: 'glass_atrium',
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'adjacent' },
    ],
    tags: ['atrium', 'glass', 'gallery', 'light'],
  },
  {
    id: 'stacked_atrium_tower',
    label: 'Stacked Atrium Tower',
    description: 'Two stacked 40ft containers with aligned atrium openings and an internal stair core tying the levels together.',
    icon: '🧱',
    containers: [
      {
        role: 'living_room',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'none',
        arrangementId: 'central_atrium',
      },
      {
        role: 'open_plan',
        size: ContainerSize.Standard40,
        relativePosition: [0, HEIGHT_STD, 0],
        extensionConfig: 'none',
        arrangementId: 'glass_atrium',
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'stacked', stairsVoxelIndex: 10 },
    ],
    tags: ['atrium', 'tower', 'stacked', 'vertical'],
  },
  {
    id: 'gallery_wings',
    label: 'Gallery Wings',
    description: 'A glazed central atrium gallery with two enclosed side wings for living and sleeping zones.',
    icon: '🪽',
    containers: [
      {
        role: 'open_plan',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'none',
        arrangementId: 'glass_atrium',
      },
      {
        role: 'living_room',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, -WIDTH],
        extensionConfig: 'none',
        arrangementId: 'max_closed',
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, WIDTH],
        extensionConfig: 'none',
        arrangementId: 'max_closed',
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'adjacent' },
      { fromIndex: 0, toIndex: 2, type: 'adjacent' },
    ],
    tags: ['gallery', 'wings', 'atrium', 'light'],
  },
  {
    id: 'courtyard_compound',
    label: 'Courtyard Compound',
    description: 'Four enclosed terrace shells arranged around a central outdoor court.',
    icon: '⬜',
    containers: [
      {
        role: 'living_room',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'none',
        arrangementId: 'roof_terrace',
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [LENGTH_40, 0, 0],
        extensionConfig: 'none',
        arrangementId: 'roof_terrace',
      },
      {
        role: 'open_plan',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, WIDTH * 2],
        extensionConfig: 'none',
        arrangementId: 'glass_terrace',
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [LENGTH_40, 0, WIDTH * 2],
        extensionConfig: 'none',
        arrangementId: 'roof_terrace',
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'adjacent' },
      { fromIndex: 0, toIndex: 2, type: 'adjacent' },
      { fromIndex: 1, toIndex: 3, type: 'adjacent' },
      { fromIndex: 2, toIndex: 3, type: 'adjacent' },
    ],
    tags: ['courtyard', 'compound', 'terrace', 'outdoor'],
  },

  // ───────────────────────────────────────────────────────────
  // STARTER SETS — each exercises a specific Smart rule so the
  // model homes double as living documentation of the rules.
  // See SMART_RULES.md for the full canonical list.
  // ───────────────────────────────────────────────────────────

  // ── 12. Garden Pavilion ─────────────────────────────────
  // EXERCISES: smart floor-corner poles under deck extensions,
  // smart railings on open deck perimeters.
  {
    id: 'garden_pavilion',
    label: 'Garden Pavilion',
    description: 'Single-level glass pavilion with a wraparound deck — the cleanest demonstration of smart floor-corner poles and auto-railings.',
    icon: '🌿',
    containers: [
      {
        role: 'wraparound',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
      },
    ],
    connections: [],
    tags: ['single', 'glass', 'pavilion', 'deck', 'smart-rule:floor-corners'],
  },

  // ── 13. Split-Level Loft ────────────────────────────────
  // EXERCISES: cross-container stair void (stairs on ground reach
  // level 1; floor of container above must auto-punch an opening).
  {
    id: 'split_level_loft',
    label: 'Split-Level Loft',
    description: 'A full-width 40ft great room with a 20ft loft stacked on one half — exercises cross-container stair voids and partial-overlap railings.',
    icon: '🪜',
    containers: [
      {
        role: 'living_room',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'south_deck',
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard20,
        // Offset the 20ft loft over the east half of the 40ft great room.
        // 20ft length is 6.06m; east-half mid of a 12.19m container is at +3.065m.
        relativePosition: [6.065, HEIGHT_STD, 0],
        extensionConfig: 'none',
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'stacked', stairsVoxelIndex: 13 },
    ],
    tags: ['loft', 'split-level', 'stacked', 'smart-rule:stair-void', 'smart-rule:partial-overlap'],
  },

  // ── 14. Corner Terrace ──────────────────────────────────
  // EXERCISES: concave-corner pole placement on L-shaped footprints.
  {
    id: 'corner_terrace',
    label: 'Corner Terrace',
    description: 'L-shaped arrangement with a shared deck — the concave corner of the L is the canonical test case for concave pole placement.',
    icon: '📐',
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
        // Rotated perpendicular: offset east so it forms an L, not side-by-side.
        relativePosition: [LENGTH_40, 0, WIDTH],
        extensionConfig: 'none',
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'adjacent' },
    ],
    tags: ['l-shape', 'terrace', 'corner', 'smart-rule:concave-poles'],
  },

  // ───────────────────────────────────────────────────────────
  // WALKTHROUGH STARTERS — one curated preset per container count
  // (1/2/3/4). Every starter ships with an installed entry door so the
  // user can press F → walk in → press O on the door → it opens.
  // ───────────────────────────────────────────────────────────

  // ── Walkthrough · 1 Container · Studio Loft ─────────────
  // Fully extended single-container demo with glass walls, an entry door,
  // and furniture arranged for a habitable interior. Designed for the
  // walkthrough flow: spawn → step in → look around → press a key on the
  // door to open/close. Glass walls let you see through to the wider world.
  {
    id: 'walkthrough_1_studio',
    label: '1-Container · Glass Studio',
    description: 'Single 40ft High Cube — fully-extended glass studio with a wraparound deck, entry door, and a furnished interior (bed, kitchen, desk, sofa). The richest 1-container walkthrough demo.',
    icon: '🏠',
    containers: [
      {
        role: 'open_plan',
        size: ContainerSize.HighCube40,
        relativePosition: [0, 0, 0],
        // Wraparound deck on all four sides + interior glass walls (open/glass
        // boundary on body-extension seam, glass on the outer perimeter).
        extensionConfig: 'all_glass_interior',
        arrangementId: 'largest_glass',
        // Voxel index 28 = level 0, row 3, col 4 — south wall, mid-length.
        entryDoor: { voxelIndex: 28, face: 's' },
        // Furniture is positioned in the container's local frame — origin
        // is the container's centre, +X = east, +Z = south.
        furniture: [
          // West end of the studio: kitchen counter + appliances.
          { type: FurnitureType.Kitchen,    position: { x: -4.5, y: 0, z: -0.4 }, rotation: 0 },
          { type: FurnitureType.Fridge,     position: { x: -5.6, y: 0, z: 0.4 },  rotation: 0 },
          { type: FurnitureType.DiningTable, position: { x: -2.5, y: 0, z: 0 },   rotation: 0 },
          // Centre: living area.
          { type: FurnitureType.Sofa,       position: { x: 0,    y: 0, z: -0.5 }, rotation: 0 },
          // East end: sleeping + work zone.
          { type: FurnitureType.Bed,        position: { x: 4.5,  y: 0, z: -0.5 }, rotation: 0 },
          { type: FurnitureType.Nightstand, position: { x: 5.5,  y: 0, z: -0.2 }, rotation: 0 },
          { type: FurnitureType.Desk,       position: { x: 3.0,  y: 0, z: 0.6 },  rotation: 0 },
        ],
      },
    ],
    connections: [],
    tags: ['walkthrough', '1-container', 'studio', 'glass', 'furnished'],
  },

  // ── Walkthrough · 2 Containers · Side-by-Side ───────────
  // Adjacent variant: two containers form a duplex with shared interior wall
  // opened up. Furnished as a one-bedroom: living room + dining + kitchen on
  // the west side, bedroom on the east side.
  {
    id: 'walkthrough_2_duplex',
    label: '2-Container · Duplex',
    description: 'Two adjacent 40ft containers forming a one-bedroom: living room + kitchen + dining on the west side, bedroom + bath on the east. Entry door on the south wall.',
    icon: '🏘️',
    containers: [
      {
        role: 'living_room',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'none',
        arrangementId: 'max_closed',
        entryDoor: { voxelIndex: 28, face: 's' },
        furniture: [
          { type: FurnitureType.Kitchen,    position: { x: -4.5, y: 0, z: -0.4 }, rotation: 0 },
          { type: FurnitureType.Fridge,     position: { x: -5.6, y: 0, z: 0.4 },  rotation: 0 },
          { type: FurnitureType.Stove,      position: { x: -3.5, y: 0, z: -0.4 }, rotation: 0 },
          { type: FurnitureType.DiningTable, position: { x: -1.0, y: 0, z: 0 },   rotation: 0 },
          { type: FurnitureType.Sofa,       position: { x: 3.0,  y: 0, z: -0.4 }, rotation: 0 },
        ],
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, WIDTH],
        extensionConfig: 'none',
        arrangementId: 'max_closed',
        furniture: [
          { type: FurnitureType.Bed,         position: { x: -3.5, y: 0, z: 0 }, rotation: 0 },
          { type: FurnitureType.Nightstand,  position: { x: -2.4, y: 0, z: 0.4 }, rotation: 0 },
          { type: FurnitureType.Storage,     position: { x: 0.5,  y: 0, z: -0.6 }, rotation: 0 },
          { type: FurnitureType.Bathroom,    position: { x: 4.5,  y: 0, z: -0.6 }, rotation: 0 },
        ],
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'adjacent' },
    ],
    tags: ['walkthrough', '2-container', 'duplex', 'furnished'],
  },

  // ── Walkthrough · 2 Containers · Stacked w/ Rooftop Deck ────
  // The "double-level + rooftop deck" preset: two 40ft Standards stacked,
  // ground-floor living room, upstairs bedroom, internal staircase, and a
  // walkable rooftop deck on top. The "Level 3 floor" the user asked about —
  // i.e. the rooftop deck — is generated automatically by the topmost-only
  // SR-07 rule once the upper container is in place.
  {
    id: 'walkthrough_2_stacked_rooftop',
    label: '2-Container · Stacked + Rooftop',
    description: 'Two 40ft containers stacked into a two-story home with a rooftop deck. Internal staircase from living room (ground) to bedroom (upper). The rooftop is walkable — that "Level 3 floor".',
    icon: '🏠',
    containers: [
      {
        role: 'living_room',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'south_deck',
        entryDoor: { voxelIndex: 28, face: 's' },
        furniture: [
          { type: FurnitureType.Kitchen,    position: { x: -4.5, y: 0, z: -0.4 }, rotation: 0 },
          { type: FurnitureType.Sofa,       position: { x: 1.5,  y: 0, z: -0.4 }, rotation: 0 },
          { type: FurnitureType.DiningTable, position: { x: -1.5, y: 0, z: 0.3 },  rotation: 0 },
        ],
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [0, HEIGHT_STD, 0],
        extensionConfig: 'none',
        furniture: [
          { type: FurnitureType.Bed,         position: { x: -3.5, y: 0, z: 0 }, rotation: 0 },
          { type: FurnitureType.Nightstand,  position: { x: -2.4, y: 0, z: 0.4 }, rotation: 0 },
          { type: FurnitureType.Bathroom,    position: { x: 4.5,  y: 0, z: -0.6 }, rotation: 0 },
        ],
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'stacked', stairsVoxelIndex: 9 },
    ],
    tags: ['walkthrough', '2-container', 'stacked', 'rooftop', 'furnished'],
  },

  // ── Walkthrough · 3 Containers · Two-Story w/ Stairs ────
  // 2 ground-floor units + 1 stacked upper unit. The upper sits on the west
  // ground-floor container so half of the stacked pair has a rooftop terrace
  // (the east half) while the other half supports a second story.
  {
    id: 'walkthrough_3_townhouse',
    label: '3-Container · Two-Story Townhouse',
    description: 'Two ground-floor containers (living + kitchen-dining) + one upper bedroom. Internal staircase connects the levels. The east ground unit has a roof terrace.',
    icon: '🏢',
    containers: [
      {
        role: 'living_room',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'none',
        arrangementId: 'max_closed',
        entryDoor: { voxelIndex: 28, face: 's' },
        furniture: [
          { type: FurnitureType.Sofa,       position: { x: -2.0, y: 0, z: -0.4 }, rotation: 0 },
          { type: FurnitureType.DiningTable, position: { x: 3.0, y: 0, z: 0.3 },  rotation: 0 },
        ],
      },
      {
        role: 'kitchen',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, WIDTH],
        extensionConfig: 'none',
        arrangementId: 'max_closed',
        furniture: [
          { type: FurnitureType.Kitchen,   position: { x: -4.5, y: 0, z: -0.4 }, rotation: 0 },
          { type: FurnitureType.Fridge,    position: { x: -5.6, y: 0, z: 0.4 },  rotation: 0 },
          { type: FurnitureType.Stove,     position: { x: -3.5, y: 0, z: -0.4 }, rotation: 0 },
          { type: FurnitureType.Storage,   position: { x: 4.0,  y: 0, z: -0.6 }, rotation: 0 },
        ],
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [0, HEIGHT_STD, 0],
        extensionConfig: 'none',
        arrangementId: 'max_closed',
        furniture: [
          { type: FurnitureType.Bed,        position: { x: -3.5, y: 0, z: 0 },   rotation: 0 },
          { type: FurnitureType.Nightstand, position: { x: -2.4, y: 0, z: 0.4 }, rotation: 0 },
          { type: FurnitureType.Desk,       position: { x: 2.5,  y: 0, z: 0.5 }, rotation: 0 },
          { type: FurnitureType.Bathroom,   position: { x: 4.5,  y: 0, z: -0.6 },rotation: 0 },
        ],
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'adjacent' },
      { fromIndex: 0, toIndex: 2, type: 'stacked', stairsVoxelIndex: 10 },
    ],
    tags: ['walkthrough', '3-container', 'two-story', 'townhouse', 'furnished'],
  },

  // ── Walkthrough · 4 Containers · Courtyard Compound ────
  {
    id: 'walkthrough_4_courtyard',
    label: '4-Container · Courtyard Compound',
    description: 'Four containers around a central court — living, kitchen, two bedrooms. Entry door on the south wall of the living room.',
    icon: '⬛',
    containers: [
      {
        role: 'living_room',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'none',
        arrangementId: 'max_closed',
        entryDoor: { voxelIndex: 28, face: 's' },
        furniture: [
          { type: FurnitureType.Sofa,        position: { x: -2.0, y: 0, z: -0.4 }, rotation: 0 },
          { type: FurnitureType.DiningTable, position: { x: 3.0,  y: 0, z: 0.3 },  rotation: 0 },
        ],
      },
      {
        role: 'kitchen',
        size: ContainerSize.Standard40,
        relativePosition: [LENGTH_40, 0, 0],
        extensionConfig: 'none',
        arrangementId: 'max_closed',
        furniture: [
          { type: FurnitureType.Kitchen, position: { x: -4.5, y: 0, z: -0.4 }, rotation: 0 },
          { type: FurnitureType.Fridge,  position: { x: -5.6, y: 0, z: 0.4 },  rotation: 0 },
          { type: FurnitureType.Stove,   position: { x: -3.5, y: 0, z: -0.4 }, rotation: 0 },
          { type: FurnitureType.Storage, position: { x: 4.0,  y: 0, z: -0.6 }, rotation: 0 },
        ],
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [0, 0, WIDTH * 2],
        extensionConfig: 'none',
        arrangementId: 'max_closed',
        furniture: [
          { type: FurnitureType.Bed,        position: { x: -3.5, y: 0, z: 0 },    rotation: 0 },
          { type: FurnitureType.Nightstand, position: { x: -2.4, y: 0, z: 0.4 },  rotation: 0 },
          { type: FurnitureType.Desk,       position: { x: 3.0,  y: 0, z: 0.5 },  rotation: 0 },
        ],
      },
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [LENGTH_40, 0, WIDTH * 2],
        extensionConfig: 'none',
        arrangementId: 'max_closed',
        furniture: [
          { type: FurnitureType.BedSingle,  position: { x: -3.5, y: 0, z: 0 },    rotation: 0 },
          { type: FurnitureType.BedSingle,  position: { x: -1.0, y: 0, z: 0 },    rotation: 0 },
          { type: FurnitureType.Bathroom,   position: { x: 4.5,  y: 0, z: -0.6 }, rotation: 0 },
        ],
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'adjacent' },
      { fromIndex: 2, toIndex: 3, type: 'adjacent' },
    ],
    tags: ['walkthrough', '4-container', 'courtyard', 'compound', 'furnished'],
  },

  // ── 15. Stacked Triplex ─────────────────────────────────
  // EXERCISES: multi-level stair chain (stairs on each level must
  // stack structurally so you can actually walk from L0 to L2).
  {
    id: 'stacked_triplex',
    label: 'Stacked Triplex',
    description: 'Three 40ft containers stacked three stories high, each floor connected by an internal staircase. Stress-tests multi-level stair chains and roof-deck on the topmost-only rule.',
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
      {
        role: 'bedroom',
        size: ContainerSize.Standard40,
        relativePosition: [0, HEIGHT_STD * 2, 0],
        extensionConfig: 'none',
      },
    ],
    connections: [
      { fromIndex: 0, toIndex: 1, type: 'stacked', stairsVoxelIndex: 9 },
      { fromIndex: 1, toIndex: 2, type: 'stacked', stairsVoxelIndex: 14 },
    ],
    tags: ['triplex', '3-story', 'stacked', 'smart-rule:multi-level-stairs', 'smart-rule:rooftop-topmost'],
  },

  // ── Showcase · 2×2 Glass Atrium with Rooftop Deck ────────────
  // Eight 40 HighCube containers — four on the ground in a 2×2 footprint,
  // four stacked above. L1 carries the framed_glass_box arrangement (per-
  // voxel sill+glass+transom, sliding-shoji entry doors on the south of the
  // SW unit). L2 carries framed_glass_atrium so each upper container has its
  // own 2×2 floor void with cable railings — clustered at the seam they
  // read as a continuous open atrium looking down to L1. SR-07 promotes the
  // L2 roof to a walkable rooftop deck with auto-railings; an extra 'top'
  // stair off the L2 NW container provides access to it.
  //
  // Why this preset matters as a test: it stress-tests adjacency
  // auto-merge (interior walls between the 4 L1 + 4 L2 units must dissolve
  // so the two floors read as one continuous open plan), Window_Standard
  // rendering across stacked containers (mullions should align vertically
  // through L1+L2), the new 'top' stair face, and walkthrough collision
  // around the railed atrium void. Sliding shoji doors verify the
  // toggleOpenFace mechanism in walkthrough.
  {
    id: 'glass_atrium_showcase',
    label: '2×2 Glass Atrium Showcase',
    description: 'Four 40HC containers in a 2×2 footprint, doubled up — eight in total. Framed-glass curtain walls on every side, sliding-glass entry doors on the south, an open atrium at the heart of the upper floor, internal stair from ground to walkway, and a second stair onto the rooftop deck.',
    icon: '🏛️',
    containers: [
      // L1 — four ground-floor units (NW, NE, SW, SE)
      {
        role: 'open_plan',
        size: ContainerSize.HighCube40,
        relativePosition: [0, 0, 0],
        extensionConfig: 'all_deck',
        arrangementId: 'framed_glass_box',
      },
      {
        role: 'open_plan',
        size: ContainerSize.HighCube40,
        relativePosition: [LENGTH_40, 0, 0],
        extensionConfig: 'all_deck',
        arrangementId: 'framed_glass_box',
      },
      {
        role: 'open_plan',
        size: ContainerSize.HighCube40,
        relativePosition: [0, 0, WIDTH],
        extensionConfig: 'all_deck',
        arrangementId: 'framed_glass_box',
      },
      {
        role: 'open_plan',
        size: ContainerSize.HighCube40,
        relativePosition: [LENGTH_40, 0, WIDTH],
        extensionConfig: 'all_deck',
        arrangementId: 'framed_glass_box',
      },
      // L2 — four upper units stacked above L1 (same X/Z, y = HEIGHT_HC)
      {
        role: 'open_plan',
        size: ContainerSize.HighCube40,
        relativePosition: [0, HEIGHT_HC, 0],
        extensionConfig: 'all_deck',
        arrangementId: 'framed_glass_atrium',
      },
      {
        role: 'open_plan',
        size: ContainerSize.HighCube40,
        relativePosition: [LENGTH_40, HEIGHT_HC, 0],
        extensionConfig: 'all_deck',
        arrangementId: 'framed_glass_atrium',
      },
      {
        role: 'open_plan',
        size: ContainerSize.HighCube40,
        relativePosition: [0, HEIGHT_HC, WIDTH],
        extensionConfig: 'all_deck',
        arrangementId: 'framed_glass_atrium',
      },
      {
        role: 'open_plan',
        size: ContainerSize.HighCube40,
        relativePosition: [LENGTH_40, HEIGHT_HC, WIDTH],
        extensionConfig: 'all_deck',
        arrangementId: 'framed_glass_atrium',
      },
    ],
    connections: [
      // Stack L2 onto L1 (NW, NE, SW, SE pairs).
      // Single L1→L2 stair lives on the NW pair, voxel 9 (body NW corner)
      // ascending north so the user enters the upper walkway on the inside
      // edge facing the atrium.
      { fromIndex: 0, toIndex: 4, type: 'stacked', stairsVoxelIndex: 9 },
      { fromIndex: 1, toIndex: 5, type: 'stacked' },
      { fromIndex: 2, toIndex: 6, type: 'stacked' },
      { fromIndex: 3, toIndex: 7, type: 'stacked' },
    ],
    extraStairs: [
      // L2 NW → rooftop. Voxel 9 (body NW corner) with face='top' produces
      // a stair ascending out of the L2 floor onto the rooftop deck above
      // (the rooftop is auto-generated by SR-07 since L2 is topmost).
      { containerIndex: 4, voxelIndex: 9, face: 'top' },
    ],
    tags: ['showcase', '2x2', 'glass', 'atrium', 'rooftop', 'walkthrough', 'smart-rule:rooftop-topmost'],
  },
];

// ── Lookup ───────────────────────────────────────────────────

export function getModelHome(id: string): ModelHome | undefined {
  return MODEL_HOMES.find((m) => m.id === id);
}
