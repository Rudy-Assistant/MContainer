import type { ContainerArrangementId, SurfaceType, VoxelFaces } from '@/types/container';

export type ContainerArrangementOutcome =
  | 'enclosed'
  | 'covered_outdoor'
  | 'open_outdoor'
  | 'collapsed';

export type ContainerArrangementKind = 'retract' | 'structured';
export type ContainerArrangementScope = 'full_footprint' | 'extensions_only';
export type ContainerArrangementUpperLevelMode =
  | 'full_shell'        // upper level is an enclosed shell with floor + roof + (open) walls
  | 'clear_extensions'  // upper-level extensions deactivate; body keeps prior state
  | 'extensions_only'   // upper level is a wraparound terrace (extensions only)
  | 'deactivate';       // upper level fully removed — single-volume pavilion (atrium voids
                        //   in `voidRows/voidCols` become roof skylights in the L0 ceiling)
export type ExtensionDoorProfile = 'all_interior' | 'all_glass_interior';

export interface ContainerArrangementSpec {
  id: ContainerArrangementId;
  label: string;
  title: string;
  hint: string;
  outcome: ContainerArrangementOutcome;
  kind: ContainerArrangementKind;
  level0Scope?: ContainerArrangementScope;
  perimeterWall?: SurfaceType;
  upperPerimeterWall?: SurfaceType;
  roof?: SurfaceType;
  floor?: SurfaceType;
  upperLevelMode?: ContainerArrangementUpperLevelMode;
  upperLevelRoof?: SurfaceType;
  upperLevelFloor?: SurfaceType;
  extensionDoorProfile?: ExtensionDoorProfile;
  voidRows?: number[];
  voidCols?: number[];
  /** South-wall cols that should render as `Glass_Shoji` instead of the
   *  default perimeter wall — produces an operable sliding-glass entry on
   *  the front of the unit. Two adjacent values create the side-by-side
   *  pair of sliding doors a user expects on a glass pavilion. */
  doorCols?: number[];
  tags?: string[];
}

export interface ArrangementCellInput {
  level: number;
  row: number;
  col: number;
}

export interface ArrangementCellResult {
  active: boolean;
  faces: VoxelFaces;
}

