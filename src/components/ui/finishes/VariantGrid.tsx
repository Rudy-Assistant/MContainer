'use client';
import { PresetCard } from './PresetCard';
import { useStore } from '@/store/useStore';
import type { SurfaceCategory, CategoryVariant } from '@/config/surfaceCategories';
import { EMPTY_FACES, type SurfaceType, type VoxelFaces, type MaterialDef } from '@/types/container';
import { sectionHeaderStyle } from './sectionHeaderStyle';

interface VariantGridProps {
  category: SurfaceCategory;
  currentSurface: SurfaceType | null;
  currentFinish: Record<string, string> | null;
  containerId: string;
  indices: number[];
  face: keyof VoxelFaces;
  ghostSource: 'walls' | 'flooring' | 'ceiling';
}

export default function VariantGrid({
  category, currentSurface, currentFinish, containerId, indices, face, ghostSource,
}: VariantGridProps) {
  const paintFace = useStore((s) => s.paintFace);
  const setFaceFinish = useStore((s) => s.setFaceFinish);
  const applyStairsFromFace = useStore((s) => s.applyStairsFromFace);
  const setActiveBrush = useStore((s) => s.setActiveBrush);
  const setStampPreview = useStore((s) => s.setStampPreview);
  const addRecentItem = useStore((s) => s.addRecentItem);
  const setGhostPreset = useStore((s) => s.setGhostPreset);
  const clearGhostPreset = useStore((s) => s.clearGhostPreset);
  const triggerGhostPop = useStore((s) => s.triggerGhostPop);
  const currentFaces = useStore((s) => {
    const v = s.containers[containerId]?.voxelGrid?.[indices[0]];
    return v?.faces ?? EMPTY_FACES;
  });

  if (category.placeholder) {
    return (
      <div style={{
        padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12,
        fontStyle: 'italic', opacity: 0.6,
      }}>
        Coming soon
      </div>
    );
  }

  const isVariantActive = (variant: CategoryVariant): boolean => {
    if (currentSurface !== variant.surfaceType) return false;
    if (variant.finishMeta?.doorStyle) {
      return currentFinish?.doorStyle === variant.finishMeta.doorStyle;
    }
    if (!variant.finishMeta && currentSurface === 'Door') {
      return !currentFinish?.doorStyle;
    }
    return true;
  };

  const handleSelect = (variant: CategoryVariant) => {
    triggerGhostPop();
    if (category.volumetric) {
      for (const idx of indices) {
        applyStairsFromFace(containerId, idx, face as 'n' | 's' | 'e' | 'w' | 'top');
      }
      return;
    }
    for (const idx of indices) {
      paintFace(containerId, idx, face, variant.surfaceType);
      if (variant.finishMeta) {
        setFaceFinish(containerId, idx, face, variant.finishMeta);
      }
    }
    addRecentItem({ type: 'wallType', value: variant.surfaceType, label: variant.label, icon: variant.icon });
  };

  const handleHover = (variant: CategoryVariant) => {
    if (category.volumetric) return;
    setActiveBrush(variant.surfaceType);
    if (indices.length > 0) {
      setStampPreview({ surfaceType: variant.surfaceType, containerId, voxelIndex: indices[0] });
      const materialMap: Partial<Record<keyof VoxelFaces, MaterialDef>> = {
        [face]: { surfaceType: variant.surfaceType, finishMeta: variant.finishMeta },
      };
      setGhostPreset({
        source: ghostSource,
        faces: { ...currentFaces, [face]: variant.surfaceType },
        targetScope: indices.length > 1 ? 'bay' : 'voxel',
        materialMap,
      });
    }
  };

  const handleLeave = () => {
    if (category.volumetric) return;
    setActiveBrush(null);
    useStore.getState().clearStampPreview();
    clearGhostPreset();
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={sectionHeaderStyle()}>{category.label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {category.variants.map(variant => (
          <PresetCard
            key={variant.id}
            icon={variant.icon}
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
