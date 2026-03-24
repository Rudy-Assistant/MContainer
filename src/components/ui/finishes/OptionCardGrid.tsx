"use client";

import type { MaterialPreset } from '@/config/finishPresets';
import { PresetCard } from './PresetCard';
import { IsometricItemSVG } from '../svg/IsometricItemSVG';

interface Props {
  items: MaterialPreset[];
  activeId?: string;
  onSelect: (id: string, label: string) => void;
  label: string;
}

export default function OptionCardGrid({ items, activeId, onSelect, label }: Props) {
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
          <PresetCard
            key={item.id}
            content={<IsometricItemSVG itemId={item.id} />}
            label={item.label}
            active={item.id === activeId}
            onClick={() => onSelect(item.id, item.label)}
          />
        ))}
      </div>
    </div>
  );
}
