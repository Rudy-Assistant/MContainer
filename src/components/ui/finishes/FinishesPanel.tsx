"use client";

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useSelectionTarget, type FaceKey } from '@/hooks/useSelectionTarget';
import VoxelPreview3D from '@/components/ui/VoxelPreview3D';
import FinishesTabBar, { faceToTab, type FinishTab } from './FinishesTabBar';
import FlooringTab from './FlooringTab';
import WallsTab from './WallsTab';
import CeilingTab from './CeilingTab';
import ElectricalTab from './ElectricalTab';

export default function FinishesPanel() {
  const target = useSelectionTarget();
  const selectedFace = useStore((s) => s.selectedFace) as FaceKey | null;

  const [activeTab, setActiveTab] = useState<FinishTab>('walls');

  // Auto-select tab when face changes
  useEffect(() => {
    const tab = faceToTab(selectedFace);
    if (tab) setActiveTab(tab);
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
    face: selectedFace || ('n' as FaceKey), // fallback, tabs guard on hasFace
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* VoxelPreview3D — face selector */}
      <div style={{ padding: '8px 8px 0' }}>
        <VoxelPreview3D
          containerId={containerId}
          voxelIndex={voxelIndex}
          bayGroupIndices={bayGroupIndices}
        />
      </div>

      {/* Tab bar */}
      <FinishesTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        disabled={!hasFace}
      />

      {/* Tab content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!hasFace ? (
          <div style={{ padding: '16px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim, #64748b)' }}>
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
