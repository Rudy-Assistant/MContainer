'use client';

import { Html } from '@react-three/drei';
import { useStore } from '@/store/useStore';
import { type SurfaceType, type VoxelFaces, CONTAINER_DIMENSIONS, VOXEL_COLS, VOXEL_ROWS } from '@/types/container';
import { useSelectedVoxel } from '@/hooks/useSelectedVoxel';
import { getVoxelLayout } from '@/components/objects/ContainerSkin';

// ── Surface labels ────────────────────────────────────────────

const SURFACE_LABELS: Record<string, string> = {
  Solid_Steel:       'Steel Wall',
  Glass_Pane:        'Glass',
  Open:              'Opening',
  Door:              'Door',
  Deck_Wood:         'Deck',
  Concrete:          'Concrete',
  Window_Standard:   'Window',
  Window_Half:       'Half Window',
  Window_Sill:       'Sill Window',
  Window_Clerestory: 'Clerestory',
  Railing_Cable:     'Cable Rail',
  Railing_Glass:     'Glass Rail',
  Wood_Hinoki:       'Hinoki',
  Wall_Washi:        'Washi',
  Glass_Shoji:       'Shoji',
  Floor_Tatami:      'Tatami',
};

const QUICK_MATERIALS: Array<{ type: SurfaceType; label: string; color: string }> = [
  { type: 'Solid_Steel',     label: 'Steel',  color: '#607080' },
  { type: 'Glass_Pane',      label: 'Glass',  color: '#a0c8e8' },
  { type: 'Open',            label: 'Open',   color: 'rgba(255,255,255,0.15)' },
  { type: 'Door',            label: 'Door',   color: '#8b6340' },
  { type: 'Window_Standard', label: 'Window', color: '#7dd3fc' },
  { type: 'Deck_Wood',       label: 'Deck',   color: '#a07040' },
];

// ── Position helper ──────────────────────────────────────────

function computeFaceWorldPosition(
  container: { position: { x: number; y: number; z: number }; rotation: number; size: string },
  voxelIndex: number,
  face: string,
): [number, number, number] {
  const dims = CONTAINER_DIMENSIONS[container.size as keyof typeof CONTAINER_DIMENSIONS];
  if (!dims) return [container.position.x, container.position.y + 1.5, container.position.z];

  const col = voxelIndex % VOXEL_COLS;
  const row = Math.floor(voxelIndex / VOXEL_COLS) % VOXEL_ROWS;

  const layout = getVoxelLayout(col, row, dims);
  const localX = layout.px;
  const localZ = layout.pz;
  const localY = dims.height / 2;

  const OFFSET = 0.5;
  const faceOffsets: Record<string, [number, number, number]> = {
    n:      [0,       0.3,  -OFFSET],
    s:      [0,       0.3,   OFFSET],
    e:      [-OFFSET, 0.3,   0],
    w:      [OFFSET,  0.3,   0],
    top:    [0,       OFFSET, 0],
    bottom: [0,      -OFFSET, 0],
  };
  const [ox, oy, oz] = faceOffsets[face] ?? [0, OFFSET, 0];

  const rot = container.rotation ?? 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const rx = cos * (localX + ox) - sin * (localZ + oz);
  const rz = sin * (localX + ox) + cos * (localZ + oz);

  return [
    container.position.x + rx,
    container.position.y + localY + oy,
    container.position.z + rz,
  ];
}

// ── Mini toggle ──────────────────────────────────────────────

