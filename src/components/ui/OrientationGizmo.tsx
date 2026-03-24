"use client";

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// 5 axes: +Y, +X, -X, +Z, -Z (no -Y — looking up from underground is useless)
const AXES = [
  { id: '+Y', dir: [0, 1, 0] as const, positive: true },
  { id: '+X', dir: [1, 0, 0] as const, positive: true },
  { id: '-X', dir: [-1, 0, 0] as const, positive: false },
  { id: '+Z', dir: [0, 0, 1] as const, positive: true },
  { id: '-Z', dir: [0, 0, -1] as const, positive: false },
];

const SIZE = 80;
const CENTER = SIZE / 2;
const AXIS_LEN = 28;
const SPHERE_R = 5; // uniform dot size for all axes
const COLOR_DEFAULT = '#94a3b8';
const COLOR_HOVER = '#ffffff';

interface Props {
  /** Shared ref updated every frame by Scene.tsx useFrame */
  cameraQuaternionRef: React.RefObject<THREE.Quaternion | null>;
  /** Called when user clicks an axis endpoint */
  onSnapToAxis: (dir: [number, number, number]) => void;
}

export default function OrientationGizmo({ cameraQuaternionRef, onSnapToAxis }: Props) {
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);
  const [projections, setProjections] = useState<{ id: string; x: number; y: number; positive: boolean; dir: readonly [number, number, number] }[]>([]);

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

  return (
    <div
      style={{
        position: 'absolute', top: 12, right: 12, width: SIZE, height: SIZE,
        pointerEvents: 'auto', zIndex: 10,
      }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Axes: lines + endpoint circles (no center origin dot) */}
        {projections.map((pt) => {
          const isHovered = hoveredAxis === pt.id;
          const color = isHovered ? COLOR_HOVER : COLOR_DEFAULT;
          const lineWidth = isHovered ? 2.5 : 1.5;
          const r = isHovered ? SPHERE_R + 1 : SPHERE_R;

          return (
            <g key={pt.id}>
              <line
                x1={CENTER} y1={CENTER} x2={pt.x} y2={pt.y}
                stroke={color} strokeWidth={lineWidth}
                opacity={pt.positive ? 1 : 0.6}
              />
              <circle
                cx={pt.x} cy={pt.y} r={r}
                fill={color}
                opacity={pt.positive ? 1 : 0.6}
                style={{ cursor: 'pointer', transition: 'fill 80ms' }}
                onMouseEnter={() => setHoveredAxis(pt.id)}
                onMouseLeave={() => setHoveredAxis(null)}
                onClick={() => onSnapToAxis([...pt.dir])}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
