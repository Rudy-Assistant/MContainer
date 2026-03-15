/**
 * INPUT HANDLER HOOK - Production Release
 *
 * Decouples menu controls from browser-reserved keys.
 * ESC is RESERVED for browser (Pointer Lock exit).
 *
 * Menu Controls:
 * - Open: Right-Click (or Spacebar on hover)
 * - Close: Click-Outside OR Right-Click toggle
 *
 * Edge Cycling:
 * - Spacebar: When hovering overlapping edges (menu must be closed)
 */

import { useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { ViewMode } from '@/types/container';

export function useInputHandler() {
  const bayContextMenu = useStore((s) => s.bayContextMenu);
  const closeBayContextMenu = useStore((s) => s.closeBayContextMenu);
  const overlappingEdges = useStore((s) => s.overlappingEdges);
  const cycleOverlappingEdges = useStore((s) => s.cycleOverlappingEdges);

  // Track menu container ref for click-outside detection
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Spacebar: Cycle edges OR close menu (context-dependent)
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault(); // Prevent page scroll

        if (bayContextMenu) {
          closeBayContextMenu();
        } else if (overlappingEdges && overlappingEdges.length > 1) {
          cycleOverlappingEdges();
        } else {
          // Fallback: repeat last stamp on hovered face
          const store = useStore.getState();
          if (store.viewMode === ViewMode.Realistic3D && store.hoveredVoxelEdge && store.lastStamp) {
            store.setVoxelFace(
              store.hoveredVoxelEdge.containerId,
              store.hoveredVoxelEdge.voxelIndex,
              store.hoveredVoxelEdge.face,
              store.lastStamp.surfaceType
            );
          }
        }
        return;
      }

      // 'C' — Clear hovered face to Open, or deactivate hovered block
      // Guard: skip Ctrl+C (copy), skip in walkthrough
      if (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey) {
        const { hoveredVoxelEdge, hoveredVoxel, setVoxelFace, setVoxelActive, viewMode } = useStore.getState();
        if (viewMode === ViewMode.Walkthrough) return;
        if (hoveredVoxelEdge) {
          // Clear single face → Open
          setVoxelFace(hoveredVoxelEdge.containerId, hoveredVoxelEdge.voxelIndex, hoveredVoxelEdge.face, 'Open');
          return;
        }
        if (hoveredVoxel && !hoveredVoxel.isExtension) {
          // Clear whole block → deactivate
          setVoxelActive(hoveredVoxel.containerId, hoveredVoxel.index, false);
          return;
        }
        return;
      }

      // 'P' — Toggle Preview Mode (hide UI, unlock zoom, disable hitboxes)
      if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey) {
        useStore.getState().togglePreviewMode();
        return;
      }
    }

    function handleClickOutside(e: MouseEvent) {
      // Close menu if click is outside menu container
      if (!bayContextMenu) return;

      // Check if click target is inside menu
      const target = e.target as Node;
      const menuElement = document.querySelector('[data-bay-context-menu]');

      if (menuElement && !menuElement.contains(target)) {
        closeBayContextMenu();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [bayContextMenu, overlappingEdges, closeBayContextMenu, cycleOverlappingEdges]);

  return { menuRef };
}
