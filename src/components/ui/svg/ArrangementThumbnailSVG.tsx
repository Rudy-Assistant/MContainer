'use client';

import type { ContainerArrangementSpec } from '@/config/containerArrangements';
import type { ModelHome } from '@/config/modelHomes';
import type { SurfaceType } from '@/types/container';
import { surfaceColor } from './surfaceColorMap';

interface ArrangementThumbnailSVGProps {
  arrangement?: ContainerArrangementSpec;
  model?: ModelHome;
  size?: number;
}

const CELL = 3.5;
const HALF = CELL / 2;
const STORY = 9;
const OX = 38;
const OY = 30;

function iso(c: number, r: number, z: number): [number, number] {
  const cc = c - 4;
  const rr = r - 2;
  return [OX + (cc - rr) * CELL, OY + (cc + rr) * HALF - z];
}

const fmt = (pts: [number, number][]): string =>
  pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

function shade(hex: string, amount: number): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  if (amount < 0) {
    const k = 1 + amount;
    r = Math.max(0, Math.round(r * k));
    g = Math.max(0, Math.round(g * k));
    b = Math.max(0, Math.round(b * k));
  } else {
    r = Math.min(255, Math.round(r + (255 - r) * amount));
    g = Math.min(255, Math.round(g + (255 - g) * amount));
    b = Math.min(255, Math.round(b + (255 - b) * amount));
  }
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function isGlass(s?: SurfaceType): boolean {
  if (!s) return false;
  return s.startsWith('Glass_') || s.startsWith('Window_') || s === 'Railing_Glass';
}

function isOpen(s?: SurfaceType): boolean {
  return !s || s === 'Open';
}

function renderArrangement(spec: ContainerArrangementSpec) {
  const stories = spec.upperLevelMode === 'full_shell' ? 2 : 1;
  const upperRing = spec.upperLevelMode === 'extensions_only';

  const wallSurface = spec.perimeterWall;
  const roofSurface = spec.roof;
  const wallColorBase = wallSurface ? surfaceColor(wallSurface) : '#cbd5e1';
  const roofColorBase = roofSurface ? surfaceColor(roofSurface) : '#cbd5e1';
  const wallGlass = isGlass(wallSurface);
  const wallOpen = isOpen(wallSurface);
  const roofOpen = isOpen(roofSurface);

  const totalH = STORY * stories;
  const c0 = 0;
  const c1 = 8;
  const r0 = 0;
  const r1 = 4;

  const A0 = iso(c0, r0, 0);
  const B0 = iso(c1, r0, 0);
  const C0 = iso(c1, r1, 0);
  const D0 = iso(c0, r1, 0);
  const A1 = iso(c0, r0, totalH);
  const B1 = iso(c1, r0, totalH);
  const C1 = iso(c1, r1, totalH);
  const D1 = iso(c0, r1, totalH);

  const southWall = fmt([D0, C0, C1, D1]);
  const eastWall = fmt([C0, B0, B1, C1]);
  const roofTop = fmt([A1, B1, C1, D1]);

  const storyLines: string[] = [];
  for (let s = 1; s < stories; s++) {
    const z = STORY * s;
    const ls = iso(c0, r1, z);
    const lc = iso(c1, r1, z);
    const lb = iso(c1, r0, z);
    storyLines.push(`M${ls[0].toFixed(1)},${ls[1].toFixed(1)} L${lc[0].toFixed(1)},${lc[1].toFixed(1)} L${lb[0].toFixed(1)},${lb[1].toFixed(1)}`);
  }

  const doorRects: React.ReactNode[] = [];
  if (spec.doorCols?.length) {
    const doorH = STORY * 0.65;
    for (const col of spec.doorCols) {
      const dl = iso(col, r1, 0);
      const dr = iso(col + 1, r1, 0);
      const dlt = iso(col, r1, doorH);
      const drt = iso(col + 1, r1, doorH);
      doorRects.push(
        <polygon
          key={`door-${col}`}
          points={fmt([dl, dr, drt, dlt])}
          fill="#7dd3fc"
          stroke="#1e40af"
          strokeWidth="0.4"
          opacity={0.92}
        />
      );
    }
  }

  let voidPoly: React.ReactNode = null;
  if (spec.voidCols?.length && spec.voidRows?.length) {
    const vc0 = Math.min(...spec.voidCols);
    const vc1 = Math.max(...spec.voidCols) + 1;
    const vr0 = Math.min(...spec.voidRows);
    const vr1 = Math.max(...spec.voidRows) + 1;
    voidPoly = (
      <polygon
        points={fmt([
          iso(vc0, vr0, totalH),
          iso(vc1, vr0, totalH),
          iso(vc1, vr1, totalH),
          iso(vc0, vr1, totalH),
        ])}
        fill="#ffffff"
        stroke="#2563eb"
        strokeWidth="0.7"
        strokeDasharray="2 1.4"
        opacity={0.92}
      />
    );
  }

  let terrace: React.ReactNode = null;
  if (upperRing) {
    const z0 = STORY;
    const z1 = STORY + STORY * 0.55;
    const baseA = iso(c0, r0, z0);
    const baseB = iso(c1, r0, z0);
    const baseC = iso(c1, r1, z0);
    const baseD = iso(c0, r1, z0);
    const railB = iso(c1, r0, z1);
    const railC = iso(c1, r1, z1);
    const railD = iso(c0, r1, z1);
    terrace = (
      <g>
        <polygon
          points={fmt([baseA, baseB, baseC, baseD])}
          fill={shade(roofColorBase, 0.05)}
          stroke="#0f172a"
          strokeWidth="0.5"
          opacity={0.95}
        />
        <polyline
          points={fmt([railD, railC, railB])}
          fill="none"
          stroke="#1e40af"
          strokeWidth="0.7"
        />
        <line x1={baseD[0]} y1={baseD[1]} x2={railD[0]} y2={railD[1]} stroke="#1e40af" strokeWidth="0.5" />
        <line x1={baseC[0]} y1={baseC[1]} x2={railC[0]} y2={railC[1]} stroke="#1e40af" strokeWidth="0.5" />
        <line x1={baseB[0]} y1={baseB[1]} x2={railB[0]} y2={railB[1]} stroke="#1e40af" strokeWidth="0.5" />
      </g>
    );
  }

  return (
    <g>
      <polygon
        points={southWall}
        fill={wallOpen ? 'none' : wallColorBase}
        stroke="#0f172a"
        strokeWidth="0.6"
        strokeDasharray={wallOpen ? '2 1.5' : 'none'}
        opacity={wallGlass ? 0.55 : wallOpen ? 0.5 : 0.95}
      />
      <polygon
        points={eastWall}
        fill={wallOpen ? 'none' : shade(wallColorBase, -0.18)}
        stroke="#0f172a"
        strokeWidth="0.6"
        strokeDasharray={wallOpen ? '2 1.5' : 'none'}
        opacity={wallGlass ? 0.6 : wallOpen ? 0.5 : 0.95}
      />
      {storyLines.map((d, i) => (
        <path key={`story-${i}`} d={d} stroke="#0f172a" strokeWidth="0.4" fill="none" opacity={0.5} />
      ))}
      {doorRects}
      <polygon
        points={roofTop}
        fill={roofOpen ? 'none' : shade(roofColorBase, 0.08)}
        stroke="#0f172a"
        strokeWidth="0.6"
        strokeDasharray={roofOpen ? '2 1.5' : 'none'}
        opacity={roofOpen ? 0.5 : 0.96}
      />
      {voidPoly}
      {terrace}
    </g>
  );
}

