'use client';

import type { VoxelFaces } from '@/types/container';
import { surfaceColor } from './surfaceColorMap';

interface IsometricVoxelSVGProps {
  faces: VoxelFaces;
  size?: number;
}

/**
 * Isometric cube SVG showing 3 visible faces.
 *
 * Standard isometric projection shows top, south (front-left), east (front-right).
 * When top is Open AND bottom has a surface, we render the bottom face in the top
 * position (looking "into" the cube from above to see the floor).
 *
 * Open faces render as dotted wireframe outlines only (no fill).
 * Solid faces render as filled polygons with thin stroke.
 */
export function IsometricVoxelSVG({ faces, size = 64 }: IsometricVoxelSVGProps) {
  // Determine what to show in the top diamond:
  // If top is Open but bottom has a surface, show floor color in top position
  const hasFloor = faces.bottom !== 'Open';
  const showFloorInTop = faces.top === 'Open' && hasFloor;
  const topSurface = showFloorInTop ? faces.bottom : faces.top;
  const topColor = surfaceColor(topSurface);
  const isOpenTop = topSurface === 'Open';

  const frontColor = surfaceColor(faces.s);
  const isOpenFront = faces.s === 'Open';

  const rightColor = surfaceColor(faces.e);
  const isOpenRight = faces.e === 'Open';

  // Wireframe style for Open faces
  const wireStroke = '#94a3b8';
  const wireDash = '2 2';
  const wireWidth = 0.8;

  // Solid style for filled faces
  const solidStroke = '#475569';
  const solidWidth = 0.5;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Top face (diamond) — or floor seen from above */}
      <polygon
        points="30,8 50,20 30,32 10,20"
        fill={isOpenTop ? 'none' : topColor}
        stroke={isOpenTop ? wireStroke : solidStroke}
        strokeWidth={isOpenTop ? wireWidth : solidWidth}
        strokeDasharray={isOpenTop ? wireDash : 'none'}
      />

      {/* Front/south face (left trapezoid) */}
      <polygon
        points="10,20 30,32 30,52 10,40"
        fill={isOpenFront ? 'none' : frontColor}
        stroke={isOpenFront ? wireStroke : solidStroke}
        strokeWidth={isOpenFront ? wireWidth : solidWidth}
        strokeDasharray={isOpenFront ? wireDash : 'none'}
      />

      {/* Right/east face (right trapezoid) */}
      <polygon
        points="30,32 50,20 50,40 30,52"
        fill={isOpenRight ? 'none' : rightColor}
        stroke={isOpenRight ? wireStroke : solidStroke}
        strokeWidth={isOpenRight ? wireWidth : solidWidth}
        strokeDasharray={isOpenRight ? wireDash : 'none'}
      />
    </svg>
  );
}
