// ============================================================
// ModuHome — Core Type Definitions
// ============================================================

// ── Container Sizing ────────────────────────────────────────

export enum ContainerSize {
  /** 6.06m x 2.44m x 2.59m */
  Standard20 = "20ft_standard",
  /** 12.19m x 2.44m x 2.59m */
  Standard40 = "40ft_standard",
  /** 12.19m x 2.44m x 2.90m */
  HighCube40 = "40ft_high_cube",
}

/** Physical dimensions in metres */
export interface ContainerDimensions {
  length: number;
  width: number;
  height: number;
}

export const CONTAINER_DIMENSIONS: Record<ContainerSize, ContainerDimensions> = {
  [ContainerSize.Standard20]: { length: 6.06, width: 2.44, height: 2.59 },
  [ContainerSize.Standard40]: { length: 12.19, width: 2.44, height: 2.59 },
  [ContainerSize.HighCube40]: { length: 12.19, width: 2.44, height: 2.90 },
};

/** Number of 1.5m bays per long wall */
export const LONG_WALL_BAYS: Record<ContainerSize, number> = {
  [ContainerSize.Standard20]: 4,
  [ContainerSize.Standard40]: 8,
  [ContainerSize.HighCube40]: 8,
};

/** Short walls always have 2 bays */
export const SHORT_WALL_BAYS = 2;

// ── Wall & Bay System ───────────────────────────────────────

export enum WallSide {
  Front = "front",   // short wall (door end)
  Back = "back",     // short wall (opposite end)
  Left = "left",     // long wall
  Right = "right",   // long wall
}

export enum ModuleType {
  PanelSolid = "panel_solid",
  PanelGlass = "panel_glass",
  HingedWall = "hinged_wall",
  OpenVoid = "open_void",
}

export enum GlassVariant {
  FixedWindow = "fixed_window",
  SlidingDoor = "sliding_door",
}

/** Base interface shared by every bay module */
interface ModuleBase {
  id: string;
  type: ModuleType;
  cost_factor: number;
  /** Optional hex color override (e.g., "#8B4513") */
  color?: string;
}

/** Default corrugated steel panel */
export interface PanelSolid extends ModuleBase {
  type: ModuleType.PanelSolid;
}

/** Fixed window or sliding glass door */
export interface PanelGlass extends ModuleBase {
  type: ModuleType.PanelGlass;
  variant: GlassVariant;
}

/** The critical hinged wall — supports fold down, fold up, or gull-wing */
export interface HingedWall extends ModuleBase {
  type: ModuleType.HingedWall;
  foldsDown: boolean;
  foldsUp: boolean;
  /** When both foldsDown & foldsUp: false = half-height split, true = full-height leaves */
  gullFull: boolean;
  /** Current animation state 0 = closed, 1 = fully open */
  openAmount: number;
  /** What's on the outer edge (far side) of the deployed deck/awning */
  outerWall: 'railing' | 'glass' | 'solid' | 'closet' | 'none';
  /** What's on the side edges (left/right) of the deployed extension. Defaults to outerWall if not set. */
  sideWall?: 'railing' | 'glass' | 'solid' | 'closet' | 'none';
}

/** Open void — wall segment fully removed */
export interface OpenVoid extends ModuleBase {
  type: ModuleType.OpenVoid;
}

export type WallModule = PanelSolid | PanelGlass | HingedWall | OpenVoid;

/** A single bay slot in a wall */
export interface BaySlot {
  index: number;
  module: WallModule;
  /** When true, this bay is exempt from "Apply to Entire Wall" */
  locked?: boolean;
}

/** Full wall configuration */
export interface WallConfig {
  side: WallSide;
  bays: BaySlot[];
}

// ── Interior Light Placement ────────────────────────────────

export interface LightPlacement {
  voxelIndex: number;
  type: 'ceiling' | 'lamp';
}

// ── Container ───────────────────────────────────────────────

export type ContainerID = string; // UUID v4

export interface ContainerPosition {
  x: number;
  y: number;
  z: number;
}

