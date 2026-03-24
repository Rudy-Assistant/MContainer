'use client';

import type { VoxelFaces } from '@/types/container';
import { surfaceColor } from './surfaceColorMap';

interface IsometricVoxelSVGProps {
  faces: VoxelFaces;
  size?: number;
}

export function IsometricVoxelSVG({ faces, size = 64 }: IsometricVoxelSVGProps) {
  const topColor = surfaceColor(faces.top);
  const frontColor = surfaceColor(faces.s);
  const rightColor = surfaceColor(faces.e);
  const isOpenTop = faces.top === 'Open';
  const isOpenFront = faces.s === 'Open';
  const isOpenRight = faces.e === 'Open';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <polygon
        points="30,8 50,20 30,32 10,20"
        fill={topColor}
        stroke={isOpenTop ? '#94a3b8' : '#475569'}
        strokeWidth={isOpenTop ? 0.8 : 0.5}
        strokeDasharray={isOpenTop ? '2 2' : 'none'}
        opacity={isOpenTop ? 0.5 : 1}
      />
      <polygon
        points="10,20 30,32 30,52 10,40"
        fill={frontColor}
        stroke={isOpenFront ? '#94a3b8' : '#475569'}
        strokeWidth={isOpenFront ? 0.8 : 0.5}
        strokeDasharray={isOpenFront ? '2 2' : 'none'}
        opacity={isOpenFront ? 0.5 : 1}
      />
      <polygon
        points="30,32 50,20 50,40 30,52"
        fill={rightColor}
        stroke={isOpenRight ? '#94a3b8' : '#475569'}
        strokeWidth={isOpenRight ? 0.8 : 0.5}
        strokeDasharray={isOpenRight ? '2 2' : 'none'}
        opacity={isOpenRight ? 0.5 : 1}
      />
    </svg>
  );
}
