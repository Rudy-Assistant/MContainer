'use client';

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';

/* ── Pure style helpers (exported for testing) ────────────────────── */

export const PRESET_CARD_KEYFRAMES = `
@keyframes selectPop {
  0%   { transform: scale(1.04); }
  40%  { transform: scale(1.08); }
  100% { transform: scale(1.0);  }
}`;

export function getCardImageStyle(active: boolean, hovered: boolean): CSSProperties {
  if (active) {
    return {
      boxShadow:
        '0 0 0 2.5px rgba(99,102,241,0.7), 0 0 16px rgba(99,102,241,0.2)',
    };
  }
  if (hovered) {
    return {
      transform: 'scale(1.04)',
      boxShadow:
        '0 4px 12px rgba(0,0,0,0.12), 0 0 0 1.5px rgba(99,102,241,0.35)',
    };
  }
  return {};
}

export function getCardLabelStyle(active: boolean, hovered: boolean): CSSProperties {
  if (active) {
    return { color: 'var(--text-main)', fontWeight: 700 };
  }
  if (hovered) {
    return { color: 'var(--text-main)', fontWeight: 600 };
  }
  return { color: 'var(--text-muted)', fontWeight: 400 };
}

/* ── Keyframe injection guard ─────────────────────────────────────── */

let _injected = false;

/* ── Component ────────────────────────────────────────────────────── */

interface PresetCardProps {
  /** Full custom content (image, SVG, etc.) — fills the card area. */
  content?: ReactNode;
  /** Shorthand for emoji/text icon — renders centered with raised background.
   *  Takes precedence display-wise but `content` is used if both provided. */
  icon?: ReactNode;
  /** Icon font size when using `icon` prop (default 28). */
  iconSize?: number;
  label: string;
  active: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * Shared preset card: square image area with highlight on image only.
 * Text label sits below, outside the highlight border.
 * Uses native <button> for accessibility (focus, Enter/Space, ARIA).
 *
 * Pass `content` for custom fills (images, SVGs) or `icon` for centered
 * emoji/text icons with a standard raised background.
 */
export function PresetCard({
  content, icon, iconSize = 28, label, active, onClick, onMouseEnter, onMouseLeave,
}: PresetCardProps) {
  const [hovered, setHovered] = useState(false);
  const prevActiveRef = useRef(active);
  const [animating, setAnimating] = useState(false);

  // Inject keyframes once
  useEffect(() => {
    if (_injected) return;
    const style = document.createElement('style');
    style.textContent = PRESET_CARD_KEYFRAMES;
    document.head.appendChild(style);
    _injected = true;
  }, []);

  // Detect false→true transition on active prop
  useEffect(() => {
    if (active && !prevActiveRef.current) {
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 200);
      prevActiveRef.current = true;   // mark transition handled immediately
      return () => clearTimeout(timer);
    }
    prevActiveRef.current = active;   // handles true→false reset
  }, [active]);

  const imageStyle: CSSProperties = {
    ...getCardImageStyle(active, hovered),
    position: 'relative',
    aspectRatio: '1',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 6,
    background: 'var(--surface)',
    overflow: 'hidden',
    transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
    ...(animating
      ? { animation: 'selectPop 200ms ease-out' }
      : {}),
  };

  const labelStyle: CSSProperties = {
    ...getCardLabelStyle(active, hovered),
    fontSize: 10,
    lineHeight: 1.2,
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    whiteSpace: 'nowrap',
    transition: 'color 150ms, font-weight 150ms',
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => {
        setHovered(true);
        onMouseEnter?.();
      }}
      onMouseLeave={() => {
        setHovered(false);
        onMouseLeave?.();
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        minWidth: 0,
        border: 'none',
        background: 'none',
        padding: 0,
      }}
    >
      {/* Image area — visual effects here only */}
      <div style={imageStyle}>
        {content ?? (icon != null && (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: iconSize,
            background: 'var(--surface-raised, #f0f2f5)', borderRadius: 4,
          }}>
            {icon}
          </div>
        ))}
        {/* Check badge for selected state */}
        {active && (
          <div
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'rgb(99,102,241)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: '#fff',
              fontWeight: 700,
              lineHeight: 1,
              pointerEvents: 'none',
            }}
          >
            ✓
          </div>
        )}
      </div>

      {/* Label — outside highlight, no border */}
      <span style={labelStyle}>
        {label}
      </span>
    </button>
  );
}