/** Minimum supported stacking level (-1 = basement) */
export const MIN_STACK_LEVEL = -1;
/** Maximum supported stacking levels (0 = ground, 3 = fourth floor) */
export const MAX_STACK_LEVEL = 3;

export interface Container {
  id: ContainerID;
  name: string;
  size: ContainerSize;
  position: ContainerPosition;
  /** Rotation around Y axis in radians */
  rotation: number;

  // ── Vertical Stacking (Structural Graph) ──────────────────
  /** 0 = Ground, 1 = Second Floor, etc. */
  level: number;
  /** ID of the container directly below this one (null if on ground) */
  stackedOn: ContainerID | null;
  /** IDs of containers stacked on top of this one */
  supporting: ContainerID[];

  // ── Wall Configuration (The "Smart Skin") ─────────────────
  walls: {
    [WallSide.Front]: WallConfig;
    [WallSide.Back]: WallConfig;
    [WallSide.Left]: WallConfig;
    [WallSide.Right]: WallConfig;
  };
  /** Whether the roof is intact or removed (for stacking / open-air) */
  roofRemoved: boolean;
  /** Whether the main floor is removed (for double/triple-height Great Room atrium) */
  floorRemoved: boolean;
  /** Floor surface material. Defaults to interior wood if undefined. */
  floorMaterial?: FloorMaterialType;
  /** Ceiling/roof underside material. Defaults to steel if undefined. */
  ceilingMaterial?: FloorMaterialType;

  // ── Structural Frame Visibility ─────────────────────────────
  /** Per-container structural frame visibility overrides */
  structureConfig?: {
    /** Hidden beam/post keys, e.g. "top_front", "post_front_left" */
    hiddenElements: string[];
  };

  // ── Corner Configuration ────────────────────────────────────
  /** Per-corner configuration overrides (indexed by corner name: front_right, front_left, back_right, back_left) */
  cornerConfig?: Record<string, CornerConfig>;

  // ── Grouping & Adjacency ──────────────────────────────────
  /** Zone/group this container belongs to (null if ungrouped) */
  groupId: string | null;
  /** IDs of wall bays that are invisible due to adjacency merging */
  mergedWalls: string[];
  /** Original face materials saved before auto-merge (key: "voxelIndex:face") */
  _preMergeWalls?: Record<string, SurfaceType>;
  /** Original body wall faces saved before extension auto-door (key: "voxelIndex:face") */
  _preExtensionDoors?: Record<string, SurfaceType>;
  /** Original face surfaces saved before smart auto-railing (key: "voxelIndex:face").
   *  Auto-railings are placed on fall-hazard edges (open-air + exposed).
   *  Excluded from persist (recomputed on hydration), included in temporal (undo). */
  _smartRailingChanges?: Record<string, SurfaceType>;

  // ── Smart Frame Configuration ────────────────────────────
  /** Container-level default style for all frame elements (poles + rails) */
  frameDefaults?: {
    poleMaterial?: string;
    poleShape?: string;
    railMaterial?: string;
    railShape?: string;
  };
  /** Per-pole overrides keyed by "l{level}r{row}c{col}_{corner}" */
  poleOverrides?: Record<string, PoleConfig>;
  /** Per-rail overrides keyed by "r{row}c{col}_{h|v}" */
  railOverrides?: Record<string, ElementConfig>;

  // ── Interior / Furniture ──────────────────────────────────
  /** Interior light placements */
  lights?: LightPlacement[];
  /** Furniture items placed inside this container */
  furniture: FurnitureItem[];

  // ── Voxel Skin Grid ─────────────────────────────────────
  /**
   * 64-voxel skin grid (VOXEL_COUNT elements).
   * Index formula: level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col
   * Omitted until first edit for backward compat with saved JSON.
   */
  voxelGrid?: Voxel[];

  /** Container preset ID that was applied (e.g. 'studio_apartment') — informational only */
  appliedPreset?: string;

  /** Container role ID (e.g. 'bedroom', 'kitchen') — set by applyContainerRole */
  appliedRole?: string;

