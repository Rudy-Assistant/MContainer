import type { SurfaceType } from '../types/container';

export interface WallTypeEntry {
  surface: SurfaceType;
  label: string;
  icon: string;
  category: 'wall' | 'floor' | 'ceiling';
}

export const WALL_TYPES: WallTypeEntry[] = [
  // Wall types
  { surface: 'Solid_Steel', label: 'Solid Wall', icon: '🔲', category: 'wall' },
  { surface: 'Glass_Pane', label: 'Glass Pane', icon: '🪟', category: 'wall' },
  { surface: 'Window_Standard', label: 'Window', icon: '⬜', category: 'wall' },
  { surface: 'Window_Half', label: 'Half Window', icon: '▭', category: 'wall' },
  { surface: 'Window_Sill', label: 'Sill Window', icon: '▤', category: 'wall' },
  { surface: 'Window_Clerestory', label: 'Clerestory', icon: '═', category: 'wall' },
  { surface: 'Door', label: 'Door', icon: '🚪', category: 'wall' },
  { surface: 'Railing_Cable', label: 'Cable Rail', icon: '⫿', category: 'wall' },
  { surface: 'Railing_Glass', label: 'Glass Rail', icon: '▯', category: 'wall' },
  { surface: 'Open', label: 'Open', icon: '▫', category: 'wall' },
  { surface: 'Glass_Shoji', label: 'Shoji', icon: '▦', category: 'wall' },
  { surface: 'Wall_Washi', label: 'Washi', icon: '▧', category: 'wall' },
  { surface: 'Half_Fold', label: 'Half Fold', icon: '⌐', category: 'wall' },
  { surface: 'Gull_Wing', label: 'Gull Wing', icon: '⌃', category: 'wall' },
  // Floor types
  { surface: 'Deck_Wood', label: 'Deck Wood', icon: '🪵', category: 'floor' },
  { surface: 'Concrete', label: 'Concrete', icon: '⬛', category: 'floor' },
  { surface: 'Wood_Hinoki', label: 'Hinoki', icon: '🟫', category: 'floor' },
  { surface: 'Floor_Tatami', label: 'Tatami', icon: '🟩', category: 'floor' },
  { surface: 'Open', label: 'Open', icon: '▫', category: 'floor' },
  // Ceiling types
  { surface: 'Solid_Steel', label: 'Steel', icon: '⬛', category: 'ceiling' },
  { surface: 'Open', label: 'Open', icon: '▫', category: 'ceiling' },
];

export function getWallTypesForContext(inspectorView: 'floor' | 'ceiling', selectedFace: string | null): WallTypeEntry[] {
  if (selectedFace === 'top' || inspectorView === 'ceiling') {
    return WALL_TYPES.filter(t => t.category === 'ceiling');
  }
  if (selectedFace === 'bottom') {
    return WALL_TYPES.filter(t => t.category === 'floor');
  }
  return WALL_TYPES.filter(t => t.category === 'wall');
}
