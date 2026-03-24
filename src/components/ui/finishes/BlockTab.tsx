"use client";

import { useStore } from '@/store/useStore';
import { BLOCK_PRESETS, type BlockPresetId } from '@/config/blockPresets';
import { Lock, Unlock, Copy, RotateCcw } from 'lucide-react';

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

  const handlePreset = (id: BlockPresetId) => {
    applyBlockConfig(containerId, indices, id);
  };

  const handleReset = () => {
    applyBlockConfig(containerId, indices, 'floor_ceil');
  };

  return (
    <div style={{ padding: '6px 12px' }}>
      {/* Preset grid — 4 columns */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
      }}>
        {BLOCK_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id;
          const Icon = preset.icon;
          return (
            <button
              key={preset.id}
              onClick={() => handlePreset(preset.id)}
              style={{
                display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
                gap: 2, padding: '8px 4px', borderRadius: 6,
                border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: isActive ? 'var(--accent-bg, rgba(0,188,212,0.08))' : 'var(--card-bg)',
                cursor: 'pointer', transition: 'border-color 100ms',
              }}
            >
              <Icon size={16} style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }} />
              <span style={{
                fontSize: 9, fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--accent)' : 'var(--text-main)',
              }}>
                {preset.label}
              </span>
            </button>
          );
        })}
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