  /** Interior finish level for this container */
  interiorFinish?: 'raw' | 'plywood' | 'drywall' | 'painted';

  /** Subterranean container (pool) — placed below ground level */
  subterranean?: boolean;

  /** Roof locked when another container is stacked on top — prevents editing L1 roof faces */
  roofLocked?: boolean;
}

// ── Voxel Skin System ────────────────────────────────────────
// 64 voxels per container: 4 rows × 8 cols × 2 levels (floor + roof)
// Row 0 = left-wall deck perimeter, Rows 1-2 = core interior, Row 3 = right-wall deck perimeter

export type SurfaceType =
  | 'Open'           // invisible / no surface
  | 'Solid_Steel'    // corrugated steel panel (theme-mapped)
  | 'Glass_Pane'     // transparent glass wall
  | 'Railing_Glass'  // glass balustrade + handrail
  | 'Railing_Cable'  // post + cable railing
  | 'Deck_Wood'      // horizontal timber planking
  | 'Concrete'       // cast-in-place concrete (subterranean)
  | 'Gull_Wing'      // split face: top half awning + bottom half deck
  | 'Half_Fold'      // half-height fold extension (1.45m)
  | 'Door'           // hinged steel door panel
  | 'Stairs'         // triggers stair geometry — treads ascend toward this face
  | 'Stairs_Down'    // treads descend FROM the applied face (high end at clicked face, low at opposite)
  | 'Wood_Hinoki'    // pale blond 檜 cedar — interior walls / ceiling planks
  | 'Floor_Tatami'   // woven grass-green mat with cream border — floor only
  | 'Wall_Washi'     // translucent rice-paper panel over thin steel frame
  | 'Glass_Shoji'    // white frosted sliding panel (diffuse transmission)
  | 'Window_Standard' // steel sill 0-0.9m, glass 0.9-2.1m, steel transom 2.1-2.6m
  | 'Window_Sill'     // steel 0-0.9m, glass sill-to-top
  | 'Window_Clerestory' // steel 0-2.0m, glass clerestory strip
  | 'Window_Half';    // steel bottom half, glass top half

/** Type guard: true for Railing_Glass or Railing_Cable surface types */
export const isRailingSurface = (s: SurfaceType): boolean =>
  s === 'Railing_Cable' || s === 'Railing_Glass';

/** Backward-compat alias — use SurfaceType for new code */
export type VoxelMaterial = SurfaceType;

export type DoorState = 'closed' | 'open_swing' | 'open_slide';

export interface DoorConfig {
  state: DoorState;
  hingeEdge: 'left' | 'right';
  swingDirection: 'in' | 'out';
  slideDirection: 'positive' | 'negative';
  type: 'swing' | 'slide';
}

/** Six inset face materials for one voxel cell */
export interface VoxelFaces {
  top:    SurfaceType;
  bottom: SurfaceType;
  n:      SurfaceType; // north face (toward Front wall, –Z)
  s:      SurfaceType; // south face (toward Back wall,  +Z)
  e:      SurfaceType; // east face  (toward Right wall, +X)
  w:      SurfaceType; // west face  (toward Left wall,  –X)
}

/** Stable empty faces constant — use as selector fallback to avoid inline object anti-pattern. */
export const EMPTY_FACES: VoxelFaces = {
  top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open',
};

/** Material definition for ghost preview — maps surface type to concrete material properties. */
export interface MaterialDef {
  surfaceType: SurfaceType;
  /** Key into _themeMats texture cache (e.g., 'steelCorrugated', 'oakPlanks') */
  textureId?: string;
  /** Hex color override (e.g., '#78716c' for custom paint) */
  color?: string;
  /** Finish metadata — doorStyle, glassTint, etc. */
  finishMeta?: Record<string, string>;
}

