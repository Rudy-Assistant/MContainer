'use client';

import type { ContainerArrangementSpec } from '@/config/containerArrangements';
import type { ModelHome } from '@/config/modelHomes';
import { surfaceColor } from './surfaceColorMap';

interface ArrangementThumbnailSVGProps {
  arrangement?: ContainerArrangementSpec;
  model?: ModelHome;
  size?: number;
}

function footprintCellPoints(row: number, col: number, cell = 8): string {
  const x = 18 + (col - row) * cell;
  const y = 10 + (col + row) * (cell / 2);
  return `${x},${y} ${x + cell},${y + cell / 2} ${x},${y + cell} ${x - cell},${y + cell / 2}`;
}

function arrangementFill(spec: ContainerArrangementSpec): string {
  if (spec.kind === 'retract') return '#f8fafc';
  return surfaceColor(spec.perimeterWall ?? 'Solid_Steel');
}

export function ArrangementThumbnailSVG({ arrangement, model, size = 76 }: ArrangementThumbnailSVGProps) {
  const isModel = !!model;
  const title = model?.label ?? arrangement?.label ?? 'Design';
  const fill = arrangement ? arrangementFill(arrangement) : '#bfdbfe';
  const roof = arrangement?.roof === 'Open' ? 'none' : surfaceColor(arrangement?.roof ?? 'Solid_Steel');
  const hasVoid = !!arrangement?.voidRows?.length && !!arrangement?.voidCols?.length;
  const hasTerrace = arrangement?.upperLevelMode === 'extensions_only';

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

      {isModel ? (
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
      ) : (
        <g transform="translate(3 12)">
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2, 3, 4, 5, 6, 7].map((col) => {
              const isVoid = arrangement?.voidRows?.includes(row) && arrangement?.voidCols?.includes(col);
              const isExtension = row === 0 || row === 3 || col === 0 || col === 7;
              const visible = arrangement?.level0Scope !== 'extensions_only' || isExtension;
              return (
                <polygon
                  key={`${row}-${col}`}
                  points={footprintCellPoints(row, col, 4.9)}
                  fill={visible ? (isVoid ? '#ffffff' : fill) : '#eef2f7'}
                  stroke={isVoid ? '#2563eb' : '#334155'}
                  strokeWidth={isVoid ? 1.1 : 0.38}
                  opacity={visible ? (isVoid ? 0.95 : 0.78) : 0.38}
                />
              );
            })
          )}
          <polygon
            points="36,4 70,21 36,38 2,21"
            fill={roof}
            stroke="#0f172a"
            strokeWidth="1"
            strokeDasharray={roof === 'none' ? '3 2' : 'none'}
            opacity={roof === 'none' ? 0.35 : 0.46}
          />
          {hasTerrace && (
            <path d="M5 21 L36 5 L67 21" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
          )}
          {hasVoid && (
            <path d="M33 21 L38 18 L43 21 L38 24 Z" fill="#fff" stroke="#2563eb" strokeWidth="1.2" />
          )}
        </g>
      )}
    </svg>
  );
}
