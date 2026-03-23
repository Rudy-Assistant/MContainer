"use client";

import { useState, useCallback } from 'react';
import type { MaterialPreset } from '@/config/finishPresets';
import { getSwatchSrc, generateNoiseSwatch } from './textureThumbnail';

interface Props {
  items: MaterialPreset[];
  activeId?: string;
  onSelect: (id: string, label: string) => void;
  label: string;
}

export default function TextureSwatchGrid({ items, activeId, onSelect, label }: Props) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        color: 'var(--text-dim)', letterSpacing: '0.05em', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {items.map((item) => (
          <SwatchButton key={item.id} item={item} active={activeId === item.id} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function SwatchButton({ item, active, onSelect }: {
  item: MaterialPreset; active: boolean; onSelect: (id: string, label: string) => void;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const [hovered, setHovered] = useState(false);
  const textureSrc = getSwatchSrc(item);
  const needsFallback = !textureSrc || useFallback;
  const fallbackSrc = needsFallback ? generateNoiseSwatch(item.id, item.color, 80) : null;

  const handleError = useCallback(() => setUseFallback(true), []);

  const imgSrc = needsFallback ? fallbackSrc! : textureSrc;
  const highlighted = active || hovered;

  return (
    <button
      onClick={() => onSelect(item.id, item.label)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
        padding: 0, cursor: 'pointer', background: 'none', border: 'none',
      }}
    >
      <img
        src={imgSrc}
        alt={item.label}
        loading="lazy"
        onError={textureSrc ? handleError : undefined}
        style={{
          width: '100%', aspectRatio: '1', borderRadius: 6,
          objectFit: 'cover', display: 'block',
          outline: highlighted ? '2px solid var(--accent)' : '2px solid transparent',
          outlineOffset: -2,
          opacity: hovered && !active ? 0.85 : 1,
          transition: 'outline-color 100ms, opacity 100ms',
        }}
      />
      <span style={{
        fontSize: 10, color: active ? 'var(--accent)' : 'var(--text-muted)',
        fontWeight: active ? 600 : 400,
        lineHeight: 1.3, textAlign: 'center', marginTop: 4,
      }}>
        {item.label}
      </span>
    </button>
  );
}
