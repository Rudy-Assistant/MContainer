"use client";

import { useStore } from "@/store/useStore";
import { getWallTypesForContext, type WallTypeEntry } from "@/config/wallTypes";

interface Props {
  containerId: string;
  voxelIndex: number;
}

export default function WallTypePicker({ containerId, voxelIndex }: Props) {
  const inspectorView = useStore((s) => s.inspectorView);
  const selectedFace = useStore((s) => s.selectedFace);
  const paintFace = useStore((s) => s.paintFace);
  const addRecentItem = useStore((s) => s.addRecentItem);

  const types = getWallTypesForContext(inspectorView, selectedFace);

  const handleClick = (entry: WallTypeEntry) => {
    if (selectedFace) {
      paintFace(containerId, voxelIndex, selectedFace, entry.surface);
    } else {
      // Apply to all 4 wall faces
      for (const face of ['n', 's', 'e', 'w'] as const) {
        paintFace(containerId, voxelIndex, face, entry.surface);
      }
    }
    addRecentItem({ type: 'wallType', value: entry.surface, label: entry.label });
  };

  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
      }}>
        {selectedFace ? `${selectedFace.toUpperCase()} Face Type` : 'Wall Types'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {types.map((entry) => (
          <button
            key={entry.surface + '-' + entry.category}
            onClick={() => handleClick(entry)}
            title={entry.label}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 4px', borderRadius: 6,
              border: '1px solid #334155', background: '#1e293b',
              color: '#e2e8f0', cursor: 'pointer', fontSize: 10,
              transition: 'border-color 100ms',
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = '#334155')}
          >
            <span style={{ fontSize: 20 }}>{entry.icon}</span>
            <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{entry.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
