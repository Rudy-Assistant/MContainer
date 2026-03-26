import type { SurfaceType } from '@/types/container';

export interface CategoryVariant {
  id: string;
  surfaceType: SurfaceType;
  label: string;
  icon: string;
  finishMeta?: Record<string, string>;
}

export interface SurfaceCategory {
  id: string;
  icon: string;
  label: string;
  variants: CategoryVariant[];
  placeholder?: boolean;
  volumetric?: boolean;
}

// ── Wall Categories ─────────────────────────────────────────

export const WALL_CATEGORIES: SurfaceCategory[] = [
  {
    id: 'wall',
    icon: '🧱',
    label: 'Wall',
    variants: [
      { id: 'solid_steel', surfaceType: 'Solid_Steel', label: 'Steel', icon: '🔩' },
      { id: 'concrete', surfaceType: 'Concrete', label: 'Concrete', icon: '🏗️' },
      { id: 'washi', surfaceType: 'Wall_Washi', label: 'Washi', icon: '📜' },
      { id: 'shoji', surfaceType: 'Glass_Shoji', label: 'Shoji', icon: '🪟' },
      { id: 'glass', surfaceType: 'Glass_Pane', label: 'Glass', icon: '🔲' },
      { id: 'half_fold', surfaceType: 'Half_Fold', label: 'Half-Fold', icon: '📐' },
      { id: 'gull_wing', surfaceType: 'Gull_Wing', label: 'Gull-Wing', icon: '🦅' },
    ],
  },
  {
    id: 'door',
    icon: '🚪',
    label: 'Door',
    variants: [
      { id: 'single_swing', surfaceType: 'Door', label: 'Single Swing', icon: '🚪' },
      { id: 'double_swing', surfaceType: 'Door', label: 'Double Swing', icon: '🚪', finishMeta: { doorStyle: 'double_swing' } },
      { id: 'barn_slide', surfaceType: 'Door', label: 'Barn Slide', icon: '🚪', finishMeta: { doorStyle: 'barn_slide' } },
      { id: 'pocket_slide', surfaceType: 'Door', label: 'Pocket Slide', icon: '🚪', finishMeta: { doorStyle: 'pocket_slide' } },
      { id: 'bifold', surfaceType: 'Door', label: 'Bifold', icon: '🚪', finishMeta: { doorStyle: 'bifold' } },
      { id: 'french', surfaceType: 'Door', label: 'French', icon: '🚪', finishMeta: { doorStyle: 'french' } },
      { id: 'glass_slide', surfaceType: 'Door', label: 'Glass Slide', icon: '🚪', finishMeta: { doorStyle: 'glass_slide' } },
      { id: 'shoji', surfaceType: 'Door', label: 'Shoji Screen', icon: '🚪', finishMeta: { doorStyle: 'shoji' } },
    ],
  },
  {
    id: 'window',
    icon: '🪟',
    label: 'Window',
    variants: [
      { id: 'standard', surfaceType: 'Window_Standard', label: 'Standard', icon: '🪟' },
      { id: 'half', surfaceType: 'Window_Half', label: 'Half', icon: '🪟' },
      { id: 'sill', surfaceType: 'Window_Sill', label: 'Sill', icon: '🪟' },
      { id: 'clerestory', surfaceType: 'Window_Clerestory', label: 'Clerestory', icon: '🪟' },
    ],
  },
  {
    id: 'railing',
    icon: '🏗️',
    label: 'Railing',
    variants: [
      { id: 'cable', surfaceType: 'Railing_Cable', label: 'Cable', icon: '🔗' },
      { id: 'glass', surfaceType: 'Railing_Glass', label: 'Glass', icon: '🔲' },
    ],
  },
  {
    id: 'stairs',
    icon: '🪜',
    label: 'Stairs',
    volumetric: true,
    variants: [
      { id: 'standard', surfaceType: 'Stairs', label: 'Standard', icon: '🪜' },
      { id: 'down', surfaceType: 'Stairs_Down', label: 'Down', icon: '🪜' },
    ],
  },
  {
    id: 'shelf',
    icon: '📚',
    label: 'Shelf',
    placeholder: true,
    variants: [],
  },
  {
    id: 'open',
    icon: '⬜',
    label: 'Open',
    variants: [
      { id: 'open', surfaceType: 'Open', label: 'Open', icon: '⬜' },
    ],
  },
];

// ── Floor Categories ────────────────────────────────────────

export const FLOOR_CATEGORIES: SurfaceCategory[] = [
  {
    id: 'solid',
    icon: '🪵',
    label: 'Solid',
    variants: [
      { id: 'wood', surfaceType: 'Deck_Wood', label: 'Wood', icon: '🪵' },
      { id: 'tatami', surfaceType: 'Floor_Tatami', label: 'Tatami', icon: '🟩' },
      { id: 'hinoki', surfaceType: 'Wood_Hinoki', label: 'Hinoki', icon: '🪵' },
      { id: 'concrete', surfaceType: 'Concrete', label: 'Concrete', icon: '🏗️' },
    ],
  },
  {
    id: 'glass',
    icon: '🔲',
    label: 'Glass',
    variants: [
      { id: 'glass', surfaceType: 'Glass_Pane', label: 'Glass', icon: '🔲' },
    ],
  },
  {
    id: 'open',
    icon: '⬜',
    label: 'Open',
    variants: [
      { id: 'open', surfaceType: 'Open', label: 'Open', icon: '⬜' },
    ],
  },
];

// ── Ceiling Categories ──────────────────────────────────────

export const CEILING_CATEGORIES: SurfaceCategory[] = [
  {
    id: 'solid',
    icon: '🔩',
    label: 'Solid',
    variants: [
      { id: 'steel', surfaceType: 'Solid_Steel', label: 'Steel', icon: '🔩' },
      { id: 'wood', surfaceType: 'Deck_Wood', label: 'Wood', icon: '🪵' },
      { id: 'concrete', surfaceType: 'Concrete', label: 'Concrete', icon: '🏗️' },
    ],
  },
  {
    id: 'skylight',
    icon: '☀️',
    label: 'Skylight',
    variants: [
      { id: 'glass', surfaceType: 'Glass_Pane', label: 'Glass', icon: '🔲' },
    ],
  },
  {
    id: 'open',
    icon: '⬜',
    label: 'Open',
    variants: [
      { id: 'open', surfaceType: 'Open', label: 'Open', icon: '⬜' },
    ],
  },
];

// ── Reverse Lookup ──────────────────────────────────────────

const TAB_MAP: Record<string, SurfaceCategory[]> = {
  wall: WALL_CATEGORIES,
  floor: FLOOR_CATEGORIES,
  ceiling: CEILING_CATEGORIES,
};

export function getCategoryForSurface(
  surface: SurfaceType,
  tab: 'wall' | 'floor' | 'ceiling',
): string | null {
  const categories = TAB_MAP[tab];
  if (!categories) return null;
  for (const cat of categories) {
    for (const v of cat.variants) {
      if (v.surfaceType === surface) return cat.id;
    }
  }
  return null;
}