function openFaces(): VoxelFaces {
  return { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' };
}

function isExtensionCell(row: number, col: number): boolean {
  return row === 0 || row === 3 || col === 0 || col === 7;
}

function isVoidCell(spec: ContainerArrangementSpec, row: number, col: number): boolean {
  return !!spec.voidRows?.includes(row) && !!spec.voidCols?.includes(col);
}

function perimeterFaces(
  row: number,
  col: number,
  wall: SurfaceType,
  top: SurfaceType,
  bottom: SurfaceType,
  doorCols?: number[],
): VoxelFaces {
  // South-wall door cells render as Glass_Shoji (operable sliding glass).
  const southSurface = row === 3
    ? (doorCols?.includes(col) ? 'Glass_Shoji' : wall)
    : 'Open';
  return {
    top,
    bottom,
    n: row === 0 ? wall : 'Open',
    s: southSurface,
    e: col === 7 ? wall : 'Open',
    w: col === 0 ? wall : 'Open',
  };
}

export const CONTAINER_ARRANGEMENT_SPECS: ContainerArrangementSpec[] = [
  {
    id: 'extend_shell',
    label: 'Shell',
    title: 'Extend shell',
    hint: 'Extend the exterior envelope while keeping a continuous enclosed roof.',
    outcome: 'enclosed',
    kind: 'structured',
    level0Scope: 'extensions_only',
    perimeterWall: 'Solid_Steel',
    roof: 'Solid_Steel',
    floor: 'Deck_Wood',
    upperLevelMode: 'clear_extensions',
    extensionDoorProfile: 'all_interior',
  },
  {
    id: 'max_closed',
    label: 'Max Box',
    title: 'Maximum closed interior',
    hint: 'Full enclosed volume with open interior seams and no leftover cross-walls.',
    outcome: 'enclosed',
    kind: 'structured',
    level0Scope: 'full_footprint',
    perimeterWall: 'Solid_Steel',
    roof: 'Solid_Steel',
    floor: 'Deck_Wood',
    upperLevelMode: 'full_shell',
    upperLevelRoof: 'Solid_Steel',
    upperLevelFloor: 'Solid_Steel',
    extensionDoorProfile: 'all_interior',
  },
  {
    id: 'largest_glass',
    label: 'Glass Box',
    title: 'Largest glass interior',
    hint: 'Habitable full-shell enclosure with glazed perimeter walls and a solid roof.',
    outcome: 'enclosed',
    kind: 'structured',
    level0Scope: 'full_footprint',
    perimeterWall: 'Glass_Pane',
    roof: 'Solid_Steel',
    floor: 'Deck_Wood',
    upperLevelMode: 'full_shell',
    upperLevelRoof: 'Solid_Steel',
    upperLevelFloor: 'Solid_Steel',
    extensionDoorProfile: 'all_glass_interior',
  },
  {
    id: 'central_atrium',
    label: 'Atrium',
    title: 'Central atrium',
    hint: 'Double-height central void with guarded upper edges and an enclosed perimeter shell.',
    outcome: 'enclosed',
    kind: 'structured',
    level0Scope: 'full_footprint',
    perimeterWall: 'Solid_Steel',
    roof: 'Solid_Steel',
    floor: 'Deck_Wood',
    upperLevelMode: 'full_shell',
    upperLevelRoof: 'Solid_Steel',
    upperLevelFloor: 'Solid_Steel',
    extensionDoorProfile: 'all_interior',
    voidRows: [1, 2],
    voidCols: [3, 4],
    tags: ['Void', 'Guarded'],
  },
  {
    // Framed glass box — full perimeter walls of `Window_Standard` (per-voxel
    // sill + glass + transom) so each voxel reads as its own framed pane and
    // the steel mullions visually connect to the corner posts as continuous
    // structural support. Two adjacent south-wall voxels render as Glass_Shoji
    // sliding doors for entry. Used as the L1 base for the Glass Atrium
    // Showcase — gives the "expensive curtain wall" look without resorting to
    // a single frameless pane.
    id: 'framed_glass_box',
    label: 'Framed Glass Box',
    title: 'Framed glass box with sliding entry',
    hint: 'Per-voxel framed glass walls and a pair of sliding glass entry doors on the south.',
    outcome: 'enclosed',
    kind: 'structured',
    level0Scope: 'full_footprint',
    perimeterWall: 'Window_Standard',
    roof: 'Solid_Steel',
    floor: 'Deck_Wood',
    upperLevelMode: 'deactivate',
    extensionDoorProfile: 'all_glass_interior',
    doorCols: [3, 4],
    tags: ['Glass', 'Framed', 'Entry'],
  },
  {
    // Framed-glass variant of central_atrium — same 2×2 floor void with
    // Railing_Cable, but the perimeter is Window_Standard instead of solid
    // steel. Used on the L2 deck of the Glass Atrium Showcase so each upper
    // container looks down through its own atrium opening while still showing
    // a per-voxel framed-glass envelope. Roof stays solid so the SR-07 smart
    // rule can promote the topmost containers to a walkable rooftop deck.
    id: 'framed_glass_atrium',
    label: 'Framed Glass Atrium',
    title: 'Framed glass walls with central floor void',
    hint: 'Per-voxel framed glass perimeter and a guarded central void looking down to the floor below.',
    outcome: 'enclosed',
    kind: 'structured',
    level0Scope: 'full_footprint',
    perimeterWall: 'Window_Standard',
    roof: 'Solid_Steel',
    floor: 'Deck_Wood',
    upperLevelMode: 'full_shell',
    upperLevelRoof: 'Solid_Steel',
    upperLevelFloor: 'Solid_Steel',
    extensionDoorProfile: 'all_glass_interior',
    voidRows: [1, 2],
    voidCols: [3, 4],
    tags: ['Glass', 'Framed', 'Void', 'Guarded'],
  },
  {
    id: 'glass_atrium',
    label: 'Glass Atrium',
    title: 'Glass atrium pavilion',
    hint: 'Single-volume glass pavilion with a central skylight in the roof.',
    outcome: 'enclosed',
    kind: 'structured',
    level0Scope: 'full_footprint',
    perimeterWall: 'Glass_Pane',
    roof: 'Solid_Steel',
    floor: 'Deck_Wood',
    // 'deactivate' makes this a SINGLE-VOLUME pavilion — the void cells punch
    // a skylight in the L0 ceiling rather than creating a redundant L1 shell.
    // Previously used 'full_shell' which produced a confusing two-layered look
    // when applied to a stacked container (visible bug 2026-04-25).
    upperLevelMode: 'deactivate',
    extensionDoorProfile: 'all_glass_interior',
    voidRows: [1, 2],
    voidCols: [3, 4],
    // Two adjacent south-wall cells render as Glass_Shoji — visually a pair
    // of side-by-side sliding panels, operable as a single entry.
    doorCols: [3, 4],
    tags: ['Glass', 'Void', 'Skylight'],
  },
  {
    id: 'roof_terrace',
    label: 'Roof Terrace',
    title: 'Roof terrace shell',
    hint: 'Enclosed lower volume with a usable upper terrace ring on the extension footprint.',
    outcome: 'enclosed',
    kind: 'structured',
    level0Scope: 'full_footprint',
    perimeterWall: 'Solid_Steel',
    roof: 'Solid_Steel',
    floor: 'Deck_Wood',
    upperLevelMode: 'extensions_only',
    upperPerimeterWall: 'Railing_Cable',
    upperLevelRoof: 'Open',
    upperLevelFloor: 'Deck_Wood',
    extensionDoorProfile: 'all_interior',
    tags: ['Terrace', 'Outdoor'],
  },
  {
    id: 'glass_terrace',
    label: 'Glass Terrace',
    title: 'Glass terrace shell',
    hint: 'Glass lower pavilion with an upper terrace ring and guarded exterior edges.',
    outcome: 'enclosed',
    kind: 'structured',
    level0Scope: 'full_footprint',
    perimeterWall: 'Glass_Pane',
    roof: 'Solid_Steel',
    floor: 'Deck_Wood',
    upperLevelMode: 'extensions_only',
    upperPerimeterWall: 'Railing_Cable',
    upperLevelRoof: 'Open',
    upperLevelFloor: 'Deck_Wood',
    extensionDoorProfile: 'all_glass_interior',
    tags: ['Glass', 'Terrace', 'Outdoor'],
  },
  {
    id: 'wraparound_deck',
    label: 'Deck',
    title: 'Covered wraparound deck',
    hint: 'Extension-only outdoor deck with roof cover and railings around the exposed edge.',
    outcome: 'covered_outdoor',
    kind: 'structured',
    level0Scope: 'extensions_only',
    perimeterWall: 'Railing_Cable',
    roof: 'Solid_Steel',
    floor: 'Deck_Wood',
    upperLevelMode: 'clear_extensions',
  },
  {
    id: 'wraparound_patio',
    label: 'Patio',
    title: 'Open wraparound patio',
    hint: 'Extension-only open patio with floor and guardrail perimeter.',
    outcome: 'open_outdoor',
    kind: 'structured',
    level0Scope: 'extensions_only',
    perimeterWall: 'Railing_Cable',
    roof: 'Open',
    floor: 'Deck_Wood',
    upperLevelMode: 'clear_extensions',
  },
  {
    id: 'retract_extensions',
    label: 'Retract',
    title: 'Retract extensions',
    hint: 'Collapse the added envelope back to the core container footprint.',
    outcome: 'collapsed',
    kind: 'retract',
    tags: ['Reset'],
  },
];

export function getContainerArrangementSpec(id: ContainerArrangementId): ContainerArrangementSpec {
  const spec = CONTAINER_ARRANGEMENT_SPECS.find((entry) => entry.id === id);
  if (!spec) throw new Error(`Unknown container arrangement: ${id}`);
  return spec;
}

export function getContainerArrangementPreviewFaces(spec: ContainerArrangementSpec): VoxelFaces {
  if (spec.kind === 'retract') return openFaces();
  return {
    top: spec.roof!,
    bottom: spec.floor!,
    n: spec.perimeterWall!,
    s: spec.perimeterWall!,
    e: spec.perimeterWall!,
    w: spec.perimeterWall!,
  };
}

export function evaluateContainerArrangementCell(
  spec: ContainerArrangementSpec,
  input: ArrangementCellInput,
): ArrangementCellResult | null {
  if (spec.kind === 'retract') return null;

  const { level, row, col } = input;
  const extension = isExtensionCell(row, col);

  if (level === 0) {
    if (spec.level0Scope === 'extensions_only' && !extension) return null;
    // Skylight-tagged voids render as glass instead of a literal hole — the
    // pavilion remains habitable (rain-sealed) while still admitting light.
    const voidTopSurface: SurfaceType = spec.tags?.includes('Skylight') ? 'Glass_Pane' : 'Open';
    return {
      active: true,
      faces: perimeterFaces(
        row,
        col,
        spec.perimeterWall!,
        isVoidCell(spec, row, col) ? voidTopSurface : spec.roof!,
        spec.floor!,
        spec.doorCols,
      ),
    };
  }

  if (spec.upperLevelMode === 'full_shell') {
    return {
      active: true,
      faces: {
        ...openFaces(),
        top: spec.upperLevelRoof ?? 'Solid_Steel',
        bottom: isVoidCell(spec, row, col) ? 'Open' : (spec.upperLevelFloor ?? 'Solid_Steel'),
      },
    };
  }

  // Single-volume pavilion: deactivate L1 entirely. Atrium void cells already
  // punched the L0 ceiling (top face = 'Open' via the level-0 branch above), so
  // the void becomes a roof skylight without an extra "shell" stacked on top.
  if (spec.upperLevelMode === 'deactivate') {
    return { active: false, faces: openFaces() };
  }

  if (spec.upperLevelMode === 'clear_extensions' && extension) {
    return { active: false, faces: openFaces() };
  }

  if (spec.upperLevelMode === 'extensions_only') {
    if (!extension) {
      return { active: false, faces: openFaces() };
    }
    return {
      active: true,
      faces: perimeterFaces(
        row,
        col,
        spec.upperPerimeterWall ?? spec.perimeterWall!,
        spec.upperLevelRoof ?? 'Open',
        spec.upperLevelFloor ?? 'Deck_Wood',
      ),
    };
  }

  return null;
}
