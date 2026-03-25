'use client';

import type { VoxelFaces, SurfaceType } from '@/types/container';
import { isRailingSurface } from '@/types/container';
import { surfaceColor } from './surfaceColorMap';

interface IsometricVoxelSVGProps {
  faces: VoxelFaces;
  size?: number;
}

/**
 * Isometric cube SVG showing up to 5 visible faces with detail overlays.
 *
 * Renders: top diamond, front-left wall, front-right wall, and floor plane.
 * Open faces → dotted wireframe. Solid/Glass/Railing → filled + overlay detail.
 *
 * Detail overlays:
 *   Railing_Cable  → horizontal lines (cable rail)
 *   Railing_Glass  → single horizontal line + fill
 *   Glass_Pane / Window_*  → cross-hatch (window grid)
 *   Half_Fold      → horizontal fold line
 *   Gull_Wing      → upward hinge line
 */
const isOpen = (s: SurfaceType) => s === 'Open';
const isGlass = (s: SurfaceType) => s === 'Glass_Pane' || s === 'Window_Standard' || s === 'Window_Sill' || s === 'Window_Clerestory' || s === 'Window_Half';
const isFold = (s: SurfaceType) => s === 'Half_Fold';
const isGull = (s: SurfaceType) => s === 'Gull_Wing';

const WIRE = { stroke: '#94a3b8', strokeWidth: 0.8, strokeDasharray: '2 2' } as const;
const SOLID = { stroke: '#475569', strokeWidth: 0.5, strokeDasharray: 'none' } as const;

function faceProps(surface: string, color: string) {
  const open = isOpen(surface);
  return {
    fill: open ? 'none' : color,
    stroke: open ? WIRE.stroke : SOLID.stroke,
    strokeWidth: open ? WIRE.strokeWidth : SOLID.strokeWidth,
    strokeDasharray: open ? WIRE.strokeDasharray : SOLID.strokeDasharray,
  };
}

export function IsometricVoxelSVG({ faces, size = 64 }: IsometricVoxelSVGProps) {
  const topColor = surfaceColor(faces.top);
  const bottomColor = surfaceColor(faces.bottom);
  const frontColor = surfaceColor(faces.s);
  const rightColor = surfaceColor(faces.e);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Bottom/floor plane — visible below the cube */}
      {!isOpen(faces.bottom) && (
        <polygon
          points="30,40 50,28 50,32 30,44 10,32 10,28"
          fill={bottomColor}
          stroke="#475569"
          strokeWidth={0.4}
          opacity={0.85}
        />
      )}

      {/* Top face (diamond) */}
      <polygon
        points="30,6 50,18 30,30 10,18"
        {...faceProps(faces.top, topColor)}
      />

      {/* Front/south face (left trapezoid) */}
      <polygon
        points="10,18 30,30 30,44 10,32"
        {...faceProps(faces.s, frontColor)}
      />

      {/* Front face overlays */}
      {isRailingSurface(faces.s) && (
        <g stroke="#334155" strokeWidth={0.6} opacity={0.7}>
          {/* Vertical posts */}
          <line x1={14} y1={20} x2={14} y2={34} />
          <line x1={20} y1={24} x2={20} y2={38} />
          <line x1={26} y1={28} x2={26} y2={42} />
          {/* Horizontal cables */}
          <line x1={12} y1={24} x2={28} y2={36} />
          <line x1={12} y1={28} x2={28} y2={40} />
        </g>
      )}
      {isGlass(faces.s) && (
        <g stroke="#1e40af" strokeWidth={0.5} opacity={0.5}>
          <line x1={12} y1={25} x2={28} y2={37} />
          <line x1={20} y1={24} x2={20} y2={38} />
        </g>
      )}
      {isFold(faces.s) && (
        <line x1={11} y1={26} x2={29} y2={38} stroke="#92400e" strokeWidth={1} strokeDasharray="3 2" opacity={0.7} />
      )}
      {isGull(faces.s) && (
        <line x1={11} y1={23} x2={29} y2={35} stroke="#6b21a8" strokeWidth={1} strokeDasharray="3 2" opacity={0.7} />
      )}

      {/* Right/east face (right trapezoid) */}
      <polygon
        points="30,30 50,18 50,32 30,44"
        {...faceProps(faces.e, rightColor)}
      />

      {/* Right face overlays */}
      {isRailingSurface(faces.e) && (
        <g stroke="#334155" strokeWidth={0.6} opacity={0.7}>
          <line x1={34} y1={28} x2={34} y2={42} />
          <line x1={40} y1={24} x2={40} y2={38} />
          <line x1={46} y1={20} x2={46} y2={34} />
          <line x1={32} y1={36} x2={48} y2={24} />
          <line x1={32} y1={40} x2={48} y2={28} />
        </g>
      )}
      {isGlass(faces.e) && (
        <g stroke="#1e40af" strokeWidth={0.5} opacity={0.5}>
          <line x1={32} y1={37} x2={48} y2={25} />
          <line x1={40} y1={24} x2={40} y2={38} />
        </g>
      )}
      {isFold(faces.e) && (
        <line x1={31} y1={38} x2={49} y2={26} stroke="#92400e" strokeWidth={1} strokeDasharray="3 2" opacity={0.7} />
      )}
      {isGull(faces.e) && (
        <line x1={31} y1={35} x2={49} y2={23} stroke="#6b21a8" strokeWidth={1} strokeDasharray="3 2" opacity={0.7} />
      )}
    </svg>
  );
}