export interface Voxel {
  /** Whether this voxel is included in the scene (deck rows start inactive) */
  active: boolean;
  /** Semantic category for filtering */
  type: 'core' | 'deck' | 'roof';
  faces: VoxelFaces;
  /** Volumetric discriminator — 'stairs' renders 3D tread geometry inside the voxel */
  voxelType?: 'standard' | 'stairs';
  /** Direction treads ascend toward (toward active neighbor) */
  stairAscending?: 'n' | 's' | 'e' | 'w';
  /** Faces that are currently open (door swung, shoji slid) — for animated fenestration */
  openFaces?: Partial<Record<keyof VoxelFaces, boolean>>;
  /** Per-face door state: closed, open_swing (hinged 90°), open_slide (translate laterally) */
  doorStates?: Partial<Record<keyof VoxelFaces, DoorState>>;
  /** Per-face door configuration (smart placement, hinge side, swing direction) */
  doorConfig?: Partial<Record<keyof VoxelFaces, DoorConfig>>;
  /** 2-voxel staircase part: 'lower'=bottom half treads, 'upper'=top half treads, 'single'=legacy full-height */
  stairPart?: 'lower' | 'upper' | 'single';
  /** Module preset ID (e.g. 'kitchen_full') — set by applyModule */
  moduleId?: string;
  /** Module orientation — which direction the module's "inward" face points */
  moduleOrientation?: ModuleOrientation;
  /** User-assigned room label (e.g. 'Kitchen', 'Bedroom') — informational only */
  roomTag?: string;
  /** Faces explicitly set by the user (not auto-generated). Smart system preserves these.
   *  Only set to true; absent/false = auto-generated (eligible for Smart auto-removal). */
  userPaintedFaces?: Partial<Record<keyof VoxelFaces, boolean>>;
  /** Smart stair change tracking — stored on the LOWER stair voxel.
   *  Records all auto-modified faces so removeStairs can restore originals. */
  _smartStairChanges?: SmartStairChanges;
  /** Ephemeral animation phase for extension "unpacking" — cleared after animation completes.
   *  NOT persisted. Set by setAllExtensions, consumed by ExtensionUnpack component.
   *  - wall_to_floor: container wall swivels down on bottom hinge to become floor
   *  - wall_to_ceiling: container wall swivels up on top hinge to become ceiling
   *  - floor_slide: floor panel slides outward from container body
   *  - walls_deploy: side walls swivel outward from floor center
   *  - reverse: plays the entry animation in reverse (wall swivels back up/down) */
  unpackPhase?: 'wall_to_floor' | 'wall_to_ceiling' | 'floor_slide' | 'walls_deploy' | 'reverse';
  /** When unpackPhase='reverse', which original phase to reverse.
   *  Ephemeral — NOT persisted. Determines reverse animation style (top vs bottom hinge, etc.) */
  _reverseOriginalPhase?: 'wall_to_floor' | 'wall_to_ceiling' | 'floor_slide' | 'walls_deploy';
  /** Ephemeral flag — set by removeStairs to trigger telescope-retract exit animation.
   *  When true, StairTelescope plays isExiting=true. On completion, clearStairExit deletes stair data.
   *  NOT persisted. */
  _stairExiting?: boolean;
  /** Per-face finish overrides — absent values fall back to theme defaults */
  faceFinishes?: FaceFinishes;
}

/** Per-face finish overrides — absent values fall back to theme defaults */
export interface FaceFinish {
  material?: string;
  paint?: string;
  tint?: string;
  frameColor?: string;
  doorStyle?: string;
  light?: string;
  lightColor?: string;
  electrical?: string;
  color?: string;  // universal tint — applied on every face category
}

export type FaceFinishes = Partial<Record<keyof VoxelFaces, FaceFinish>>;

/** Tracks faces auto-modified by smart stair placement, keyed by "voxelIndex:face".
 *  Values are the original SurfaceType before the smart change.
 *  Stored on the lower stair voxel so removeStairs can restore originals. */
/** Per-pole configuration override for smart corner poles */
export interface PoleConfig {
  /** Whether this pole is visible (default: true, inherits from container) */
  visible?: boolean;
  /** Material override (default: inherit from frameDefaults.poleMaterial) */
  material?: string;
  /** Shape/model override (default: inherit from frameDefaults.poleShape) */
  shape?: string;
}

