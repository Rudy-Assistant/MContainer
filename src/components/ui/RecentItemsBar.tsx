"use client";

import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";
import type { SurfaceType } from "@/types/container";
import { useSelectedVoxel } from "@/hooks/useSelectedVoxel";

export default function RecentItemsBar() {
  const recentItems = useStore(useShallow((s) => s.recentItems));
  const paintFace = useStore((s) => s.paintFace);
  const selectedVoxel = useSelectedVoxel();
  const selectedFace = useStore((s) => s.selectedFace);

  const applyRecent = (index: number) => {
    const item = recentItems[index];
    if (!item || !selectedVoxel) return;

    const containerId = selectedVoxel.containerId;
    const voxelIndex = 'index' in selectedVoxel ? selectedVoxel.index : 0;

    if (item.type === 'wallType') {
      if (selectedFace) {
        paintFace(containerId, voxelIndex, selectedFace, item.value as SurfaceType);
      } else {
        // Apply to all wall faces
        for (const face of ['n', 's', 'e', 'w'] as const) {
          paintFace(containerId, voxelIndex, face, item.value as SurfaceType);
        }
      }
    }
  };

  if (recentItems.length === 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', height: 40,
      background: 'rgba(15, 23, 42, 0.95)',
      borderTop: '1px solid #1e293b',
    }}>
      <span style={{ fontSize: 10, color: '#64748b', marginRight: 4, whiteSpace: 'nowrap' }}>Recent:</span>
      {recentItems.map((item, i) => (
        <button
          key={item.value + '-' + i}
          onClick={() => applyRecent(i)}
          title={`${i + 1}: ${item.label}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 4,
            border: '1px solid #334155', background: '#1e293b',
            color: '#cbd5e1', cursor: 'pointer', fontSize: 10,
            whiteSpace: 'nowrap',
            transition: 'border-color 100ms',
          }}
          onMouseOver={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
          onMouseOut={(e) => (e.currentTarget.style.borderColor = '#334155')}
        >
          <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>{i + 1}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
