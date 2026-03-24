"use client";

import { useStore } from '@/store/useStore';
import { useSelectionTarget } from '@/hooks/useSelectionTarget';
import { BLOCK_PRESETS, type BlockPresetId } from '@/config/blockPresets';
import { VOXEL_COLS } from '@/types/container';
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
  const target = useSelectionTarget();
  const isBay = indices.length > 1;

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

  // Scope badge
  const row = Math.floor(voxelIndex / VOXEL_COLS);
  const col = voxelIndex % VOXEL_COLS;
  const zoneLabel = row === 0 || row === 3 || col === 0 || col === 7 ? 'Extension' : 'Body';

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* Scope badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 0 10px', borderBottom: '1px solid var(--border)',
        marginBottom: 10,
      }}>
        {isBay ? (
          <span style={{
            background: 'var(--accent-bg, #1a3a3a)',
            border: '1px solid var(--accent)',
            borderRadius: 4, padding: '2px 8px',
            color: 'var(--accent)', fontSize: 10, fontWeight: 600,
          }}>
            Bay · {indices.length} voxels
          </span>
        ) : (
          <span style={{
            background: 'var(--btn-bg)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '2px 8px',
            color: 'var(--text-muted)', fontSize: 10,
          }}>
            1 voxel
          </span>
        )}
        <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
          {`${zoneLabel} · Row ${row}, Col ${col}`}
        </span>
      </div>

      {/* Structural Presets */}
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
        letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8,
      }}>
        Structural Presets
      </div>
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
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
        letterSpacing: '0.05em', color: 'var(--text-muted)',
        marginTop: 14, marginBottom: 6,
      }}>
        Actions
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
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