/** Configuration for a rail element (visibility, material, shape) */
export interface ElementConfig {
  visible?: boolean;
  material?: string;
  shape?: string;
}

export interface SmartStairChanges {
  /** Map of "voxelIndex:face" → original SurfaceType before smart modification */
  changedFaces: Record<string, SurfaceType>;
  /** Index of the upper stair voxel in the pair (for reverting both voxels) */
  upperVoxelIdx?: number;
  /** Ascending direction used when stairs were placed */
  ascending: 'n' | 's' | 'e' | 'w';
}

/** Union type for extension unpacking animation phases */
export type UnpackPhase = NonNullable<Voxel['unpackPhase']>;

export type ModuleOrientation = 'n' | 's' | 'e' | 'w';

export interface ModulePreset {
  id: string;
  label: string;
  category: 'living' | 'kitchen' | 'bathroom' | 'outdoor' | 'utility';
  icon: string;                // emoji
  faces: {
    inward: SurfaceType;       // toward room interior
    outward: SurfaceType;      // toward exterior
    left: SurfaceType;
    right: SurfaceType;
    floor: SurfaceType;
    ceiling: SurfaceType;
  };
  furnitureType?: FurnitureType;
  description?: string;
}

export type ExtensionConfig = 'none' | 'all_deck' | 'all_interior' | 'all_glass_interior' | 'north_deck' | 'south_deck' | 'east_deck' | 'west_deck';

/** Default extension configuration for newly created containers */
export const DEFAULT_EXTENSION_CONFIG: ExtensionConfig = 'all_deck';

export interface ContainerRole {
  id: string;
  label: string;
  icon: string;
  description: string;
  bodyModuleId: string;
  bodyOrientation: ModuleOrientation | 'auto';
  extensionConfig: ExtensionConfig | 'none';
  wallOverrides?: Partial<Record<'n' | 's' | 'e' | 'w', SurfaceType>>;
}

export const VOXEL_COLS   = 8;  // columns along container length
export const VOXEL_ROWS   = 4;  // rows across container width (0=left-deck, 1-2=core, 3=right-deck)
export const VOXEL_LEVELS = 2;  // 0=floor level, 1=roof level
export const VOXEL_COUNT  = VOXEL_COLS * VOXEL_ROWS * VOXEL_LEVELS; // 64

/** Core interior rows (always active) */
export const VOXEL_CORE_ROWS  = [1, 2] as const;
/** Deck perimeter rows (inactive until left/right wall is deployed) */
export const VOXEL_DECK_ROWS  = [0, 3] as const;
/** Core interior columns (1-6). Halo cols 0 & 7 extend beyond the steel frame ends. */
export const VOXEL_CORE_COLS  = [1, 2, 3, 4, 5, 6] as const;

// ── Floor / Ceiling Material Types ───────────────────────────

export type FloorMaterialType =
  | 'wood:light' | 'wood:cedar' | 'wood:dark'
  | 'concrete' | 'tile:white' | 'tile:dark'
  | 'steel' | 'bamboo';

// ── Corner Configuration ────────────────────────────────────

export interface CornerConfig {
  /** Corner post style */
  postType: 'solid' | 'cap' | 'empty';
  /** Override for the first outer edge (wall A side). If undefined, derives from adjacent bay outerWall. */
  edgeA?: 'railing' | 'glass' | 'solid' | 'closet' | 'none';
  /** Override for the second outer edge (wall B side). If undefined, derives from adjacent bay outerWall. */
  edgeB?: 'railing' | 'glass' | 'solid' | 'closet' | 'none';
}

/** Valid corner names */
export const CORNER_NAMES = ['front_right', 'front_left', 'back_right', 'back_left'] as const;
export type CornerName = typeof CORNER_NAMES[number];

// ── Furniture / Interior Items ───────────────────────────────

