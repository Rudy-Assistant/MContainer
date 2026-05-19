'use client';

/**
 * SnapInferenceLabel.tsx — Sprint C1 inference labels during drag.
 *
 * Adds the SketchUp-signature behavior of SPEAKING what the snap engine
 * just inferred -- "edge", "midpoint", "stack" -- as a small floating
 * text near the ghost. Without this label, users see the ghost jump
 * but can't tell WHY; with it, the snap behavior becomes legible.
 *
 * Reads dragWorldPos.snapLabel (set by the DragGhost useFrame loop).
 * Renders an Html overlay anchored to the snap point in world space.
 *
 * Suppressed when no snap is active (snapLabel === null).
 */

import { Html } from '@react-three/drei';
import { useStore } from '@/store/useStore';
import type { SnapKind } from '@/store/spatialEngine';

const LABEL_PILL_STYLE: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.85)',
  color: '#fff',
  fontSize: '11px',
  fontWeight: 600,
  padding: '3px 8px',
  borderRadius: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
};

const LABEL_TEXT: Record<SnapKind, string> = {
  edge: 'snap • edge',
  midpoint: 'snap • midpoint',
  stack: 'snap • stack',
};

const LABEL_COLOR: Record<SnapKind, string> = {
  edge: '#22c55e',
  midpoint: '#06b6d4',
  stack: '#f59e0b',
};

export function SnapInferenceLabel() {
  // Narrow subscriptions: only re-render when the snap label changes;
  // position updates per drag frame don't re-render this component.
  const label = useStore((s) => s.dragWorldPos?.snapLabel ?? null);
  const x = useStore((s) => s.dragWorldPos?.x ?? 0);
  const y = useStore((s) => s.dragWorldPos?.y ?? 0);
  const z = useStore((s) => s.dragWorldPos?.z ?? 0);
  if (!label) return null;

  return (
    <group position={[x, y + 3.2, z]}>
      <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div
          data-testid="snap-inference-label"
          data-snap-kind={label}
          style={{ ...LABEL_PILL_STYLE, color: LABEL_COLOR[label], background: 'rgba(15,23,42,0.9)' }}
        >
          {LABEL_TEXT[label]}
        </div>
      </Html>
    </group>
  );
}
