'use client';
import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import BigCard from '../shared/BigCard';
import CategoryRow from '../shared/CategoryRow';

const THEMES = [
  { id: 'industrial', label: 'Industrial', colors: ['#333', '#666', '#999'], icon: '🏭' },
  { id: 'japanese', label: 'Japanese', colors: ['#8B4513', '#D2B48C', '#F5DEB3'], icon: '🏯' },
  { id: 'desert', label: 'Desert', colors: ['#C19A6B', '#D2691E', '#DEB887'], icon: '🏜️' },
];

const SURFACE_CATEGORIES = ['Walls', 'Floor', 'Ceiling', 'Exterior'] as const;

const MATERIAL_SWATCHES = [
  { id: 'steel', label: 'Steel', color: '#555555' },
  { id: 'glass', label: 'Glass', color: '#88ccff' },
  { id: 'wood', label: 'Wood', color: '#8B6914' },
  { id: 'concrete', label: 'Concrete', color: '#808080' },
  { id: 'railing', label: 'Railing', color: '#aaaaaa' },
  { id: 'deck', label: 'Deck Wood', color: '#a0764a' },
  { id: 'open', label: 'Open', color: 'transparent' },
];

export default function PaintTab() {
  const setTheme = useStore((s) => s.setTheme);
  const currentTheme = useStore((s) => s.currentTheme);
  const setActiveHotbarSlot = useStore((s) => s.setActiveHotbarSlot);
  const [activeCategory, setActiveCategory] = useState<string>('Walls');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <CategoryRow title="Choose a Style">
        {THEMES.map(({ id, label, icon }) => (
          <BigCard
            key={id}
            icon={icon}
            label={label}
            active={currentTheme === id}
            size="large"
            action={{ label: 'Apply', onClick: () => setTheme(id as any) }}
          />
        ))}
      </CategoryRow>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main, #0f172a)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Paint Surfaces
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {SURFACE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: activeCategory === cat ? '2px solid var(--accent, #2563eb)' : '1px solid var(--border, #e2e8f0)',
                background: activeCategory === cat ? 'rgba(37, 99, 235, 0.1)' : 'var(--surface, #ffffff)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                color: activeCategory === cat ? 'var(--accent, #2563eb)' : 'var(--text-main, #0f172a)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {MATERIAL_SWATCHES.map(({ id, label, color }) => (
            <div
              key={id}
              onClick={() => {
                const slotIdx = MATERIAL_SWATCHES.findIndex(m => m.id === id);
                if (slotIdx >= 0 && slotIdx < 10) setActiveHotbarSlot(slotIdx);
              }}
              style={{
                width: 80,
                height: 80,
                borderRadius: 12,
                background: color === 'transparent' ? 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 16px 16px' : color,
                border: '2px solid var(--border, #e2e8f0)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingBottom: 6,
                transition: 'transform 0.15s',
              }}
              title={`Apply ${label}`}
            >
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#fff',
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
