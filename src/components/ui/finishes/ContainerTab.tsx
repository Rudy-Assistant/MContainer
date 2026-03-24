'use client';

import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Layers, Box } from 'lucide-react';
import VoxelPreview3D from '@/components/ui/VoxelPreview3D';
import { ContainerPresetRow } from './ContainerPresetRow';
import { SpatialVoxelGrid } from './SpatialVoxelGrid';
import { CONTAINER_LEVEL_PRESETS } from '@/config/containerTabPresets';

interface Props {
  containerId: string;
}

export function ContainerTab({ containerId }: Props) {
  const { inspectorView, setInspectorView, frameMode, setFrameMode } = useStore(
    useShallow((s: any) => ({
      inspectorView: s.inspectorView as 'floor' | 'ceiling',
      setInspectorView: s.setInspectorView,
      frameMode: s.frameMode as boolean,
      setFrameMode: s.setFrameMode,
    }))
  );

  const { containers, stampArea, setSelectedVoxels } = useStore(
    useShallow((s: any) => ({
      containers: s.containers,
      stampArea: s.stampArea,
      setSelectedVoxels: s.setSelectedVoxels,
    }))
  );

  function handleApplyPreset(presetId: string) {
    const preset = CONTAINER_LEVEL_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const container = containers[containerId];
    if (!container?.voxelGrid) return;
    const activeIndices = container.voxelGrid
      .map((v: any, i: number) => (v.active ? i : -1))
      .filter((i: number) => i >= 0);
    if (activeIndices.length > 0) {
      stampArea(containerId, activeIndices, preset.faces);
    }
  }

  function handleCellClick(indices: number[]) {
    setSelectedVoxels({ containerId, indices });
  }

  const iconBtnStyle = (active: boolean, disabled?: boolean): React.CSSProperties => ({
    width: 28,
    height: 28,
    borderRadius: 6,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent)' : 'var(--btn-bg)',
    color: active ? '#fff' : disabled ? 'var(--text-dim)' : 'var(--text-muted)',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.4 : 1,
    transition: 'background 100ms, border-color 100ms',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 10px' }}>
      {/* VoxelPreview3D */}
      <VoxelPreview3D
        containerId={containerId}
        voxelIndex={0}
      />

      {/* Mode toggle icons row */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Floor/Ceiling toggle */}
        <button
          title={frameMode ? 'Floor/Ceiling (disabled in Frame Mode)' : `Switch to ${inspectorView === 'floor' ? 'Ceiling' : 'Floor'} view`}
          disabled={frameMode}
          onClick={() => !frameMode && setInspectorView(inspectorView === 'floor' ? 'ceiling' : 'floor')}
          style={iconBtnStyle(inspectorView === 'ceiling', frameMode)}
        >
          <Layers size={14} />
        </button>

        {/* Frame toggle */}
        <button
          title={frameMode ? 'Exit Frame Mode' : 'Enter Frame Mode'}
          onClick={() => setFrameMode(!frameMode)}
          style={iconBtnStyle(frameMode)}
        >
          <Box size={14} />
        </button>

        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 2 }}>
          {frameMode ? 'Frame Mode' : inspectorView === 'ceiling' ? 'Ceiling View' : 'Floor View'}
        </span>
      </div>

      {/* Container preset row */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Presets</div>
        <ContainerPresetRow containerId={containerId} onApply={handleApplyPreset} />
      </div>

      {/* Spatial voxel grid */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Spatial Grid</div>
        <SpatialVoxelGrid containerId={containerId} onCellClick={handleCellClick} />
      </div>
    </div>
  );
}
