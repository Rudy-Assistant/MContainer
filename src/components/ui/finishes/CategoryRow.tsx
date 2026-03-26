'use client';
import { PresetCard } from './PresetCard';
import type { SurfaceCategory } from '@/config/surfaceCategories';

interface CategoryRowProps {
  categories: SurfaceCategory[];
  selected: string | null;
  onSelect: (categoryId: string) => void;
}

export default function CategoryRow({ categories, selected, onSelect }: CategoryRowProps) {
  return (
    <div>
      <div style={{
        fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const,
        letterSpacing: 1, marginBottom: 8,
      }}>Type</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
      }}>
        {categories.map(cat => (
          <PresetCard
            key={cat.id}
            content={<span style={{ fontSize: 24 }}>{cat.icon}</span>}
            label={cat.label}
            active={selected === cat.id}
            onClick={() => onSelect(cat.id)}
          />
        ))}
      </div>
    </div>
  );
}
