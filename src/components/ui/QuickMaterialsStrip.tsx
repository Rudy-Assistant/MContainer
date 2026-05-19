'use client';

/**
 * QuickMaterialsStrip.tsx — Sprint D2 global materials affordance.
 *
 * Twinmotion-style "drag-from-library" pattern adapted to the Sims/
 * SketchUp click-then-apply model: a floating left-edge strip of
 * common surface swatches. Click a swatch -> activeBrush is set ->
 * cursor becomes the brush -> click any face to paint. Click the
 * same swatch again to clear the brush.
 *
 * The strip is visible only in Realistic view mode and is hidden
 * during walkthrough mode so it doesn't compete with FPV chrome.
 * Suppressed when no containers exist (nothing to paint).
 */

import { useStore } from '@/store/useStore';
import type { SurfaceType } from '@/types/container';
import { ViewMode } from '@/types/container';
import { surfaceColor } from '@/components/ui/svg/surfaceColorMap';

interface SwatchDef {
  surface: SurfaceType;
  label: string;
}

const QUICK_SWATCHES: SwatchDef[] = [
  { surface: 'Solid_Steel', label: 'Steel' },
  { surface: 'Glass_Pane', label: 'Glass' },
  { surface: 'Deck_Wood', label: 'Wood' },
  { surface: 'Concrete', label: 'Concrete' },
  { surface: 'Railing_Cable', label: 'Cable Rail' },
  { surface: 'Railing_Glass', label: 'Glass Rail' },
  { surface: 'Window_Standard', label: 'Window' },
  { surface: 'Door', label: 'Door' },
];

export function QuickMaterialsStrip() {
  const viewMode = useStore((s) => s.viewMode);
  const containerCount = useStore((s) => Object.keys(s.containers).length);
  const activeBrush = useStore((s) => s.activeBrush);
  const setActiveBrush = useStore((s) => s.setActiveBrush);

  if (viewMode !== ViewMode.Realistic3D) return null;
  if (containerCount === 0) return null;

  const onClick = (surface: SurfaceType) => {
    setActiveBrush(activeBrush === surface ? null : surface);
  };

  return (
    <div
      data-testid="quick-materials-strip"
      style={{
        position: 'fixed',
        right: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '8px',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(14px) saturate(160%)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        border: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          fontSize: '9px',
          fontWeight: 700,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          textAlign: 'center',
          padding: '2px 0 4px',
        }}
      >
        Paint
      </div>
      {QUICK_SWATCHES.map((sw) => {
        const isActive = activeBrush === sw.surface;
        const color = surfaceColor(sw.surface);
        return (
          <button
            key={sw.surface}
            data-testid={`quick-swatch-${sw.surface}`}
            data-active={isActive ? 'true' : 'false'}
            onClick={() => onClick(sw.surface)}
            title={`${sw.label} — click any face to paint`}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: isActive ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.1)',
              background: color,
              cursor: 'pointer',
              boxShadow: isActive ? '0 0 0 2px rgba(59,130,246,0.25)' : 'none',
              transition: 'all 150ms ease-out',
            }}
          />
        );
      })}
    </div>
  );
}
