'use client';

import { useStore, type StoreState } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Layers, Box } from 'lucide-react';
import { ContainerPresetRow } from './ContainerPresetRow';
import type { ContainerArrangementId } from '@/types/container';

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

  const { applyContainerArrangement } = useStore(
    useShallow((s: StoreState) => ({
      applyContainerArrangement: s.applyContainerArrangement,
    }))
  );

  function handleApplyPreset(presetId: ContainerArrangementId) {
    applyContainerArrangement(containerId, presetId);
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
    </div>
  );
}