export enum FurnitureType {
  Stairs = "stairs",
  Kitchen = "kitchen",
  Bed = "bed",
  Bathroom = "bathroom",
  Sofa = "sofa",
  Desk = "desk",
  DiningTable = "dining_table",
  Storage = "storage",
  // Kitchen
  Fridge = "fridge",
  Stove = "stove",
  KitchenSink = "kitchen_sink",
  Microwave = "microwave",
  // Bedroom
  BedSingle = "bed_single",
  Nightstand = "nightstand",
  Dresser = "dresser",
  // Bathroom
  Bathtub = "bathtub",
  Shower = "shower",
  BathroomSink = "bathroom_sink",
  // Living
  Armchair = "armchair",
  CoffeeTable = "coffee_table",
  Bookshelf = "bookshelf",
  TVUnit = "tv_unit",
  Television = "television",
  // Office
  OfficeChair = "office_chair",
  Monitor = "monitor",
  // Utility
  Washer = "washer",
  Dryer = "dryer",
  // Decor
  Plant = "plant",
  FloorLamp = "floor_lamp",
  Rug = "rug",
}

export interface FurnitureDimensions {
  length: number; // X
  width: number;  // Z
  height: number; // Y
}

export interface FurnitureItem {
  id: string;
  type: FurnitureType;
  /** Position relative to the container origin (local space) */
  position: { x: number; y: number; z: number };
  /** Rotation around Y axis in radians (0, PI/2, PI, 3PI/2) */
  rotation: number;
  /** Which container this furniture belongs to */
  containerId: ContainerID;
}

/** Registry of furniture dimensions and display info */
export interface FurnitureCatalogEntry {
  type: FurnitureType;
  label: string;
  dims: FurnitureDimensions;
  color: number; // Display color for the fallback 3D box
  cost: number;
  /** Path to .glb model file (relative to /public). If missing, falls back to colored box. */
  glb?: string;
}

