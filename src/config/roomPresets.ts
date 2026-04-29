/**
 * roomPresets.ts — Intelligent room-preset catalog.
 *
 * Each preset codifies a celebrated space-saving design and lays out
 * furniture, cabinet/fixture overlays, and finishes for a rectangular
 * group of voxels (cols × rows of body voxels).
 *
 * **Sources used (named in each preset's comment):**
 * - Frankfurt Kitchen (Margarete Schütte-Lihotzky, 1926) — work-triangle
 *   discipline; 1.9 × 3.44 m footprint; sink + range + worktop on one
 *   "golden triangle" with min 42" cook clearance.
 * - NKBA / Cyncly kitchen-triangle guideline — perimeter 12-26 ft, each
 *   leg 4-9 ft; galley min 48" corridor.
 * - Sarah Susanka, "The Not So Big House" (1998) — open plan, kitchen as
 *   heart, skip formal unused rooms, spend on built-ins.
 * - Adam Kalkin's Quik House — 12 ft kitchen island focal point, floor-
 *   to-ceiling glass on two sides, concrete + stainless finishes.
 * - Apartment Therapy / Casper bedroom guidelines — 30" min bed clearance,
 *   36" comfortable, queen 1.52×2.03 m, push-against-side-wall is the
 *   single-sleeper space recovery move.
 * - 5×8 bathroom wet-wall convention — vanity (30-36") + toilet (24") +
 *   shower (36") aligned along one long wall to share plumbing stack.
 *
 * Voxel sizing reality:
 *   - 1 col × 2 rows = 2.03×2.44 m = 4.95 m² (≈5×8 bathroom)
 *   - 2 col × 2 rows = 4.06×2.44 m = 9.91 m² (galley kitchen / queen bedroom)
 *   - 3 col × 2 rows = 6.09×2.44 m = 14.86 m² (master / living)
 *   - 4 col × 2 rows = 8.13×2.44 m = 19.83 m² (open-plan)
 *
 * All offsets are LOCAL to the preset's NW (north-west) corner anchor.
 * The applyRoomPreset action translates them to absolute container
 * coordinates at placement time.
 *
 * Pure data — no React, no Three.js.
 */

import { FurnitureType } from '@/types/container';
import type { CabinetTemplateId } from '@/config/cabinetTemplates';
import type { CabinetrySkinId } from '@/config/cabinetrySkins';
import type { FixtureTemplateId } from '@/config/fixtureTemplates';
import type { ShelfTemplateId } from '@/config/shelfTemplates';
import type { DecorTemplateId, DecorPaletteId } from '@/config/decorTemplates';
import type { CounterTopMaterialId } from '@/config/counterTopMaterials';

export type RoomPresetId =
  | 'kitchen_galley'
  | 'kitchen_l_dining'
  | 'kitchen_island_open'
  | 'bath_compact_5x8'
  | 'bath_master'
  | 'bedroom_master'
  | 'bedroom_studio'
  | 'living_room'
  | 'open_plan_klr'
  | 'home_office'
  | 'laundry_mudroom'
  | 'walk_in_closet';

/** Cardinal face of a body voxel that the overlay should attach to. */
export type RoomFace = 'n' | 's' | 'e' | 'w';

/** A piece of furniture placed in the preset.
 *  - localCol/localRow are voxel offsets (0-indexed) from the preset's NW corner.
 *  - dx/dz are sub-voxel offsets in meters (relative to that voxel's center).
 *  - rotation is in radians, snapped to PI/2 increments. */
export interface PresetFurniture {
  type: FurnitureType;
  localCol: number;
  localRow: number;
  dx?: number;
  dz?: number;
  rotation?: number;
  /** Optional human note explaining placement reasoning. */
  reason?: string;
}

/** Common position fields for any overlay placed in a preset. */
interface PresetOverlayBase {
  localCol: number;
  localRow: number;
  face: RoomFace;
  verticalAnchor?: 'top' | 'mid' | 'bottom';
  reason?: string;
}

/** Discriminated union — `kind` selects the overlay variant and TypeScript
 *  narrows `template` / skin fields to the correct catalog ID. Eliminates
 *  per-callsite `as` casts in applyRoomPreset. */
