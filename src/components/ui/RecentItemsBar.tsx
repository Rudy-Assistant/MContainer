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
      background: 'var(--hotbar-bg)',
      backdropFilter: 'blur(16px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
      borderTop: '1px solid var(--hotbar-border)',
    }}>
      <span style={{
        fontSize: 10, color: 'var(--text-muted)', marginRight: 4,
        whiteSpace: 'nowrap', letterSpacing: '0.04em', fontWeight: 600,
        textTransform: 'uppercase',
      }}>Recent</span>
      {recentItems.map((item, i) => (
        <button
          key={item.value + '-' + i}
          onClick={() => applyRecent(i)}
          title={`${i + 1}: ${item.label}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 4,
            border: '1px solid var(--hotbar-slot-border)',
            background: 'var(--hotbar-slot-bg)',
            color: 'var(--hotbar-slot-label)',
            cursor: 'pointer', fontSize: 10,
            whiteSpace: 'nowrap',
            transition: 'border-color 100ms',
          }}
          onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--hotbar-slot-border)')}
        >
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>{i + 1}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
