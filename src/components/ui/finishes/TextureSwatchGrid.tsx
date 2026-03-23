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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
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
  const textureSrc = getSwatchSrc(item);
  const needsFallback = !textureSrc || useFallback;
  const fallbackSrc = needsFallback ? generateNoiseSwatch(item.id, item.color, 80) : null;

  const handleError = useCallback(() => setUseFallback(true), []);

  const imgSrc = needsFallback ? fallbackSrc! : textureSrc;

  return (
    <button
      onClick={() => onSelect(item.id, item.label)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
        padding: 0, borderRadius: 8, cursor: 'pointer', overflow: 'hidden',
        border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: 'var(--btn-bg)',
        boxShadow: active ? '0 0 0 1px var(--accent)' : 'none',
        transition: 'border-color 120ms, box-shadow 120ms',
      }}
    >
      <img
        src={imgSrc}
        alt={item.label}
        loading="lazy"
        onError={textureSrc ? handleError : undefined}
        style={{
          width: '100%', height: 80, borderRadius: 0,
          objectFit: 'cover', display: 'block',
        }}
      />
      <span style={{
        fontSize: 10, color: 'var(--text-main)', fontWeight: 500,
        lineHeight: 1.3, textAlign: 'center', padding: '5px 4px 6px',
        width: '100%',
      }}>
        {item.label}
      </span>
    </button>
  );
}
