'use client';

import { useStore } from '@/store/useStore';
import { PresetCard } from './PresetCard';
import { IsometricVoxelSVG } from '../svg/IsometricVoxelSVG';
import { CONTAINER_LEVEL_PRESETS } from '@/config/containerTabPresets';

interface Props {
  containerId: string;
  onApply: (presetId: string) => void;
}

export function ContainerPresetRow({ containerId: _containerId, onApply }: Props) {
  const setGhostPreset = useStore((s) => s.setGhostPreset);
  const clearGhostPreset = useStore((s) => s.clearGhostPreset);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
      {CONTAINER_LEVEL_PRESETS.map(p => (
        <PresetCard
          key={p.id}
          content={<IsometricVoxelSVG faces={p.faces} size={48} />}
          label={p.label}
          active={false}
          onClick={() => onApply(p.id)}
          onMouseEnter={() => setGhostPreset({ source: 'container', faces: p.faces, targetScope: 'container' })}
          onMouseLeave={() => clearGhostPreset()}
        />
      ))}
    </div>
  );
}
