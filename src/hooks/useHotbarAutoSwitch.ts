import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useSelectionTarget, type SelectionTarget } from './useSelectionTarget';

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
