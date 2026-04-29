"use client";

import { useEffect, useState } from 'react';
import * as THREE from 'three';

// 5 axes: +Y, +X, -X, +Z, -Z (no -Y — looking up from underground is useless).
// Labels: +Y is UP, horizontal axes carry compass letters so the gizmo
// functions as both a camera snapper AND a cardinal-direction reference.
const AXES = [
  { id: '+Y', label: 'UP', dir: [0, 1, 0] as const, positive: true },
  { id: '+X', label: 'E',  dir: [1, 0, 0] as const, positive: true },
  { id: '-X', label: 'W',  dir: [-1, 0, 0] as const, positive: false },
  { id: '+Z', label: 'S',  dir: [0, 0, 1] as const, positive: true },
  { id: '-Z', label: 'N',  dir: [0, 0, -1] as const, positive: false },
];

const SIZE = 124;          // ~1.55x previous — readable labels + comfortable click targets
const CENTER = SIZE / 2;
const AXIS_LEN = 44;
const SPHERE_R = 9;        // larger hit area for labels
const LABEL_SIZE = 10;
const COLOR_DEFAULT = '#6b7280';
const COLOR_HOVER = '#111827';
const LABEL_FILL = '#ffffff';

interface Props {
  /** Shared ref updated every frame by Scene.tsx useFrame */
  cameraQuaternionRef: React.RefObject<THREE.Quaternion | null>;
  /** Called when user clicks an axis endpoint */
  onSnapToAxis: (dir: [number, number, number]) => void;
}

export default function OrientationGizmo({ cameraQuaternionRef, onSnapToAxis }: Props) {
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);
  const [projections, setProjections] = useState<{ id: string; label: string; x: number; y: number; positive: boolean; dir: readonly [number, number, number] }[]>([]);

  // Project axis directions using inverse camera quaternion each frame
  useEffect(() => {
    let raf: number;
    const tmpV = new THREE.Vector3();
    const tmpQ = new THREE.Quaternion();
    const lastQ = new THREE.Quaternion();

    const update = () => {
      const q = cameraQuaternionRef.current;
      if (!q) { raf = requestAnimationFrame(update); return; }

      // Skip re-render when camera hasn't moved
      if (lastQ.equals(q)) { raf = requestAnimationFrame(update); return; }
      lastQ.copy(q);

      tmpQ.copy(q).invert();
      const pts = AXES.map(axis => {
        tmpV.set(axis.dir[0], axis.dir[1], axis.dir[2]).applyQuaternion(tmpQ);
        return {
          id: axis.id,
          label: axis.label,
          x: CENTER + tmpV.x * AXIS_LEN,
          y: CENTER - tmpV.y * AXIS_LEN, // SVG Y is inverted
          positive: axis.positive,
          dir: axis.dir,
        };
      });
      setProjections(pts);
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [cameraQuaternionRef]);

  // Sort so positive/foreground axes render on top of negative/background ones.
  const sortedProjections = [...projections].sort((a, b) => Number(a.positive) - Number(b.positive));

  return (
    <div
      style={{
        position: 'absolute', bottom: 16, right: 16, width: SIZE, height: SIZE,
        pointerEvents: 'auto', zIndex: 10,
        background: 'rgba(255,255,255,0.55)',
        borderRadius: '999px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        backdropFilter: 'blur(8px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(8px) saturate(1.2)',
      }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Axes: lines + labeled endpoint bubbles (no center origin dot) */}
        {sortedProjections.map((pt) => {
          const isHovered = hoveredAxis === pt.id;
          const color = isHovered ? COLOR_HOVER : COLOR_DEFAULT;
          const lineWidth = isHovered ? 2.5 : 1.5;
          const r = isHovered ? SPHERE_R + 1 : SPHERE_R;

          return (
            <g key={pt.id}>
              <line
                x1={CENTER} y1={CENTER} x2={pt.x} y2={pt.y}
                stroke={color} strokeWidth={lineWidth}
                opacity={pt.positive ? 1 : 0.5}
              />
              <circle
                cx={pt.x} cy={pt.y} r={r}
                fill={color}
                opacity={pt.positive ? 1 : 0.55}
                style={{ cursor: 'pointer', transition: 'fill 150ms ease-out, r 150ms ease-out' }}
                onMouseEnter={() => setHoveredAxis(pt.id)}
                onMouseLeave={() => setHoveredAxis(null)}
                onClick={() => onSnapToAxis([...pt.dir])}
              />
              <text
                x={pt.x} y={pt.y}
                textAnchor="middle" dominantBaseline="central"
                fontSize={LABEL_SIZE} fontWeight={700} fill={LABEL_FILL}
                style={{ pointerEvents: 'none', userSelect: 'none', letterSpacing: '0.02em' }}
                opacity={pt.positive ? 1 : 0.55}
              >
                {pt.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