function renderModel(model: ModelHome) {
  return (
    <g transform="translate(10 15)">
      {model.containers.map((container, index) => {
        const [x, y, z] = container.relativePosition;
        const sx = 20 + x * 1.55 - z * 5.5;
        const sy = 20 + z * 2.3 - y * 8;
        const glass = container.arrangementId?.includes('glass');
        const terrace = container.arrangementId?.includes('terrace');
        return (
          <g key={`${container.role}-${index}`} opacity={index > 0 ? 0.92 : 1}>
            <polygon
              points={`${sx},${sy - 8} ${sx + 28},${sy + 3} ${sx + 8},${sy + 13} ${sx - 20},${sy + 2}`}
              fill={glass ? '#bfe6ff' : terrace ? '#c9a16a' : '#d9e2ec'}
              stroke="#1e3a5f"
              strokeWidth="1.2"
            />
            <polygon
              points={`${sx - 20},${sy + 2} ${sx + 8},${sy + 13} ${sx + 8},${sy + 24} ${sx - 20},${sy + 13}`}
              fill={glass ? '#7dd3fc' : '#cbd5e1'}
              stroke="#1e3a5f"
              strokeWidth="1"
              opacity={glass ? 0.72 : 0.9}
            />
            <polygon
              points={`${sx + 8},${sy + 13} ${sx + 28},${sy + 3} ${sx + 28},${sy + 14} ${sx + 8},${sy + 24}`}
              fill={glass ? '#93c5fd' : '#94a3b8'}
              stroke="#1e3a5f"
              strokeWidth="1"
              opacity={glass ? 0.68 : 0.85}
            />
          </g>
        );
      })}
    </g>
  );
}

export function ArrangementThumbnailSVG({ arrangement, model, size = 76 }: ArrangementThumbnailSVGProps) {
  const title = model?.label ?? arrangement?.label ?? 'Design';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 76 76"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <rect x="0.5" y="0.5" width="75" height="75" rx="7" fill="#f8fafc" stroke="#dbe4ef" />
      {model ? renderModel(model) : arrangement ? renderArrangement(arrangement) : null}
    </svg>
  );
}
