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
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        color: 'var(--text-dim)', letterSpacing: '0.05em', marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
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
  const fallbackSrc = needsFallback ? generateNoiseSwatch(item.id, item.color) : null;

  const handleError = useCallback(() => setUseFallback(true), []);

  const imgSrc = needsFallback ? fallbackSrc! : textureSrc;

  return (
    <button
      onClick={() => onSelect(item.id, item.label)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: 4, borderRadius: 6, cursor: 'pointer',
        border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--border-subtle)' : 'var(--btn-bg)',
        transition: 'border-color 100ms',
      }}
    >
      <img
        src={imgSrc}
        alt={item.label}
        loading="lazy"
        onError={textureSrc ? handleError : undefined}
        style={{
          width: 64, height: 64, borderRadius: 4,
          objectFit: 'cover', display: 'block',
        }}
      />
      <span style={{
        fontSize: 9, textTransform: 'uppercase', color: 'var(--text-dim)',
        lineHeight: 1.2, textAlign: 'center',
      }}>
        {item.label}
      </span>
    </button>
  );
}
