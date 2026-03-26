"use client";

import { useStore } from '@/store/useStore';
import { BLOCK_PRESETS, type BlockPresetId } from '@/config/blockPresets';
import type { MaterialDef, VoxelFaces, SurfaceType } from '@/types/container';
import { Lock, Unlock, Copy, RotateCcw } from 'lucide-react';
import { PresetCard } from './PresetCard';
import { IsometricVoxelSVG } from '../svg/IsometricVoxelSVG';
import { useBlockThumbnail } from './BlockThumbnailContext';

function PresetCardWithThumbnail({ preset, active, onClick, onMouseEnter, onMouseLeave }: {
  preset: typeof BLOCK_PRESETS[number];
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const thumbnail = useBlockThumbnail(preset.id);
  return (
    <PresetCard
      content={thumbnail ? (
        <img src={thumbnail} alt={preset.label}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
      ) : <IsometricVoxelSVG faces={preset.faces} />}
      label={preset.label}
      active={active}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
}

interface Props {
  containerId: string;
  voxelIndex: number;
  indices: number[];
}

export default function BlockTab({ containerId, voxelIndex, indices }: Props) {
  const applyBlockConfig = useStore((s) => s.applyBlockConfig);
  const toggleLock = useStore((s) => s.toggleVoxelLock);
  const locked = useStore((s) => !!s.lockedVoxels?.[`${containerId}_${voxelIndex}`]);
  const copyStyle = useStore((s) => s.copyVoxelStyle);
  const setGhostPreset = useStore((s) => s.setGhostPreset);
  const clearGhostPreset = useStore((s) => s.clearGhostPreset);
  const triggerGhostPop = useStore((s) => s.triggerGhostPop);

  // Detect active preset by comparing current faces
  const voxel = useStore((s) => s.containers[containerId]?.voxelGrid?.[voxelIndex]);
  const activePresetId = voxel
    ? BLOCK_PRESETS.find(p =>
        p.faces.top === voxel.faces.top &&
        p.faces.bottom === voxel.faces.bottom &&
        p.faces.n === voxel.faces.n &&
        p.faces.s === voxel.faces.s &&
        p.faces.e === voxel.faces.e &&
        p.faces.w === voxel.faces.w
      )?.id ?? null
    : null;

  const handleReset = () => {
    applyBlockConfig(containerId, indices, 'floor_ceil');
  };

  return (
    <div style={{ padding: '6px 12px' }}>
      {/* Preset grid — 3 columns */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
      }}>
        {BLOCK_PRESETS.map((preset) => (
          <PresetCardWithThumbnail
            key={preset.id}
            preset={preset}
            active={activePresetId === preset.id}
            onClick={() => {
              triggerGhostPop();
              applyBlockConfig(containerId, indices, preset.id);
            }}
            onMouseEnter={() => {
              const materialMap: Partial<Record<keyof VoxelFaces, MaterialDef>> = {};
              for (const [fk, st] of Object.entries(preset.faces) as [keyof VoxelFaces, SurfaceType][]) {
                if (st !== 'Open') {
                  materialMap[fk] = { surfaceType: st };
                }
              }
              setGhostPreset({
                source: 'block',
                faces: preset.faces,
                targetScope: indices.length > 1 ? 'bay' : 'voxel',
                materialMap,
              });
            }}
            onMouseLeave={() => clearGhostPreset()}
          />
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button
          onClick={() => toggleLock(containerId, voxelIndex)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: '6px 4px', borderRadius: 4,
            border: '1px solid var(--border)', background: 'var(--card-bg)',
            cursor: 'pointer', fontSize: 9, color: 'var(--text-main)',
          }}
        >
          {locked ? <Unlock size={12} /> : <Lock size={12} />}
          {locked ? 'Unlock' : 'Lock'}
        </button>
        <button
          onClick={() => copyStyle(containerId, voxelIndex)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: '6px 4px', borderRadius: 4,
            border: '1px solid var(--border)', background: 'var(--card-bg)',
            cursor: 'pointer', fontSize: 9, color: 'var(--text-main)',
          }}
        >
          <Copy size={12} /> Copy
        </button>
        <button
          onClick={handleReset}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: '6px 4px', borderRadius: 4,
            border: '1px solid var(--border)', background: 'var(--card-bg)',
            cursor: 'pointer', fontSize: 9, color: 'var(--text-main)',
          }}
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>
    </div>
  );
}
