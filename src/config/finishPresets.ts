import type { SurfaceType, VoxelFaces } from '../types/container';

export interface MaterialPreset {
  id: string;
  label: string;
  color: string;
  icon?: string;
}

export interface ColorPreset {
  hex: string;
  label: string;
}

export const EXTERIOR_MATERIALS: MaterialPreset[] = [
  { id: 'steel',    label: 'Steel',    color: '#708090' },
  { id: 'wood',     label: 'Wood',     color: '#8B7355' },
  { id: 'concrete', label: 'Concrete', color: '#A9A9A9' },
  { id: 'bamboo',   label: 'Bamboo',   color: '#D4B896' },
];

export const PAINT_COLORS: ColorPreset[] = [
  { hex: '#FAF9F6', label: 'White' },
  { hex: '#F5F0EB', label: 'Warm White' },
  { hex: '#EDE8E0', label: 'Cream' },
  { hex: '#E8DDD0', label: 'Linen' },
  { hex: '#D5C4A1', label: 'Sand' },
  { hex: '#C4B39C', label: 'Beige' },
  { hex: '#A0937D', label: 'Taupe' },
  { hex: '#8B7D6B', label: 'Mocha' },
  { hex: '#6B7F6B', label: 'Sage' },
  { hex: '#4A5D4A', label: 'Forest' },
  { hex: '#B8C4C4', label: 'Silver' },
  { hex: '#8E9E9E', label: 'Slate' },
  { hex: '#5C6B6B', label: 'Charcoal' },
  { hex: '#3A3A3A', label: 'Carbon' },
];

export const GLASS_TINTS: ColorPreset[] = [
  { hex: '#FFFFFF', label: 'Clear' },
  { hex: '#696969', label: 'Smoke' },
  { hex: '#4A90D9', label: 'Blue' },
  { hex: '#2F4F4F', label: 'Privacy' },
];

export const FRAME_COLORS: ColorPreset[] = [
  { hex: '#1A1A1A', label: 'Black' },
  { hex: '#FFFFFF', label: 'White' },
  { hex: '#8B6914', label: 'Bronze' },
  { hex: '#C4A882', label: 'Natural' },
];

export const DOOR_STYLES: MaterialPreset[] = [
  { id: 'swing',   label: 'Swing',   color: '#8B7355' },
  { id: 'sliding', label: 'Sliding', color: '#708090' },
  { id: 'barn',    label: 'Barn',    color: '#A0522D' },
];

export const LIGHT_FIXTURES: MaterialPreset[] = [
  { id: 'none',     label: 'None',      color: '#333333' },
  { id: 'pendant',  label: 'Pendant',   color: '#FFD700' },
  { id: 'flush',    label: 'Flush',     color: '#F0E68C' },
  { id: 'track',    label: 'Track',     color: '#C0C0C0' },
  { id: 'recessed', label: 'Recessed',  color: '#FFFACD' },
];

export const LIGHT_COLORS: MaterialPreset[] = [
  { id: 'warm',     label: 'Warm White', color: '#FFE4B5' },
  { id: 'cool',     label: 'Cool White', color: '#F0F8FF' },
  { id: 'daylight', label: 'Daylight',   color: '#FFFFF0' },
  { id: 'amber',    label: 'Amber',      color: '#FFBF00' },
];

export const ELECTRICAL_TYPES: MaterialPreset[] = [
  { id: 'none',          label: 'None',          color: '#333333' },
  { id: 'switch',        label: 'Switch',        color: '#F5F5F5' },
  { id: 'double_switch', label: 'Double Switch', color: '#F5F5F5' },
  { id: 'outlet',        label: 'Outlet',        color: '#F5F5F5' },
  { id: 'dimmer',        label: 'Dimmer',        color: '#F5F5F5' },
];

export const FLOOR_MATERIALS: MaterialPreset[] = [
  { id: 'oak_wood',    label: 'Oak Planks',        color: '#A0785A' },
  { id: 'concrete',    label: 'Polished Concrete',  color: '#A9A9A9' },
  { id: 'bamboo',      label: 'Bamboo',             color: '#D4B896' },
  { id: 'hinoki',      label: 'Hinoki Cedar',       color: '#F5E6C8' },
  { id: 'tatami',      label: 'Tatami',             color: '#C8D5A0' },
  { id: 'tile',        label: 'Tile',               color: '#E0D5C5' },
];

export const CEILING_MATERIALS: MaterialPreset[] = [
  { id: 'steel',   label: 'Steel',   color: '#708090' },
  { id: 'open',    label: 'Open',    color: '#333333' },
  { id: 'plaster', label: 'Plaster', color: '#F5F5F5' },
];

export interface FinishOptions {
  exteriorMaterial: boolean;
  interiorPaint: boolean;
  glassTint: boolean;
  frameColor: boolean;
  doorStyle: boolean;
  lightFixture: boolean;
  lightColor: boolean;
  electrical: boolean;
  floorMaterial: boolean;
  ceilingMaterial: boolean;
}

const WALL_SURFACES = new Set<string>([
  'Solid_Steel', 'Wall_Washi', 'Wood_Hinoki', 'Concrete', 'Deck_Wood',
]);
const WINDOW_SURFACES = new Set<string>([
  'Window_Standard', 'Window_Half', 'Window_Sill', 'Window_Clerestory',
  'Glass_Pane', 'Glass_Shoji',
]);

export function getFinishOptionsForFace(
  surface: SurfaceType,
  face: keyof VoxelFaces | string,
): FinishOptions {
  const isTop = face === 'top';
  const isBottom = face === 'bottom';
  const isWallFace = !isTop && !isBottom;
  const isWall = WALL_SURFACES.has(surface);
  const isWindow = WINDOW_SURFACES.has(surface);
  const isDoor = surface === 'Door';

  return {
    exteriorMaterial: isWallFace && isWall,
    interiorPaint:    isWallFace && isWall,
    glassTint:        isWallFace && isWindow,
    frameColor:       isWallFace && (isWindow || isDoor),
    doorStyle:        isWallFace && isDoor,
    lightFixture:     isTop,
    lightColor:       isTop,
    electrical:       isWallFace && (isWall || isWindow || isDoor),
    floorMaterial:    isBottom,
    ceilingMaterial:  isTop,
  };
}
