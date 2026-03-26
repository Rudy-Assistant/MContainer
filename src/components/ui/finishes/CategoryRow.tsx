'use client';
import { PresetCard } from './PresetCard';
import type { SurfaceCategory } from '@/config/surfaceCategories';
import { sectionHeaderStyle } from './sectionHeaderStyle';

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
        {categories.map(cat => (
          <PresetCard
            key={cat.id}
            icon={cat.icon}
            iconSize={32}
            label={cat.label}
            active={selected === cat.id}
            onClick={() => onSelect(cat.id)}
          />
        ))}
      </div>
    </div>
  );
}
