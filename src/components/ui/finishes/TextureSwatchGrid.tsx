"use client";

import { useState, useCallback } from 'react';
import type { MaterialPreset } from '@/config/finishPresets';
import { getSwatchSrc, generateNoiseSwatch } from './textureThumbnail';
import { PresetCard } from './PresetCard';
import { sectionHeaderStyle } from './sectionHeaderStyle';

interface Props {
  items: MaterialPreset[];
  activeId?: string;
  onSelect: (id: string, label: string) => void;
  label: string;
  onHoverItem?: (id: string) => void;
  onLeaveItem?: () => void;
}

export default function TextureSwatchGrid({ items, activeId, onSelect, label, onHoverItem, onLeaveItem }: Props) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={sectionHeaderStyle()}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {items.map((item) => (
          <SwatchCard key={item.id} item={item} active={activeId === item.id} onSelect={onSelect} onHoverItem={onHoverItem} onLeaveItem={onLeaveItem} />
        ))}
      </div>
    </div>
  );
}

function SwatchCard({ item, active, onSelect, onHoverItem, onLeaveItem }: {
  item: MaterialPreset; active: boolean; onSelect: (id: string, label: string) => void;
  onHoverItem?: (id: string) => void; onLeaveItem?: () => void;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const textureSrc = getSwatchSrc(item);
  const needsFallback = !textureSrc || useFallback;
  const fallbackSrc = needsFallback ? generateNoiseSwatch(item.id, item.color, 80) : null;
  const handleError = useCallback(() => setUseFallback(true), []);
  const src = needsFallback ? fallbackSrc! : textureSrc;

  return (
    <PresetCard
      content={
        <img
          src={src}
          alt={item.label}
          loading="lazy"
          onError={textureSrc ? handleError : undefined}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
        />
      }
      label={item.label}
      active={active}
      onClick={() => onSelect(item.id, item.label)}
      onMouseEnter={onHoverItem ? () => onHoverItem(item.id) : undefined}
      onMouseLeave={onLeaveItem}
    />
  );
}
