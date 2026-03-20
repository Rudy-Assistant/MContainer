export const POLE_MATERIALS = ['Steel', 'Wood', 'Concrete', 'Aluminum'] as const;
export type PoleMaterial = (typeof POLE_MATERIALS)[number];

export const POLE_SHAPES = ['Round', 'Square', 'I-Beam', 'H-Beam'] as const;
export type PoleShape = (typeof POLE_SHAPES)[number];

export const RAIL_MATERIALS = ['Steel', 'Wood', 'Aluminum'] as const;
export type RailMaterial = (typeof RAIL_MATERIALS)[number];

export const RAIL_SHAPES = ['Round', 'Square', 'Channel'] as const;
export type RailShape = (typeof RAIL_SHAPES)[number];

/** Default frame config used when container has no frameDefaults and no theme override */
export const DEFAULT_FRAME_CONFIG = {
  poleMaterial: 'Steel' as PoleMaterial,
  poleShape: 'Round' as PoleShape,
  railMaterial: 'Steel' as RailMaterial,
  railShape: 'Round' as RailShape,
} as const;

/** Pole keys start with 'l' (e.g. "l0r1c2_ne"), rail keys start with 'r' (e.g. "r1c2_h") */
export function isPoleKey(key: string): boolean {
  return key.startsWith('l');
}

/** Resolve a frame property through the override cascade: element > frameDefaults > theme */
export function resolveFrameProperty(
  override: { material?: string; shape?: string } | undefined,
  defaults: { poleMaterial?: string; poleShape?: string; railMaterial?: string; railShape?: string } | undefined,
  elementType: 'pole' | 'rail',
  prop: 'material' | 'shape',
): string {
  // 1. Element override
  if (override?.[prop]) return override[prop]!;
  // 2. Container frameDefaults
  const defaultKey = `${elementType}${prop.charAt(0).toUpperCase() + prop.slice(1)}` as keyof typeof DEFAULT_FRAME_CONFIG;
  if (defaults?.[defaultKey]) return defaults[defaultKey]!;
  // 3. Theme default
  return DEFAULT_FRAME_CONFIG[defaultKey];
}
