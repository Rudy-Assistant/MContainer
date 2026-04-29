'use client';

import { useStore, type StoreState } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Layers, Box } from 'lucide-react';
import { ContainerPresetRow } from './ContainerPresetRow';
import type { ContainerArrangementId } from '@/types/container';
import { CONTAINER_LEVEL_PRESETS } from '@/config/containerTabPresets';

interface Props {
  containerId: string;
}

export function ContainerTab({ containerId }: Props) {
  const { inspectorView, setInspectorView, frameMode, setFrameMode } = useStore(
    useShallow((s: StoreState) => ({
      inspectorView: s.inspectorView,
      setInspectorView: s.setInspectorView,
      frameMode: s.frameMode,
      setFrameMode: s.setFrameMode,
    }))
  );

  const { applyContainerArrangement, setGhostPreset, clearGhostPreset } = useStore(
    useShallow((s: StoreState) => ({
      applyContainerArrangement: s.applyContainerArrangement,
      setGhostPreset: s.setGhostPreset,
      clearGhostPreset: s.clearGhostPreset,
    }))
  );

  function handleApplyPreset(presetId: ContainerArrangementId) {
    applyContainerArrangement(containerId, presetId);
  }

  // Hover handlers for the inline Openings buttons — produce the same
  // translucent arrangement preview as the main ContainerPresetRow cards.
  const handleHoverPreset = (presetId: ContainerArrangementId) => {
    const preset = CONTAINER_LEVEL_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setGhostPreset({
      source: 'container',
      faces: preset.faces,
      targetScope: 'container',
      arrangementId: preset.id,
    });
  };

  const appliedPreset = useStore((s) => s.containers[containerId]?.appliedPreset);
  const activePreset = CONTAINER_LEVEL_PRESETS.find((preset) => preset.id === appliedPreset);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 10px', overflow: 'hidden' }}>
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
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Arrangements</div>
        <ContainerPresetRow containerId={containerId} onApply={handleApplyPreset} />
      </div>

      <div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>Openings</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button
            data-testid="btn-opening-atrium"
            type="button"
            title="Create a guarded central atrium opening"
            onClick={() => handleApplyPreset('central_atrium')}
            onMouseEnter={() => handleHoverPreset('central_atrium')}
            onMouseLeave={() => clearGhostPreset()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 30,
              padding: '5px 7px',
              borderRadius: 7,
              border: `1px solid ${appliedPreset === 'central_atrium' ? 'var(--accent)' : 'var(--border)'}`,
              background: appliedPreset === 'central_atrium' ? 'rgba(37,99,235,0.1)' : 'var(--btn-bg)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            <Layers size={13} />
            Atrium
          </button>
          <button
            data-testid="btn-opening-glass-atrium"
            type="button"
            title="Create a guarded central atrium opening with glass perimeter walls"
            onClick={() => handleApplyPreset('glass_atrium')}
            onMouseEnter={() => handleHoverPreset('glass_atrium')}
            onMouseLeave={() => clearGhostPreset()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 30,
              padding: '5px 7px',
              borderRadius: 7,
              border: `1px solid ${appliedPreset === 'glass_atrium' ? 'var(--accent)' : 'var(--border)'}`,
              background: appliedPreset === 'glass_atrium' ? 'rgba(37,99,235,0.1)' : 'var(--btn-bg)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            <Box size={13} />
            Glass Void
          </button>
        </div>
      </div>

      {activePreset && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '8px 10px',
          borderRadius: 8,
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.18)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-main)' }}>{activePreset.title}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 }}>
              {activePreset.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 9,
                    lineHeight: 1,
                    padding: '3px 5px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.7)',
                    color: 'var(--text-dim)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 10, lineHeight: 1.35, color: 'var(--text-dim)' }}>
            {activePreset.hint}
          </div>
        </div>
      )}
    </div>
  );
}
