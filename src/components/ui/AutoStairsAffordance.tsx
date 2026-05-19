'use client';

/**
 * U4: Auto-stairs affordance.
 *
 * After a successful stackContainer (via Library drag-drop OR direct
 * stackContainer call), this component offers an inline "+ Stairs" prompt
 * letting the user one-click commit stairs on the lower container's
 * south-facing roof voxel. Click anywhere else, or wait 4 seconds, to
 * dismiss.
 *
 * Plan: docs/plans/2026-05-18-001-feat-building-ux-industry-parity-plan.md
 * Origin: docs/brainstorms/2026-05-18-001-building-ux-requirements.md R4 / AE3.
 *
 * Subscribes to `lastStackedPair` set by containerSlice.stackContainer.
 * Calls applyStairsFromFace on accept, then clears the affordance.
 */

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { VOXEL_COLS } from '@/types/container';

const TTL_MS = 4000;

/** Default stair attach point: south halo, mid column, on the bottom
 *  container's roof (voxel level 1, row VOXEL_ROWS-1, col mid).
 *  voxelIndex = level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col. */
const STAIR_ROW = 3;
const STAIR_COL_MID = Math.floor(VOXEL_COLS / 2);
const STAIR_VOXEL_INDEX = 1 * (4 * VOXEL_COLS) + STAIR_ROW * VOXEL_COLS + STAIR_COL_MID;

export function AutoStairsAffordance() {
  const pair = useStore((s) => s.lastStackedPair);
  const setLastStackedPair = useStore((s) => s.setLastStackedPair);
  const applyStairsFromFace = useStore((s) => s.applyStairsFromFace);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pair) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => setLastStackedPair(null), 200);
    }, TTL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair?.at]);

  if (!pair) return null;

  const onAccept = () => {
    applyStairsFromFace(pair.bottomId, STAIR_VOXEL_INDEX, 's');
    setLastStackedPair(null);
  };

  const onDismiss = () => setLastStackedPair(null);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 64,
        left: '50%',
        transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, -6px)',
        zIndex: 100,
        background: '#1f2937',
        color: '#fff',
        padding: '8px 12px',
        borderRadius: 8,
        fontSize: 13,
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 180ms ease-out, transform 180ms ease-out',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <span>Stacked. Add stairs to access?</span>
      <button
        onClick={onAccept}
        style={{
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
        title="Add stairs on the lower container's south roof voxel"
      >
        + Stairs
      </button>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          color: '#9ca3af',
          border: 'none',
          padding: '6px 8px',
          fontSize: 12,
          cursor: 'pointer',
        }}
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
