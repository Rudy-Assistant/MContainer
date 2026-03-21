import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useSelectionTarget, type SelectionTarget } from './useSelectionTarget';
import type { SurfaceType } from '../types/container';

export interface MaterialSwatch {
  surface: SurfaceType;
  label: string;
  group: 'wall' | 'floor' | 'window' | 'special';
}

export const MATERIAL_SWATCHES: MaterialSwatch[] = [
  { surface: 'Solid_Steel', label: 'Steel', group: 'wall' },
  { surface: 'Glass_Pane', label: 'Glass', group: 'window' },
  { surface: 'Deck_Wood', label: 'Wood', group: 'floor' },
  { surface: 'Concrete', label: 'Concrete', group: 'floor' },
  { surface: 'Window_Standard', label: 'Window', group: 'window' },
  { surface: 'Window_Half', label: 'Half Win', group: 'window' },
  { surface: 'Window_Sill', label: 'Sill Win', group: 'window' },
  { surface: 'Window_Clerestory', label: 'Clerstry', group: 'window' },
  { surface: 'Door', label: 'Door', group: 'wall' },
  { surface: 'Railing_Cable', label: 'Cable Rail', group: 'wall' },
  { surface: 'Railing_Glass', label: 'Glass Rail', group: 'wall' },
  { surface: 'Half_Fold', label: 'Half-Fold', group: 'special' },
  { surface: 'Gull_Wing', label: 'Gull-Wing', group: 'special' },
  { surface: 'Wood_Hinoki', label: 'Hinoki', group: 'floor' },
  { surface: 'Floor_Tatami', label: 'Tatami', group: 'floor' },
  { surface: 'Wall_Washi', label: 'Washi', group: 'wall' },
  { surface: 'Glass_Shoji', label: 'Shoji', group: 'window' },
  { surface: 'Stairs', label: 'Stairs ↑', group: 'special' },
  { surface: 'Stairs_Down', label: 'Stairs ↓', group: 'special' },
  { surface: 'Open', label: 'Open', group: 'special' },
];

export function getVisibleSwatches(face: string | null): MaterialSwatch[] {
  if (!face) return MATERIAL_SWATCHES;

  if (face === 'top') {
    return MATERIAL_SWATCHES.filter(s => s.surface === 'Solid_Steel' || s.surface === 'Open');
  }

  if (face === 'bottom') {
    return MATERIAL_SWATCHES.filter(s => s.group === 'floor' || s.surface === 'Open');
  }

  // Wall face (n/s/e/w)
  return MATERIAL_SWATCHES.filter(s =>
    (s.group === 'wall' || s.group === 'window' || s.group === 'special') &&
    s.surface !== 'Stairs' && s.surface !== 'Stairs_Down'
  );
}

/** Returns the hotbar tab index for a given selection target type, or null if no switch. */
export function getHotbarTabForTarget(target: SelectionTarget): number | null {
  switch (target.type) {
    case 'container': return 0;        // Rooms
    case 'voxel':
    case 'bay':       return 1;        // Surfaces (configurations)
    case 'face':
    case 'bay-face':  return 2;        // Materials
    case 'none':      return null;     // Don't switch on deselection
    default:          return null;
  }
}

/**
 * Mount once in SmartHotbar. Watches SelectionTarget.type transitions
 * and auto-switches the hotbar tab. Same-type changes do NOT re-trigger.
 */
export function useHotbarAutoSwitch(): void {
  const target = useSelectionTarget();
  const prevType = useRef<SelectionTarget['type']>(target.type);
  const setActiveHotbarTab = useStore((s) => s.setActiveHotbarTab);

  useEffect(() => {
    if (target.type === prevType.current) return;
    prevType.current = target.type;

    const tab = getHotbarTabForTarget(target);
    if (tab !== null) {
      setActiveHotbarTab(tab);
    }
  }, [target, setActiveHotbarTab]);
}
