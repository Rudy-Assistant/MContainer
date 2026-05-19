'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import type { VoxelFaces } from '@/types/container';

const TTL_MS = 3000;

const FACE_LABELS: Record<keyof VoxelFaces, string> = { n: 'north face', s: 'south wall', e: 'east wall', w: 'west wall', top: 'ceiling', bottom: 'floor' };

const buttonStyle: React.CSSProperties = {
  border: '1px solid rgba(255, 255, 255, 0.22)',
  borderRadius: 6,
  background: 'rgba(255, 255, 255, 0.12)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  padding: '4px 8px',
  whiteSpace: 'nowrap',
};

export function SmartRuleToast() {
  const fire = useStore((s) => s.lastSmartRuleFire);
  const setFire = useStore((s) => s.setLastSmartRuleFire);
  const setUserOptOut = useStore((s) => s.setUserOptOut);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!fire) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => setFire(null), 200);
    }, TTL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire?.at]);

  if (!fire) return null;

  const clear = () => setFire(null);
  const handleUndo = () => {
    useStore.temporal.getState().undo();
    clear();
  };
  const handleOptOut = () => {
    setUserOptOut(fire.containerId, fire.voxelIndex, fire.face, true);
    clear();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 110,
        right: 16,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: 'calc(100vw - 32px)',
        background: 'rgba(31, 41, 55, 0.92)',
        color: '#fff',
        padding: '10px 14px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-6px)',
        transition: 'opacity 180ms ease-out, transform 180ms ease-out',
        pointerEvents: visible ? 'auto' : 'none',
        userSelect: 'none',
      }}
    >
      <span>
        {fire.ruleName ?? 'Smart-rule auto-fix'} applied {FACE_LABELS[fire.face]}.
      </span>
      <button type="button" onClick={handleUndo} style={buttonStyle} title="Undo this auto-fix">
        Undo
      </button>
      <button type="button" onClick={handleOptOut} style={buttonStyle}>
        Don&apos;t auto-fix this face again
      </button>
      <button type="button" onClick={clear} style={{ ...buttonStyle, width: 24, height: 24, padding: 0, lineHeight: 1 }} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