export const FURNITURE_CATALOG: FurnitureCatalogEntry[] = [
  // ── Core 8 (existing) ──
  { type: FurnitureType.Stairs,      label: "Staircase",      dims: { length: 1.52, width: 2.4, height: 2.6 }, color: 0x8d6e63, cost: 4500, glb: '/assets/furniture/stairs-open.glb' },
  { type: FurnitureType.Kitchen,     label: "Kitchen Counter", dims: { length: 3.0, width: 0.65, height: 0.9 }, color: 0x78909c, cost: 8000, glb: '/assets/furniture/kitchen-counter.glb' },
  { type: FurnitureType.Bed,         label: "Double Bed",      dims: { length: 2.0, width: 1.6, height: 0.5 },  color: 0xa1887f, cost: 1200, glb: '/assets/furniture/bedroom-bed-double.glb' },
  { type: FurnitureType.Bathroom,    label: "Toilet",          dims: { length: 0.7, width: 0.4, height: 0.8 },  color: 0x80cbc4, cost: 800,  glb: '/assets/furniture/bathroom-toilet.glb' },
  { type: FurnitureType.Sofa,        label: "Sofa",            dims: { length: 2.2, width: 0.9, height: 0.8 },  color: 0x9e9e9e, cost: 900,  glb: '/assets/furniture/living-sofa.glb' },
  { type: FurnitureType.Desk,        label: "Desk",            dims: { length: 1.4, width: 0.7, height: 0.75 }, color: 0xbcaaa4, cost: 500,  glb: '/assets/furniture/office-desk.glb' },
  { type: FurnitureType.DiningTable, label: "Dining Table",    dims: { length: 1.8, width: 0.9, height: 0.75 }, color: 0xd7ccc8, cost: 700,  glb: '/assets/furniture/dining-table.glb' },
  { type: FurnitureType.Storage,     label: "Storage Cabinet",  dims: { length: 1.0, width: 0.5, height: 2.0 },  color: 0xb0bec5, cost: 400,  glb: '/assets/furniture/storage-cabinet.glb' },
  // ── Kitchen ──
  { type: FurnitureType.Fridge,       label: "Refrigerator",   dims: { length: 0.7, width: 0.7, height: 1.8 },  color: 0xcfd8dc, cost: 1500, glb: '/assets/furniture/kitchen-fridge.glb' },
  { type: FurnitureType.Stove,        label: "Stove",          dims: { length: 0.6, width: 0.6, height: 0.9 },  color: 0x546e7a, cost: 1200, glb: '/assets/furniture/kitchen-stove.glb' },
  { type: FurnitureType.KitchenSink,  label: "Kitchen Sink",   dims: { length: 0.8, width: 0.5, height: 0.9 },  color: 0x90a4ae, cost: 600,  glb: '/assets/furniture/kitchen-sink.glb' },
  { type: FurnitureType.Microwave,    label: "Microwave",      dims: { length: 0.5, width: 0.35, height: 0.3 }, color: 0x37474f, cost: 300,  glb: '/assets/furniture/kitchen-microwave.glb' },
  // ── Bedroom ──
  { type: FurnitureType.BedSingle,    label: "Single Bed",     dims: { length: 2.0, width: 0.9, height: 0.5 },  color: 0xbcaaa4, cost: 800,  glb: '/assets/furniture/bedroom-bed-single.glb' },
  { type: FurnitureType.Nightstand,   label: "Nightstand",     dims: { length: 0.5, width: 0.4, height: 0.55 }, color: 0x8d6e63, cost: 200,  glb: '/assets/furniture/bedroom-nightstand.glb' },
  { type: FurnitureType.Dresser,      label: "Dresser",        dims: { length: 1.2, width: 0.5, height: 0.8 },  color: 0xa1887f, cost: 600,  glb: '/assets/furniture/bedroom-dresser.glb' },
  // ── Bathroom ──
  { type: FurnitureType.Bathtub,      label: "Bathtub",        dims: { length: 1.7, width: 0.75, height: 0.6 }, color: 0xe0e0e0, cost: 2000, glb: '/assets/furniture/bathroom-bathtub.glb' },
  { type: FurnitureType.Shower,       label: "Shower",         dims: { length: 0.9, width: 0.9, height: 2.2 },  color: 0xb0bec5, cost: 1500, glb: '/assets/furniture/bathroom-shower.glb' },
  { type: FurnitureType.BathroomSink, label: "Bathroom Sink",  dims: { length: 0.6, width: 0.45, height: 0.85 },color: 0xe0e0e0, cost: 400,  glb: '/assets/furniture/bathroom-sink.glb' },
  // ── Living ──
  { type: FurnitureType.Armchair,     label: "Armchair",       dims: { length: 0.9, width: 0.85, height: 0.85 },color: 0x8d6e63, cost: 500,  glb: '/assets/furniture/living-armchair.glb' },
  { type: FurnitureType.CoffeeTable,  label: "Coffee Table",   dims: { length: 1.1, width: 0.6, height: 0.45 }, color: 0xd7ccc8, cost: 350,  glb: '/assets/furniture/living-coffee-table.glb' },
  { type: FurnitureType.Bookshelf,    label: "Bookshelf",      dims: { length: 0.8, width: 0.35, height: 1.8 }, color: 0x795548, cost: 450,  glb: '/assets/furniture/living-bookshelf.glb' },
  { type: FurnitureType.TVUnit,       label: "TV Unit",        dims: { length: 1.5, width: 0.4, height: 0.5 },  color: 0x37474f, cost: 400,  glb: '/assets/furniture/living-tv-unit.glb' },
  { type: FurnitureType.Television,   label: "Television",     dims: { length: 1.1, width: 0.08, height: 0.65 },color: 0x212121, cost: 800,  glb: '/assets/furniture/living-television.glb' },
  // ── Office ──
  { type: FurnitureType.OfficeChair,  label: "Office Chair",   dims: { length: 0.6, width: 0.6, height: 1.1 },  color: 0x424242, cost: 350,  glb: '/assets/furniture/office-chair.glb' },
  { type: FurnitureType.Monitor,      label: "Monitor",        dims: { length: 0.6, width: 0.2, height: 0.45 }, color: 0x212121, cost: 400,  glb: '/assets/furniture/office-monitor.glb' },
  // ── Utility ──
  { type: FurnitureType.Washer,       label: "Washer",         dims: { length: 0.6, width: 0.6, height: 0.85 }, color: 0xeceff1, cost: 800,  glb: '/assets/furniture/utility-washer.glb' },
  { type: FurnitureType.Dryer,        label: "Dryer",          dims: { length: 0.6, width: 0.6, height: 0.85 }, color: 0xeceff1, cost: 700,  glb: '/assets/furniture/utility-dryer.glb' },
  // ── Decor ──
  { type: FurnitureType.Plant,        label: "Plant",          dims: { length: 0.4, width: 0.4, height: 0.8 },  color: 0x4caf50, cost: 100,  glb: '/assets/furniture/decor-plant.glb' },
  { type: FurnitureType.FloorLamp,    label: "Floor Lamp",     dims: { length: 0.35, width: 0.35, height: 1.6 },color: 0xffd54f, cost: 200,  glb: '/assets/furniture/decor-floor-lamp.glb' },
  { type: FurnitureType.Rug,          label: "Rug",            dims: { length: 2.0, width: 1.4, height: 0.02 }, color: 0x7b1fa2, cost: 300,  glb: '/assets/furniture/decor-rug.glb' },
];

