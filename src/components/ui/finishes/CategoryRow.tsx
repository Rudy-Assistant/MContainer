'use client';
import { PresetCard } from './PresetCard';
import type { SurfaceCategory } from '@/config/surfaceCategories';
import { sectionHeaderStyle } from './sectionHeaderStyle';
import { getCategoryIcon } from './categoryIcons';

interface CategoryRowProps {
  categories: SurfaceCategory[];
  selected: string | null;
  onSelect: (categoryId: string) => void;
  label?: string;
}

export default function CategoryRow({ categories, selected, onSelect, label = 'Type' }: CategoryRowProps) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={sectionHeaderStyle()}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {categories.map(cat => {
          // Prefer the curated SVG icon; fall back to the data-config emoji
          // so existing categories without a mapping still render.
          const svgIcon = getCategoryIcon(cat.id);
          return (
            <PresetCard
              key={cat.id}
              icon={svgIcon ?? cat.icon}
              iconSize={32}
              label={cat.label}
              active={selected === cat.id}
              onClick={() => onSelect(cat.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
