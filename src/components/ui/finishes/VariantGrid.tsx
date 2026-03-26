'use client';
import { PresetCard } from './PresetCard';
import { useStore } from '@/store/useStore';
import type { SurfaceCategory, CategoryVariant } from '@/config/surfaceCategories';
import type { SurfaceType } from '@/types/container';

interface VariantGridProps {
  category: SurfaceCategory;
  currentSurface: SurfaceType | null;
  currentFinish: Record<string, string> | null; // for doorStyle matching
  containerId: string;
  indices: number[];
  face: string;
}

export default function VariantGrid({
  category, currentSurface, currentFinish, containerId, indices, face,
}: VariantGridProps) {
  // Read store actions (individual selectors, NOT useStore(s=>s))
  const paintFace = useStore((s) => s.paintFace);
  const setFaceFinish = useStore((s) => s.setFaceFinish);
  const applyStairsFromFace = useStore((s) => s.applyStairsFromFace);
  const setActiveBrush = useStore((s) => s.setActiveBrush);
  const setStampPreview = useStore((s) => s.setStampPreview);
  const addRecentItem = useStore((s) => s.addRecentItem);

  if (category.placeholder) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        Coming soon
      </div>
    );
  }

  // Handle door variants: all share SurfaceType 'Door', differentiated by finishMeta.doorStyle
  const isVariantActive = (variant: CategoryVariant): boolean => {
    if (currentSurface !== variant.surfaceType) return false;
    if (variant.finishMeta?.doorStyle) {
      return currentFinish?.doorStyle === variant.finishMeta.doorStyle;
    }
    if (!variant.finishMeta && currentSurface === 'Door') {
      return !currentFinish?.doorStyle; // Default swing has no doorStyle
    }
    return true;
  };

  const handleSelect = (variant: CategoryVariant) => {
    if (category.volumetric) {
      // Stairs use applyStairsFromFace
      for (const idx of indices) {
        applyStairsFromFace(containerId, idx, face as 'n' | 's' | 'e' | 'w' | 'top');
      }
      return;
    }
    for (const idx of indices) {
      paintFace(containerId, idx, face as keyof import('@/types/container').VoxelFaces, variant.surfaceType);
      if (variant.finishMeta) {
        setFaceFinish(containerId, idx, face as keyof import('@/types/container').VoxelFaces, variant.finishMeta);
      }
    }
    addRecentItem({ type: 'wallType', value: variant.surfaceType, label: variant.label, icon: variant.icon });
  };

  const handleHover = (variant: CategoryVariant) => {
    if (category.volumetric) return; // Stair ghost deferred
    setActiveBrush(variant.surfaceType);
    if (indices.length > 0) {
      setStampPreview({
        surfaceType: variant.surfaceType,
        containerId,
        voxelIndex: indices[0],
      });
    }
  };

  const handleLeave = () => {
    if (category.volumetric) return;
    setActiveBrush(null);
    useStore.getState().clearStampPreview();
  };

  return (
    <div>
      <div style={{
        fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const,
        letterSpacing: 1, marginBottom: 8, marginTop: 16,
      }}>{category.label} — Variants</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
      }}>
        {category.variants.map(variant => (
          <PresetCard
            key={variant.id}
            content={<span style={{ fontSize: 20 }}>{variant.icon}</span>}
            label={variant.label}
            active={isVariantActive(variant)}
            onClick={() => handleSelect(variant)}
            onMouseEnter={() => handleHover(variant)}
            onMouseLeave={handleLeave}
          />
        ))}
      </div>
    </div>
  );
}
