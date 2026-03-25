"use client";

import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useSelectionTarget, type FaceKey } from '@/hooks/useSelectionTarget';
import VoxelPreview3D from '@/components/ui/VoxelPreview3D';
import FinishesTabBar, { faceToTab, type FinishTab } from './FinishesTabBar';
import FlooringTab from './FlooringTab';
import WallsTab from './WallsTab';
import CeilingTab from './CeilingTab';
import ElectricalTab from './ElectricalTab';
import BlockTab from './BlockTab';
import { ContainerTab } from './ContainerTab';
import { SpatialVoxelGrid } from './SpatialVoxelGrid';

export default function FinishesPanel() {
  const target = useSelectionTarget();
  const selectedFace = useStore((s) => s.selectedFace) as FaceKey | null;
  const clearSelection = useStore((s) => s.clearSelection);
  const clearGhostPreset = useStore((s) => s.clearGhostPreset);

  // Auto-select tab on face change; manual clicks override freely
  const [activeTab, setActiveTab] = useState<FinishTab>('container');
  const prevFace = useRef(selectedFace);
  useEffect(() => {
    if (selectedFace !== prevFace.current) {
      prevFace.current = selectedFace;
      const tab = faceToTab(selectedFace);
      if (tab) setActiveTab(tab);
    }
  }, [selectedFace]);

  // Derive containerId, voxelIndex, indices from target
  let containerId = '';
  let voxelIndex = 0;
  let indices: number[] = [];
  let bayGroupIndices: number[] | undefined;

  if (target.type === 'face') {
    containerId = target.containerId;
    voxelIndex = target.index;
    indices = [voxelIndex];
  } else if (target.type === 'bay-face') {
    containerId = target.containerId;
    voxelIndex = target.indices[0];
    indices = target.indices;
    bayGroupIndices = target.indices;
  } else if (target.type === 'voxel') {
    containerId = target.containerId;
    voxelIndex = target.index;
    indices = [voxelIndex];
  } else if (target.type === 'bay') {
    containerId = target.containerId;
    voxelIndex = target.indices[0];
    indices = target.indices;
    bayGroupIndices = target.indices;
  }

  if (!containerId) return null;

  const hasFace = !!selectedFace;

  const tabProps = {
    containerId,
    voxelIndex,
    indices,
    face: selectedFace || ('n' as FaceKey),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 6px',
      }}>
        <span style={{
          fontSize: 13, fontWeight: 700, color: 'var(--text-main)',
          letterSpacing: '-0.01em',
        }}>
          Interior Finishes
        </span>
        <button
          onClick={() => { clearSelection(); clearGhostPreset(); }}
          title="Close"
          style={{
            width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'var(--btn-bg)',
            color: 'var(--text-muted)', fontSize: 13, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>

      {/* VoxelPreview3D — face selector */}
      <div style={{ padding: '0 8px 4px' }}>
        <VoxelPreview3D
          containerId={containerId}
          voxelIndex={voxelIndex}
          bayGroupIndices={bayGroupIndices}
        />
      </div>

      {/* Spatial voxel grid — always visible above tabs */}
      <div style={{ padding: '4px 8px 6px' }}>
        <SpatialVoxelGrid containerId={containerId} />
      </div>

      {/* Tab bar */}
      <FinishesTabBar
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); clearGhostPreset(); }}
      />

      {/* Tab content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'container' ? (
          <ContainerTab containerId={containerId} />
        ) : activeTab === 'block' ? (
          <BlockTab containerId={containerId} voxelIndex={voxelIndex} indices={indices} />
        ) : !hasFace ? (
          <div style={{ padding: '24px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Click a face in the preview to edit finishes
            </div>
          </div>
        ) : activeTab === 'flooring' ? (
          <FlooringTab {...tabProps} />
        ) : activeTab === 'walls' ? (
          <WallsTab {...tabProps} />
        ) : activeTab === 'ceiling' ? (
          <CeilingTab {...tabProps} />
        ) : activeTab === 'electrical' ? (
          <ElectricalTab {...tabProps} />
        ) : null}
      </div>
    </div>
  );
}