function MiniToggle({ label, options, value, onChange }: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 9, color: '#64748b', width: 32 }}>{label}</span>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)}
          style={{
            padding: '1px 6px', fontSize: 9, borderRadius: 3, border: 'none', cursor: 'pointer',
            background: value === opt ? '#3b82f6' : 'rgba(255,255,255,0.08)',
            color: value === opt ? 'white' : '#94a3b8',
          }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── Widget content ───────────────────────────────────────────

function FaceWidget({ surfaceType, containerId, voxelIndex, face }: {
  surfaceType: SurfaceType;
  containerId: string;
  voxelIndex: number;
  face: keyof VoxelFaces;
}) {
  const isDoor = surfaceType === 'Door';
  const isWindow = surfaceType.startsWith('Window_');
  const voxel = useStore.getState().containers[containerId]?.voxelGrid?.[voxelIndex];
  const doorCfg = voxel?.doorConfig?.[face];

  return (
    <div
      data-testid="face-widget"
      className="face-context-widget"
      style={{
        background: 'rgba(15,15,20,0.88)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        padding: '8px 10px',
        minWidth: 140,
        color: 'white',
        fontSize: 11,
        fontFamily: 'system-ui, sans-serif',
        pointerEvents: 'all',
        userSelect: 'none',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Surface type label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 12 }}>
          {SURFACE_LABELS[surfaceType] ?? surfaceType}
        </span>
        <button
          onClick={() => useStore.getState().setVoxelFace(containerId, voxelIndex, face, 'Solid_Steel')}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 10, padding: '0 2px' }}
          title="Reset to Steel"
        >
          ✕
        </button>
      </div>

      {/* Door configuration */}
      {isDoor && doorCfg && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <MiniToggle label="Hinge" options={['left', 'right']} value={doorCfg.hingeEdge}
            onChange={v => useStore.getState().setDoorConfig(containerId, voxelIndex, face, { hingeEdge: v as any })} />
          <MiniToggle label="Swing" options={['in', 'out']} value={doorCfg.swingDirection}
            onChange={v => useStore.getState().setDoorConfig(containerId, voxelIndex, face, { swingDirection: v as any })} />
          <MiniToggle label="Type" options={['swing', 'slide']} value={doorCfg.type}
            onChange={v => useStore.getState().setDoorConfig(containerId, voxelIndex, face, { type: v as any })} />
        </div>
      )}

      {/* Window profile cycle */}
      {isWindow && (
        <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
          {(['Window_Half', 'Window_Standard', 'Window_Sill', 'Window_Clerestory'] as const).map(w => (
            <button key={w}
              onClick={() => useStore.getState().setVoxelFace(containerId, voxelIndex, face, w)}
              style={{
                padding: '2px 4px', fontSize: 9, borderRadius: 4, border: 'none', cursor: 'pointer',
                background: surfaceType === w ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                color: surfaceType === w ? 'white' : '#94a3b8',
              }}
              title={w.replace('Window_', '')}
            >
              {w === 'Window_Half' ? '½' : w === 'Window_Standard' ? '▣' : w === 'Window_Sill' ? '▤' : '▀'}
            </button>
          ))}
        </div>
      )}

      {/* Quick material swaps */}
      <div style={{ display: 'flex', gap: 3, marginTop: 6, flexWrap: 'wrap' }}>
        {QUICK_MATERIALS.map(({ type, label, color }) => (
          <button key={type}
            onClick={() => useStore.getState().setVoxelFace(containerId, voxelIndex, face, type)}
            style={{
              width: 22, height: 22, borderRadius: 4,
              border: surfaceType === type ? '2px solid white' : '1px solid rgba(255,255,255,0.15)',
              background: color, cursor: 'pointer',
            }}
            title={label}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────

export function FaceContextWidget() {
  const selectedVoxel = useSelectedVoxel();
  const selectedFace = useStore((s) => s.selectedFace);
  const containers = useStore((s) => s.containers);
  const activeBrush = useStore((s) => s.activeBrush);

  if (!selectedVoxel || activeBrush || selectedVoxel.isExtension) return null;
  if (!selectedFace) return null;

  const { containerId, index: voxelIndex } = selectedVoxel as { containerId: string; index: number };
  const container = containers[containerId];
  if (!container) return null;

  const voxel = container.voxelGrid?.[voxelIndex];
  const surfaceType = voxel?.faces?.[selectedFace];
  if (!surfaceType) return null;

  const worldPos = computeFaceWorldPosition(container, voxelIndex, selectedFace);

  return (
    <Html position={worldPos} center distanceFactor={12} zIndexRange={[100, 0]}>
      <FaceWidget
        surfaceType={surfaceType}
        containerId={containerId}
        voxelIndex={voxelIndex}
        face={selectedFace}
      />
    </Html>
  );
}
