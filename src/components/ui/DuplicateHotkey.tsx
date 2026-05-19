'use client';

/**
 * DuplicateHotkey.tsx — Sprint C4 (Ctrl+D / Cmd+D repeat-last).
 *
 * Blender's Shift+R / SketchUp's Ctrl+Alt+drag affordance adapted to
 * MContainer: Ctrl+D duplicates the current selection at +length-along-X.
 * The new container inherits size, rotation, and a deep-copied voxel
 * grid (so paint state carries over), and announces via the destructive
 * toast so undo affordance is visible.
 *
 * Suppressed while a drag is active or when no selection exists.
 */

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

export function DuplicateHotkey() {
  const selection = useStore((s) => s.selection);
  const dragContainer = useStore((s) => s.dragContainer);
  const duplicateContainer = useStore((s) => s.duplicateContainer);

  useEffect(() => {
    if (dragContainer) return; // ignore while placing a new container
    if (!selection || selection.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key !== 'd' && e.key !== 'D') return;
      // Ignore when typing into form fields.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      // Duplicate each selected container. Default offset is +length-along-X
      // which the action computes per-container from CONTAINER_DIMENSIONS.
      for (const id of selection) {
        duplicateContainer(id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, dragContainer, duplicateContainer]);

  return null;
}
