'use client';

import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';

interface CellDef {
  label: string;
  indices: number[];
  ext: boolean;
}

const GRID_ROWS: CellDef[][] = [
  [
    { label: 'NW Corner', indices: [0],  ext: true },
    { label: 'N Deck 1',  indices: [1],  ext: true },
    { label: 'N Deck 2',  indices: [2],  ext: false },
    { label: 'N Deck 3',  indices: [3],  ext: false },
    { label: 'NE Corner', indices: [7],  ext: true },
  ],
  [
    { label: 'W End',  indices: [9, 17],                   ext: false },
    { label: 'Bay 1',  indices: [10, 11, 18, 19],          ext: false },
    { label: 'Bay 2',  indices: [12, 13, 20, 21],          ext: false },
    { label: 'Bay 3',  indices: [14, 15, 22, 23],          ext: false },
    { label: 'E End',  indices: [16, 24],                  ext: false },
  ],
  [
    { label: 'SW Corner', indices: [24], ext: true },
    { label: 'S Deck 1',  indices: [25], ext: true },
    { label: 'S Deck 2',  indices: [26], ext: false },
    { label: 'S Deck 3',  indices: [27], ext: false },
    { label: 'SE Corner', indices: [31], ext: true },
  ],
];

interface Props {
  containerId: string;
  onCellClick: (indices: number[]) => void;
}

export function SpatialVoxelGrid({ containerId, onCellClick }: Props) {
  const selectedVoxels = useStore(
    useShallow((s: any) => s.selectedVoxels)
  );

  const selectedSet = new Set<number>(
    selectedVoxels?.containerId === containerId ? selectedVoxels.indices : []
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {GRID_ROWS.map((row, rowIdx) => (
        <div
          key={rowIdx}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}
        >
          {row.map((cell) => {
            const isSelected = cell.indices.some(i => selectedSet.has(i));
            return (
              <button
                key={cell.label}
                onClick={() => onCellClick(cell.indices)}
                style={{
                  padding: '6px 2px',
                  fontSize: cell.ext ? 9 : 10,
                  fontWeight: isSelected ? 600 : 400,
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 4,
                  background: isSelected
                    ? 'var(--accent)'
                    : cell.ext
                      ? 'var(--surface-dim, #2a2a2a)'
                      : 'var(--surface)',
                  color: isSelected
                    ? '#fff'
                    : cell.ext
                      ? 'var(--text-dim)'
                      : 'var(--text-muted)',
                  cursor: 'pointer',
                  lineHeight: 1.3,
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  opacity: cell.ext ? 0.7 : 1,
                  transition: 'background 100ms, border-color 100ms',
                }}
              >
                {cell.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
