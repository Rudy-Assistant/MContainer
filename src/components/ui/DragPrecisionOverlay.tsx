'use client';

/**
 * DragPrecisionOverlay.tsx — Sprint C2 + C3 precision controls during drag.
 *
 * Industry-comparison brief identifies type-to-set (SketchUp's signature)
 * and axis-locking (Blender's G->X/Y/Z) as the two highest-leverage
 * precision affordances missing from MContainer. Both are gated behind
 * keyboard during an active drag, so simplicity is preserved -- a user
 * who never touches a hotkey never sees the overlay.
 *
 * Behavior (active only while dragContainer is non-null):
 *   - X / Y / Z keys lock the next type-to-set to that axis. Pressing
 *     the same key again clears the lock.
 *   - Digit keys (0-9), '.', and '-' build a numeric buffer.
 *   - Enter applies the buffer as an offset along the locked axis from
 *     the CURRENT dragWorldPos. (Without an axis lock, Enter clears
 *     the buffer without applying -- type-to-set requires intent.)
 *   - Backspace removes the last buffer character.
 *   - Escape clears both buffer and axis lock.
 *
 * Renders an HTML pill at top-center-ish whenever buffer or axis lock
 * is non-empty.
 */

import { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store/useStore';

type Axis = 'x' | 'y' | 'z' | null;

export function DragPrecisionOverlay() {
  const dragContainer = useStore((s) => s.dragContainer);
  const dragWorldPos = useStore((s) => s.dragWorldPos);
  const setDragWorldPos = useStore((s) => s.setDragWorldPos);

  const [axis, setAxis] = useState<Axis>(null);
  const [buffer, setBuffer] = useState<string>('');

  const reset = useCallback(() => {
    setAxis(null);
    setBuffer('');
  }, []);

  // Reset when drag ends.
  useEffect(() => {
    if (!dragContainer) reset();
  }, [dragContainer, reset]);

  const applyOffset = useCallback(() => {
    if (!dragWorldPos || !axis || buffer.length === 0) return;
    const parsed = parseFloat(buffer);
    if (!Number.isFinite(parsed)) return;
    const next = { ...dragWorldPos };
    if (axis === 'x') next.x = (dragWorldPos.x ?? 0) + parsed;
    if (axis === 'y') next.y = Math.max(0, (dragWorldPos.y ?? 0) + parsed);
    if (axis === 'z') next.z = (dragWorldPos.z ?? 0) + parsed;
    setDragWorldPos(next);
    setBuffer('');
  }, [dragWorldPos, axis, buffer, setDragWorldPos]);

  useEffect(() => {
    if (!dragContainer) return;
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing into form fields.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const k = e.key.toLowerCase();
      if (k === 'escape') {
        reset();
        return;
      }
      if (k === 'x' || k === 'y' || k === 'z') {
        e.preventDefault();
        setAxis((cur) => (cur === k ? null : (k as Axis)));
        return;
      }
      if (k === 'enter') {
        e.preventDefault();
        applyOffset();
        return;
      }
      if (k === 'backspace') {
        e.preventDefault();
        setBuffer((b) => b.slice(0, -1));
        return;
      }
      if (/^[0-9]$/.test(k) || k === '.' || k === '-') {
        e.preventDefault();
        setBuffer((b) => (b + k).slice(0, 12));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragContainer, applyOffset, reset]);

  if (!dragContainer) return null;
  if (!axis && !buffer) return null;

  return (
    <div
      data-testid="drag-precision-overlay"
      style={{
        position: 'fixed',
        top: 84,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        padding: '8px 14px',
        background: 'rgba(15, 23, 42, 0.92)',
        color: '#fff',
        fontSize: '12px',
        fontWeight: 600,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        display: 'flex',
        gap: '14px',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {axis && (
        <span style={{ color: axis === 'x' ? '#ef4444' : axis === 'y' ? '#22c55e' : '#3b82f6' }}>
          axis: {axis.toUpperCase()}
        </span>
      )}
      {buffer && (
        <span>
          offset: <span style={{ fontFamily: 'monospace' }}>{buffer || '_'}m</span>
        </span>
      )}
      <span style={{ opacity: 0.55, fontSize: '10px' }}>↵ apply • esc cancel</span>
    </div>
  );
}