// ── Zones & Grouping ────────────────────────────────────────

export interface Zone {
  id: string;
  name: string;
  /** Ordered list of container IDs in this zone */
  containerIds: string[];
  /** Pairs of container IDs that share a wall (auto-merged) */
  mergedWalls: Array<{
    containerA: string;
    containerB: string;
    sharedSide: WallSide;
  }>;
}

// ── Environment ─────────────────────────────────────────────

export interface EnvironmentSettings {
  /** 0 - 24 (fractional hours) */
  timeOfDay: number;
  /** 0 - 360 degrees — North offset */
  northOffset: number;
  /** Ground surface preset — optional for backwards compat */
  groundPreset?: string;
}

// ── View Modes ──────────────────────────────────────────────

export enum ViewMode {
  Realistic3D = "3d",
  Blueprint = "blueprint",
  Walkthrough = "walkthrough",
}

// ── Pricing ─────────────────────────────────────────────────

export interface PricingConfig {
  /** Base cost per container size */
  containerBase: Record<ContainerSize, number>;
  /** Cost per structural cut (bay opening) */
  cutFee: number;
  /** Module-level cost multipliers */
  moduleCosts: Record<ModuleType, number>;
  /** Per-bay glass upgrade surcharge */
  glassSurcharge: number;
  /** Hinged wall mechanism cost */
  hingeMechanism: number;
}

export interface PricingEstimate {
  low: number;
  high: number;
  breakdown: {
    containers: number;
    modules: number;
    cuts: number;
    sceneObjects?: number;
    total: number;
  };
}

// ── Root App State ──────────────────────────────────────────

export interface AppState {
  containers: Record<string, Container>;
  zones: Record<string, Zone>;
  environment: EnvironmentSettings;
  viewMode: ViewMode;
  pricing: PricingConfig;
  /** Currently selected container or zone IDs */
  selection: string[];
  /** All furniture items indexed by ID (denormalized for fast lookup) */
  furnitureIndex: Record<string, FurnitureItem>;
}

// ── Library / Saved Assets ─────────────────────────────────

/** A user-saved block configuration (single voxel face set) */
export interface LibraryBlock {
  id: string;
  label: string;
  faces: VoxelFaces;
  category: 'user';
  createdAt: number;
}

/** A user-saved full container template (size + voxel grid snapshot) */
export interface LibraryContainer {
  id: string;
  label: string;
  size: ContainerSize;
  voxelGrid: Voxel[];
  category: 'user';
  createdAt: number;
}

/** A user-saved multi-container home design */
export interface LibraryHomeDesign {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  containers: {
    size: ContainerSize;
    relativePosition: [number, number, number];
    voxelGrid: Voxel[];
    role?: string;
  }[];
  category: 'user';
  createdAt: number;
}

export type LibraryItem = LibraryBlock | LibraryContainer | LibraryHomeDesign;