export type PresetOverlay =
  | (PresetOverlayBase & {
      kind: 'cabinet';
      template: CabinetTemplateId;
      skin: CabinetrySkinId;
      counterTop?: CounterTopMaterialId;
      underCabinetLight?: boolean;
    })
  | (PresetOverlayBase & {
      kind: 'shelf';
      template: ShelfTemplateId;
      skin: CabinetrySkinId;
    })
  | (PresetOverlayBase & {
      kind: 'fixture';
      template: FixtureTemplateId;
    })
  | (PresetOverlayBase & {
      kind: 'decor';
      template: DecorTemplateId;
      skin: DecorPaletteId;
      pictureLight?: boolean;
    });

export interface RoomPreset {
  id: RoomPresetId;
  label: string;
  /** One-line picker hint. */
  hint: string;
  /** Detailed designer's note — sources + reasoning. Surfaced in tooltip. */
  designNote: string;
  /** Target level: 0 = ground floor, 1 = upper floor. Most presets target
   *  level 0 by default; bedrooms / lofts often live on level 1. The
   *  applyRoomPreset action accepts a `level` argument to override. */
  defaultLevel?: 0 | 1;
  /** Footprint in voxels (cols × rows of body voxels needed). */
  cols: number;
  rows: number;
  /** Approximate floor area in m² (informational; computed from cols × rows). */
  approxAreaM2: number;
  /** Furniture placements. */
  furniture: PresetFurniture[];
  /** Wall overlay placements (cabinets, shelves, fixtures, decor). */
  overlays: PresetOverlay[];
  /** Recommended floor surface (placeholder for Item 7 floor overlays). */
  floorSurface?: 'Deck_Wood' | 'Wood_Hinoki' | 'Floor_Tatami' | 'Concrete';
  /** Suggested wall paint color. */
  wallColorHex?: string;
}

// ── Catalog ────────────────────────────────────────────────────────────────

