"use client";

import type { MaterialPreset } from '@/config/finishPresets';
import { PresetCard } from './PresetCard';
import { IsometricItemSVG } from '../svg/IsometricItemSVG';
import { sectionHeaderStyle } from './sectionHeaderStyle';

interface Props {
  items: MaterialPreset[];
  activeId?: string;
  onSelect: (id: string, label: string) => void;
  label: string;
  onHoverItem?: (id: string) => void;
  onLeaveItem?: () => void;
}

export default function OptionCardGrid({ items, activeId, onSelect, label, onHoverItem, onLeaveItem }: Props) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={sectionHeaderStyle()}>
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
            onMouseEnter={onHoverItem ? () => onHoverItem(item.id) : undefined}
            onMouseLeave={onLeaveItem}
          />
        ))}
      </div>
    </div>
  );
}
