'use client';

import { useStore } from '@/store/useStore';
import { ContainerPresetCard } from './ContainerPresetCard';
import { IsometricVoxelSVG } from '../svg/IsometricVoxelSVG';
import { CONTAINER_LEVEL_PRESETS } from '@/config/containerTabPresets';
import type { ContainerArrangementId } from '@/types/container';

interface Props {
  containerId: string;
  onApply: (presetId: ContainerArrangementId) => void;
}

export function ContainerPresetRow({ containerId, onApply }: Props) {
  const setGhostPreset = useStore((s) => s.setGhostPreset);
  const clearGhostPreset = useStore((s) => s.clearGhostPreset);
  const appliedPreset = useStore((s) => s.containers[containerId]?.appliedPreset);
  const groupedPresets = CONTAINER_LEVEL_PRESETS.reduce<Record<string, typeof CONTAINER_LEVEL_PRESETS>>((acc, preset) => {
    if (!acc[preset.category]) acc[preset.category] = [];
    acc[preset.category].push(preset);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {Object.entries(groupedPresets).map(([category, presets]) => (
        <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{category}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, minWidth: 0 }}>
            {presets.map((p) => (
              <ContainerPresetCard
                key={p.id}
                content={<IsometricVoxelSVG faces={p.faces} size={48} />}
                label={p.label}
                title={p.title}
                active={appliedPreset === p.id}
                onClick={() => onApply(p.id)}
                onMouseEnter={() => setGhostPreset({ source: 'container', faces: p.faces, targetScope: 'container' })}
                onMouseLeave={() => clearGhostPreset()}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