export const ROOM_PRESETS: RoomPreset[] = [
  // ────────────────────────────────────────────────────────────────────
  // KITCHEN — GALLEY (Frankfurt Kitchen 1926 / NKBA work triangle)
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'kitchen_galley',
    label: 'Galley Kitchen',
    hint: 'Frankfurt-kitchen lineage: parallel runs, work triangle, 48" aisle.',
    designNote:
      'After Margarete Schütte-Lihotzky (Frankfurt Kitchen, 1926). ' +
      'Sink + range + fridge form the work triangle on the north wall (sum of legs ≈ 5m, ' +
      'within the NKBA 12–26 ft total). Wall cabinets above span both walls; lower cabinets ' +
      'continue the run with a shaker-white finish. 48" cook aisle = 1.22m, the Z dimension of ' +
      'one voxel row.',
    cols: 2,
    rows: 2,
    approxAreaM2: 9.9,
    furniture: [],
    overlays: [
      // North wall — base cabinets (continuous run with quartz counter top)
      { kind: 'cabinet', localCol: 0, localRow: 0, face: 'n', template: 'base_2door',
        skin: 'shaker_white', counterTop: 'quartz_white', underCabinetLight: true,
        reason: 'Lower cabinets, shared counter run; LED accent under counter overhang.' },
      { kind: 'cabinet', localCol: 1, localRow: 0, face: 'n', template: 'base_door_drawer',
        skin: 'shaker_white', counterTop: 'quartz_white', underCabinetLight: true,
        reason: 'Drawer + door cabinet at range right (utensils + pots).' },
      // North wall — open shelving above (modern alternative to upper cabinets;
      // Susanka "spend on built-ins" principle, popular open-kitchen aesthetic)
      { kind: 'shelf', localCol: 0, localRow: 0, face: 'n', template: 'floating_single',
        skin: 'walnut_dark', verticalAnchor: 'top',
        reason: 'Open shelf above counter — replaces wall cabinets for an airier look.' },
      { kind: 'shelf', localCol: 1, localRow: 0, face: 'n', template: 'floating_single',
        skin: 'walnut_dark', verticalAnchor: 'top' },
      // North wall — appliances embedded as fixtures (the work triangle)
      { kind: 'fixture', localCol: 0, localRow: 0, face: 'n', template: 'sink_kitchen_double',
        reason: 'Sink — west leg of work triangle.' },
      { kind: 'fixture', localCol: 1, localRow: 0, face: 'n', template: 'range_4burner',
        reason: 'Range — east leg of work triangle.' },
      // South wall — fridge (third triangle vertex) + base storage
      { kind: 'fixture', localCol: 0, localRow: 1, face: 's', template: 'fridge_french_door',
        reason: 'Fridge — south vertex of triangle. Total perimeter ≈ 5m, well under 26ft NKBA cap.' },
      { kind: 'cabinet', localCol: 1, localRow: 1, face: 's', template: 'base_4drawer',
        skin: 'shaker_white', counterTop: 'butcher_block_walnut',
        reason: 'Prep counter opposite the range — butcher block for chopping zone.' },
    ],
    floorSurface: 'Concrete',
    wallColorHex: '#f5f5f4',
  },

  // ────────────────────────────────────────────────────────────────────
  // KITCHEN — L-SHAPE + DINING
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'kitchen_l_dining',
    label: 'L-Kitchen + Dining',
    hint: 'L-shape on two adjoining walls + 4-seat dining nook.',
    designNote:
      'L-shape work triangle on north + east walls (NKBA-compliant ≈ 4 m perimeter). ' +
      'Dining table + 4 chairs occupy the southwest quarter — "kitchen as heart" (Susanka).',
    cols: 3,
    rows: 2,
    approxAreaM2: 14.9,
    furniture: [
      { type: FurnitureType.DiningTable, localCol: 0, localRow: 1, dx: 0, dz: 0, rotation: 0,
        reason: '4-seat dining centered in southwest bay.' },
      { type: FurnitureType.DiningChair, localCol: 0, localRow: 1, dx: -0.7, dz: -0.3, rotation: 0 },
      { type: FurnitureType.DiningChair, localCol: 0, localRow: 1, dx: -0.7, dz: +0.3, rotation: 0 },
      { type: FurnitureType.DiningChair, localCol: 0, localRow: 1, dx: +0.7, dz: -0.3, rotation: Math.PI },
      { type: FurnitureType.DiningChair, localCol: 0, localRow: 1, dx: +0.7, dz: +0.3, rotation: Math.PI },
    ],
    overlays: [
      { kind: 'cabinet', localCol: 1, localRow: 0, face: 'n', template: 'base_2door',
        skin: 'oak_natural', counterTop: 'quartz_white', underCabinetLight: true },
      { kind: 'cabinet', localCol: 2, localRow: 0, face: 'n', template: 'base_door_drawer',
        skin: 'oak_natural', counterTop: 'quartz_white', underCabinetLight: true },
      { kind: 'shelf', localCol: 1, localRow: 0, face: 'n', template: 'floating_single',
        skin: 'oak_natural', verticalAnchor: 'top' },
      { kind: 'shelf', localCol: 2, localRow: 0, face: 'n', template: 'floating_single',
        skin: 'oak_natural', verticalAnchor: 'top' },
      { kind: 'fixture', localCol: 1, localRow: 0, face: 'n', template: 'sink_kitchen_single' },
      { kind: 'fixture', localCol: 2, localRow: 0, face: 'n', template: 'range_4burner' },
      { kind: 'fixture', localCol: 2, localRow: 1, face: 'e', template: 'fridge_freezer_top',
        reason: 'Fridge on east end — completes the L-shape triangle.' },
    ],
    floorSurface: 'Wood_Hinoki',
    wallColorHex: '#f5f5f4',
  },

  // ────────────────────────────────────────────────────────────────────
  // KITCHEN — ISLAND + OPEN-PLAN (Kalkin Quik House)
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'kitchen_island_open',
    label: 'Island Kitchen',
    hint: 'Galley run + central island with bar stools — Kalkin Quik House.',
    designNote:
      'Adam Kalkin Quik House inspiration: 12 ft (≈ 3.6 m) island as focal point. ' +
      'Galley run on north wall, island parallel with bar-stool seating on south side. ' +
      'Concrete floor + stainless finishes echo the industrial container language.',
    cols: 4,
    rows: 2,
    approxAreaM2: 19.8,
    furniture: [
      { type: FurnitureType.KitchenIsland, localCol: 1, localRow: 1, dx: 0, dz: -0.3, rotation: 0,
        reason: 'Island centered in the body, 0.3m forward of south wall for circulation.' },
      { type: FurnitureType.BarStool, localCol: 1, localRow: 1, dx: -0.6, dz: +0.3, rotation: 0 },
      { type: FurnitureType.BarStool, localCol: 2, localRow: 1, dx: -0.3, dz: +0.3, rotation: 0 },
      { type: FurnitureType.BarStool, localCol: 2, localRow: 1, dx: +0.3, dz: +0.3, rotation: 0 },
    ],
    overlays: [
      { kind: 'cabinet', localCol: 1, localRow: 0, face: 'n', template: 'base_2door', skin: 'painted_black_modern', counterTop: 'concrete_polished', underCabinetLight: true },
      { kind: 'cabinet', localCol: 2, localRow: 0, face: 'n', template: 'base_door_drawer', skin: 'painted_black_modern', counterTop: 'concrete_polished', underCabinetLight: true },
      { kind: 'shelf', localCol: 1, localRow: 0, face: 'n', template: 'floating_single', skin: 'painted_black_modern', verticalAnchor: 'top' },
      { kind: 'shelf', localCol: 2, localRow: 0, face: 'n', template: 'floating_single', skin: 'painted_black_modern', verticalAnchor: 'top' },
      // Sink + range share the middle two voxels (one fixture per face); appliances at the ends own their own voxel face.
      { kind: 'fixture', localCol: 1, localRow: 0, face: 'n', template: 'sink_kitchen_double' },
      { kind: 'fixture', localCol: 2, localRow: 0, face: 'n', template: 'range_6burner', reason: 'Pro range — open plan reads as restaurant-quality kitchen.' },
      { kind: 'fixture', localCol: 0, localRow: 0, face: 'n', template: 'fridge_french_door', verticalAnchor: 'mid' },
      { kind: 'fixture', localCol: 3, localRow: 0, face: 'n', template: 'dishwasher' },
    ],
    floorSurface: 'Concrete',
    wallColorHex: '#f5f5f4',
  },

  // ────────────────────────────────────────────────────────────────────
  // BATHROOM — COMPACT 5×8 (wet-wall convention)
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'bath_compact_5x8',
    label: 'Compact 5×8 Bath',
    hint: 'Single-wall plumbing: vanity + toilet + shower along one wall.',
    designNote:
      'Standard 5×8 (1.5 × 2.4 m) builder layout — vanity (30") + toilet (24") + shower (36") ' +
      'along the east wet wall (single plumbing stack ≈ 30% labor savings). 30" walking aisle on ' +
      'the west side per IRC. Sink adjacent to toilet for handwashing convenience.',
    cols: 1,
    rows: 2,
    approxAreaM2: 4.95,
    furniture: [],
    overlays: [
      { kind: 'cabinet', localCol: 0, localRow: 0, face: 'e', template: 'bathroom_vanity',
        skin: 'shaker_white', counterTop: 'quartz_white',
        reason: 'Vanity at north end of wet wall.' },
      { kind: 'fixture', localCol: 0, localRow: 0, face: 'e', template: 'sink_vessel',
        verticalAnchor: 'mid', reason: 'Vessel sink on top of vanity counter.' },
      { kind: 'decor', localCol: 0, localRow: 0, face: 'e', template: 'mirror_rectangular',
        skin: 'frame_thin_chrome', verticalAnchor: 'top',
        reason: 'Mirror above vanity per IRC (60" min from finished floor).' },
      { kind: 'fixture', localCol: 0, localRow: 1, face: 'e', template: 'toilet_standard',
        reason: 'Toilet center 18" from any obstruction (NKBA).' },
      { kind: 'fixture', localCol: 0, localRow: 1, face: 's', template: 'shower_stall',
        reason: '36×36 walk-in shower at south end — floor-anchored.' },
    ],
    floorSurface: 'Concrete',
    wallColorHex: '#fafaf9',
  },

  // ────────────────────────────────────────────────────────────────────
  // BATHROOM — MASTER (separate tub + walk-in shower + double vanity)
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'bath_master',
    label: 'Master Bath',
    hint: 'Double vanity + tub + walk-in shower + private toilet.',
    designNote:
      'Double-bay master bath, wet wall on east. Tub at south, separate shower at center, ' +
      'double vanity at north. Toilet on west wall behind half-partition (privacy without door).',
    cols: 2,
    rows: 2,
    approxAreaM2: 9.9,
    furniture: [],
    overlays: [
      { kind: 'cabinet', localCol: 0, localRow: 0, face: 'n', template: 'bathroom_vanity',
        skin: 'walnut_dark', counterTop: 'marble_carrara',
        reason: 'Double-vanity body — left half.' },
      { kind: 'cabinet', localCol: 1, localRow: 0, face: 'n', template: 'bathroom_vanity',
        skin: 'walnut_dark', counterTop: 'marble_carrara',
        reason: 'Double-vanity body — right half.' },
      { kind: 'fixture', localCol: 0, localRow: 0, face: 'n', template: 'sink_vessel', verticalAnchor: 'mid' },
      { kind: 'fixture', localCol: 1, localRow: 0, face: 'n', template: 'sink_vessel', verticalAnchor: 'mid' },
      { kind: 'decor', localCol: 0, localRow: 0, face: 'n', template: 'mirror_rectangular',
        skin: 'frame_brass', verticalAnchor: 'top' },
      { kind: 'decor', localCol: 1, localRow: 0, face: 'n', template: 'mirror_rectangular',
        skin: 'frame_brass', verticalAnchor: 'top' },
      { kind: 'fixture', localCol: 1, localRow: 1, face: 'e', template: 'shower_stall',
        reason: 'Walk-in shower — east wall (wet wall).' },
      { kind: 'fixture', localCol: 0, localRow: 1, face: 's', template: 'bathtub_alcove',
        reason: 'Soaker tub at south end.' },
      { kind: 'fixture', localCol: 0, localRow: 1, face: 'w', template: 'toilet_wall_hung',
        reason: 'Wall-hung toilet — modern, partition-friendly.' },
    ],
    floorSurface: 'Wood_Hinoki',
    wallColorHex: '#fafaf9',
  },

  // ────────────────────────────────────────────────────────────────────
  // BEDROOM — MASTER (queen bed centered, nightstands, dresser)
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'bedroom_master',
    label: 'Master Bedroom',
    hint: 'Queen centered, flanking nightstands, dresser opposite, wardrobe.',
    designNote:
      'Apartment Therapy default: queen bed centered on the long wall opposite the door, ' +
      'with 36" comfortable clearance on both sides. Nightstands flank the bed; dresser opposite ' +
      'matches headboard width; wardrobe on west wall serves as closet. Defaults to the upper ' +
      'level — Susanka "specialized spaces" pattern places sleeping zones above living zones for ' +
      'privacy + acoustic separation.',
    defaultLevel: 1,
    cols: 3,
    rows: 2,
    approxAreaM2: 14.9,
    furniture: [
      { type: FurnitureType.Bed, localCol: 1, localRow: 0, dx: 0, dz: 0.2, rotation: 0,
        reason: 'Queen centered, headboard against north wall, foot toward south.' },
      { type: FurnitureType.Nightstand, localCol: 0, localRow: 0, dx: 0.4, dz: 0.2, rotation: 0,
        reason: 'West nightstand, sleeper-side reach.' },
      { type: FurnitureType.Nightstand, localCol: 2, localRow: 0, dx: -0.4, dz: 0.2, rotation: 0,
        reason: 'East nightstand.' },
      { type: FurnitureType.Dresser, localCol: 1, localRow: 1, dx: 0, dz: 0.3, rotation: 0,
        reason: 'Dresser centered on south wall, 30" from bed foot.' },
      { type: FurnitureType.FloorLamp, localCol: 2, localRow: 1, dx: 0.3, dz: -0.3, rotation: 0,
        reason: 'Reading corner lamp at southeast.' },
      { type: FurnitureType.Armchair, localCol: 0, localRow: 1, dx: 0.3, dz: -0.3, rotation: Math.PI / 2,
        reason: 'Reading chair at southwest, paired with floor lamp.' },
    ],
    overlays: [
      { kind: 'cabinet', localCol: 0, localRow: 0, face: 'w', template: 'tall_pantry',
        skin: 'walnut_dark', verticalAnchor: 'mid',
        reason: 'Wardrobe on west wall (using tall_pantry as a stand-in tall closet).' },
      { kind: 'decor', localCol: 1, localRow: 0, face: 'n', template: 'framed_picture_landscape',
        skin: 'frame_walnut', verticalAnchor: 'top', pictureLight: true,
        reason: 'Art over headboard, picture-lit.' },
    ],
    floorSurface: 'Wood_Hinoki',
    wallColorHex: '#e7e5e4',
  },

  // ────────────────────────────────────────────────────────────────────
  // BEDROOM — STUDIO (Susanka push-against-side-wall recovery)
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'bedroom_studio',
    label: 'Studio Bedroom',
    hint: 'Bed against side wall (Susanka recovery), wardrobe, small desk.',
    designNote:
      'Susanka-style space recovery: queen bed pushed against the EAST side wall (single sleeper), ' +
      'leaving the entire west half open for wardrobe + desk + circulation. Apartment Therapy ' +
      'minimum-clearance principle: 30" on the access side only.',
    cols: 2,
    rows: 2,
    approxAreaM2: 9.9,
    furniture: [
      { type: FurnitureType.Bed, localCol: 1, localRow: 0, dx: 0.3, dz: 0.2, rotation: Math.PI / 2,
        reason: 'Queen long-edge against east wall — Susanka recovery for single sleeper.' },
      { type: FurnitureType.Nightstand, localCol: 1, localRow: 1, dx: 0.4, dz: 0, rotation: 0,
        reason: 'Single nightstand at foot — only one access side needed.' },
      { type: FurnitureType.Wardrobe, localCol: 0, localRow: 0, dx: -0.3, dz: 0, rotation: Math.PI / 2,
        reason: 'Wardrobe long-edge against west wall, opens into the open half.' },
      { type: FurnitureType.Desk, localCol: 0, localRow: 1, dx: 0, dz: 0.3, rotation: 0,
        reason: 'Compact desk at southwest — work-from-home corner.' },
      { type: FurnitureType.OfficeChair, localCol: 0, localRow: 1, dx: 0, dz: -0.1 },
    ],
    overlays: [
      { kind: 'decor', localCol: 0, localRow: 1, face: 'w', template: 'mirror_rectangular',
        skin: 'frame_thin_chrome', verticalAnchor: 'mid',
        reason: 'Full-length mirror over the desk wall.' },
    ],
    floorSurface: 'Wood_Hinoki',
    wallColorHex: '#e7e5e4',
  },

  // ────────────────────────────────────────────────────────────────────
  // LIVING ROOM
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'living_room',
    label: 'Living Room',
    hint: 'Sectional + coffee table + TV unit + accent chair + lamp + plant.',
    designNote:
      '"Conversation triangle" 6-10 ft sofa-to-TV (here ≈ 3 m). Coffee table 14-18" (0.4 m) from ' +
      'sofa front. TV centered on long wall opposite seating.',
    cols: 3,
    rows: 2,
    approxAreaM2: 14.9,
    furniture: [
      { type: FurnitureType.Sectional, localCol: 1, localRow: 1, dx: 0, dz: 0.3, rotation: 0,
        reason: 'Sectional centered on south wall, facing TV.' },
      { type: FurnitureType.CoffeeTable, localCol: 1, localRow: 1, dx: 0, dz: -0.4 },
      { type: FurnitureType.Armchair, localCol: 2, localRow: 0, dx: 0.4, dz: 0, rotation: -Math.PI / 2,
        reason: 'Accent chair at east, perpendicular to sofa for conversation.' },
      { type: FurnitureType.SideTable, localCol: 2, localRow: 0, dx: 0, dz: 0 },
      { type: FurnitureType.FloorLamp, localCol: 0, localRow: 0, dx: -0.3, dz: -0.3,
        reason: 'Floor lamp at northwest reading corner.' },
      { type: FurnitureType.Plant, localCol: 0, localRow: 1, dx: -0.4, dz: 0.4 },
      { type: FurnitureType.Rug, localCol: 1, localRow: 1, dx: 0, dz: 0,
        reason: 'Rug under sectional anchors the seating zone.' },
    ],
    overlays: [
      { kind: 'decor', localCol: 1, localRow: 0, face: 'n', template: 'tv_55',
        skin: 'no_frame', verticalAnchor: 'mid' },
      { kind: 'shelf', localCol: 0, localRow: 0, face: 'n', template: 'wall_unit_3',
        skin: 'walnut_dark', verticalAnchor: 'mid' },
      { kind: 'shelf', localCol: 2, localRow: 0, face: 'n', template: 'wall_unit_3',
        skin: 'walnut_dark', verticalAnchor: 'mid' },
    ],
    floorSurface: 'Wood_Hinoki',
    wallColorHex: '#e7e5e4',
  },

  // ────────────────────────────────────────────────────────────────────
  // OPEN PLAN — KITCHEN + LIVING + DINING (Susanka's "kitchen as heart")
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'open_plan_klr',
    label: 'Open Plan K+L+R',
    hint: 'Kitchen island, dining, living all in one — Susanka principle.',
    designNote:
      'Sarah Susanka, "Not So Big House": kitchen as heart, no formal walls. ' +
      'Kitchen run on north, island parallel with bar stools, dining table center, sectional + ' +
      'TV at south. All within one open volume — Kalkin floor-to-ceiling glass aesthetic.',
    cols: 4,
    rows: 2,
    approxAreaM2: 19.8,
    furniture: [
      // Dining nook (central)
      { type: FurnitureType.DiningTable, localCol: 1, localRow: 1, dx: 0.5, dz: 0.2, rotation: 0 },
      { type: FurnitureType.DiningChair, localCol: 1, localRow: 1, dx: -0.2, dz: 0.0, rotation: 0 },
      { type: FurnitureType.DiningChair, localCol: 1, localRow: 1, dx: -0.2, dz: 0.4, rotation: 0 },
      { type: FurnitureType.DiningChair, localCol: 2, localRow: 1, dx: -0.2, dz: 0.0, rotation: Math.PI },
      { type: FurnitureType.DiningChair, localCol: 2, localRow: 1, dx: -0.2, dz: 0.4, rotation: Math.PI },
      // Kitchen island
      { type: FurnitureType.KitchenIsland, localCol: 1, localRow: 0, dx: 0.3, dz: 0.3, rotation: 0 },
      // Living end
      { type: FurnitureType.Sectional, localCol: 3, localRow: 1, dx: 0, dz: 0.3, rotation: 0 },
      { type: FurnitureType.CoffeeTable, localCol: 3, localRow: 1, dx: 0, dz: -0.3 },
      { type: FurnitureType.Plant, localCol: 3, localRow: 0, dx: 0.4, dz: 0.4 },
      { type: FurnitureType.Rug, localCol: 3, localRow: 1 },
    ],
    overlays: [
      // Open-plan kitchen run on the north wall (cols 0-1, row 0). Spread
      // sink/range/fridge across distinct voxel faces so each gets its own
      // overlay slot.
      { kind: 'cabinet', localCol: 0, localRow: 0, face: 'n', template: 'base_2door', skin: 'walnut_dark', counterTop: 'soapstone', underCabinetLight: true },
      { kind: 'shelf', localCol: 0, localRow: 0, face: 'n', template: 'floating_single', skin: 'walnut_dark', verticalAnchor: 'top' },
      { kind: 'fixture', localCol: 0, localRow: 0, face: 'n', template: 'sink_kitchen_double' },
      { kind: 'fixture', localCol: 1, localRow: 0, face: 'n', template: 'fridge_french_door', verticalAnchor: 'mid' },
      // TV at far east end
      { kind: 'decor', localCol: 3, localRow: 0, face: 'n', template: 'tv_75',
        skin: 'no_frame', verticalAnchor: 'mid' },
    ],
    floorSurface: 'Concrete',
    wallColorHex: '#f5f5f4',
  },

  // ────────────────────────────────────────────────────────────────────
  // HOME OFFICE
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'home_office',
    label: 'Home Office',
    hint: 'Desk, monitor, ergonomic chair, bookshelves, file storage.',
    designNote:
      'Susanka "specialized spaces" principle: a small purposeful work room beats a corner of the ' +
      'living room. Desk centered against north wall (window over desk for natural light per Apartment ' +
      'Therapy guidance). Bookshelves flanking. Office chair with 36" desk-to-bookshelf clearance for ' +
      'chair roll-back.',
    cols: 2,
    rows: 2,
    approxAreaM2: 9.9,
    furniture: [
      { type: FurnitureType.Desk, localCol: 0, localRow: 0, dx: 0.5, dz: 0.3, rotation: 0,
        reason: 'Desk against north wall, centered between two bookshelves.' },
      { type: FurnitureType.Monitor, localCol: 0, localRow: 0, dx: 0.5, dz: 0.4 },
      { type: FurnitureType.OfficeChair, localCol: 1, localRow: 0, dx: -0.3, dz: -0.1 },
      { type: FurnitureType.Armchair, localCol: 0, localRow: 1, dx: 0, dz: 0, rotation: Math.PI / 2,
        reason: 'Reading chair for client meetings or call breaks.' },
      { type: FurnitureType.FloorLamp, localCol: 1, localRow: 1, dx: 0.3, dz: 0.3 },
    ],
    overlays: [
      { kind: 'shelf', localCol: 0, localRow: 0, face: 'w', template: 'wall_unit_5',
        skin: 'oak_natural', verticalAnchor: 'mid' },
      { kind: 'shelf', localCol: 1, localRow: 0, face: 'e', template: 'wall_unit_5',
        skin: 'oak_natural', verticalAnchor: 'mid' },
    ],
    floorSurface: 'Wood_Hinoki',
    wallColorHex: '#e7e5e4',
  },

  // ────────────────────────────────────────────────────────────────────
  // LAUNDRY / MUDROOM
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'laundry_mudroom',
    label: 'Laundry + Mudroom',
    hint: 'Washer + dryer + utility sink + bench + storage.',
    designNote:
      'Side-by-side washer/dryer on east wall — shares wet wall with bathroom plumbing stack if ' +
      'placed adjacent (single-stack savings, same logic as the 5×8 bath wet wall convention). ' +
      'Bench + hook strip on west wall for mudroom function.',
    cols: 1,
    rows: 2,
    approxAreaM2: 4.95,
    furniture: [
      { type: FurnitureType.Washer, localCol: 0, localRow: 0, dx: 0.5, dz: 0.2, rotation: 0 },
      { type: FurnitureType.Dryer, localCol: 0, localRow: 0, dx: 0.5, dz: -0.3, rotation: 0 },
      { type: FurnitureType.Storage, localCol: 0, localRow: 1, dx: 0.5, dz: 0,
        reason: 'Tall storage cabinet for cleaning supplies.' },
    ],
    overlays: [
      { kind: 'fixture', localCol: 0, localRow: 1, face: 'w', template: 'sink_pedestal',
        reason: 'Utility sink for hand-rinse / mop fill.' },
    ],
    floorSurface: 'Concrete',
    wallColorHex: '#fafaf9',
  },

  // ────────────────────────────────────────────────────────────────────
  // WALK-IN CLOSET
  // ────────────────────────────────────────────────────────────────────
  {
    id: 'walk_in_closet',
    label: 'Walk-in Closet',
    hint: 'Wardrobes on three walls, mirror, vanity bench.',
    designNote:
      'Susanka "purposeful connections" — closet adjacent to bedroom rather than embedded, freeing ' +
      'the bedroom for clearance around the bed. Three-wall walk-in: hanging on east + west, drawers ' +
      '+ shelves on north. Vanity at center for grooming; full-length mirror on south wall.',
    cols: 1,
    rows: 2,
    approxAreaM2: 4.95,
    furniture: [
      { type: FurnitureType.Vanity, localCol: 0, localRow: 1, dx: 0, dz: 0, rotation: 0 },
      { type: FurnitureType.OfficeChair, localCol: 0, localRow: 1, dx: 0, dz: -0.3,
        reason: 'Vanity stool — using OfficeChair as small upholstered stool stand-in.' },
    ],
    overlays: [
      { kind: 'cabinet', localCol: 0, localRow: 0, face: 'w', template: 'tall_pantry',
        skin: 'walnut_dark', verticalAnchor: 'mid',
        reason: 'Wardrobe on west wall.' },
      { kind: 'cabinet', localCol: 0, localRow: 0, face: 'e', template: 'tall_pantry',
        skin: 'walnut_dark', verticalAnchor: 'mid',
        reason: 'Wardrobe on east wall.' },
      { kind: 'cabinet', localCol: 0, localRow: 0, face: 'n', template: 'dresser_6drawer',
        skin: 'walnut_dark', verticalAnchor: 'bottom' },
      { kind: 'decor', localCol: 0, localRow: 1, face: 's', template: 'mirror_rectangular',
        skin: 'frame_thin_chrome', verticalAnchor: 'mid' },
    ],
    floorSurface: 'Wood_Hinoki',
    wallColorHex: '#fafaf9',
  },
];

export function getRoomPreset(id: RoomPresetId): RoomPreset | undefined {
  return ROOM_PRESETS.find((p) => p.id === id);
}
