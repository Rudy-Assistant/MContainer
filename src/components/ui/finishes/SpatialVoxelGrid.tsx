'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import type { ElementType } from '@/store/slices/selectionSlice';

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

// Flattened ordered list of all cell labels (row-major) for range selection
function getAllCellIds(): string[] {
  return GRID_ROWS.flatMap(row => row.map(cell => cell.label));
}

interface Props {
  containerId: string;
  onCellClick: (indices: number[]) => void;
}

export function SpatialVoxelGrid({ containerId, onCellClick }: Props) {
  const [shiftHoverId, setShiftHoverId] = useState<string | null>(null);

  const { selectedVoxels, selectedElements, frameMode } = useStore(
    useShallow((s: any) => ({
      selectedVoxels: s.selectedVoxels,
      selectedElements: s.selectedElements,
      frameMode: s.frameMode as boolean,
    }))
  );

  // Build selected cell label set from selectedElements (bay/frame type)
  const selectedIds = new Set<string>();
  if (selectedElements && (selectedElements.type === 'bay' || selectedElements.type === 'frame')) {
    for (const item of selectedElements.items) {
      if (item.containerId === containerId) {
        selectedIds.add(item.id);
      }
    }
  }

  // Fallback: legacy selectedVoxels for backward compat
  const legacySelectedSet = new Set<number>(
    selectedVoxels?.containerId === containerId ? selectedVoxels.indices : []
  );

  // Compute shift-hover range preview
  const shiftRangeIds = new Set<string>();
  if (shiftHoverId && selectedElements && selectedElements.items.length > 0) {
    const allCellIds = getAllCellIds();
    const lastId = selectedElements.items[selectedElements.items.length - 1].id;
    const startIdx = allCellIds.indexOf(lastId);
    const endIdx = allCellIds.indexOf(shiftHoverId);
    if (startIdx >= 0 && endIdx >= 0) {
      const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      for (let i = from; i <= to; i++) shiftRangeIds.add(allCellIds[i]);
    }
  }

  const handleCellClick = (e: React.MouseEvent, cellId: string, cellIndices: number[]) => {
    const store = useStore.getState();
    const { selectedElements, setSelectedElements, toggleElement, frameMode } = store;

    const cellType: ElementType = frameMode ? 'frame' : 'bay';

    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: toggle element in current type
      if (!selectedElements || selectedElements.type === cellType) {
        toggleElement(containerId, cellId);
      } else {
        // Different type: clear and start new
        setSelectedElements({ type: cellType, items: [{ containerId, id: cellId }] });
      }
    } else if (e.shiftKey && selectedElements && selectedElements.items.length > 0) {
      // Shift+Click: range select
      const allCellIds = getAllCellIds();
      const lastId = selectedElements.items[selectedElements.items.length - 1].id;
      const startIdx = allCellIds.indexOf(lastId);
      const endIdx = allCellIds.indexOf(cellId);
      if (startIdx >= 0 && endIdx >= 0) {
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeItems = allCellIds.slice(from, to + 1).map(id => ({ containerId, id }));
        setSelectedElements({ type: cellType, items: rangeItems });
      } else {
        setSelectedElements({ type: cellType, items: [{ containerId, id: cellId }] });
      }
    } else {
      // Plain click: single select
      setSelectedElements({ type: cellType, items: [{ containerId, id: cellId }] });
    }

    // Also call onCellClick for backward compat (ContainerTab uses it for voxel selection)
    onCellClick(cellIndices);
  };

  const handleMouseEnter = (e: React.MouseEvent, cellId: string) => {
    if (e.shiftKey) {
      setShiftHoverId(cellId);
    }
  };

  const handleMouseLeave = () => {
    setShiftHoverId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {GRID_ROWS.map((row, rowIdx) => (
        <div
          key={rowIdx}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}
        >
          {row.map((cell) => {
            const cellId = cell.label;
            const isSelectedByElements = selectedIds.has(cellId);
            const isSelectedByLegacy = cell.indices.some(i => legacySelectedSet.has(i));
            const isSelected = isSelectedByElements || isSelectedByLegacy;
            const isMultiSelected = isSelected && (selectedElements?.items?.length ?? 0) > 1;
            const isShiftPreview = shiftRangeIds.has(cellId) && !isSelected;

            let border: string;
            let background: string;
            let color: string;

            if (isShiftPreview) {
              border = '1px dashed var(--accent)';
              background = cell.ext ? 'var(--surface-dim, #2a2a2a)' : 'var(--surface)';
              color = cell.ext ? 'var(--text-dim)' : 'var(--text-muted)';
            } else if (isMultiSelected) {
              border = '2px solid var(--accent-muted, #93c5fd)';
              background = 'rgba(37, 99, 235, 0.08)';
              color = 'var(--accent, #2563eb)';
            } else if (isSelected) {
              border = '2px solid var(--accent)';
              background = 'rgba(37, 99, 235, 0.15)';
              color = 'var(--accent, #2563eb)';
            } else {
              border = '1px solid var(--border)';
              background = cell.ext ? 'var(--surface-dim, #2a2a2a)' : 'var(--surface)';
              color = cell.ext ? 'var(--text-dim)' : 'var(--text-muted)';
            }

            return (
              <button
                key={cell.label}
                onClick={(e) => handleCellClick(e, cellId, cell.indices)}
                onMouseEnter={(e) => handleMouseEnter(e, cellId)}
                onMouseLeave={handleMouseLeave}
                style={{
                  padding: '6px 2px',
                  fontSize: cell.ext ? 9 : 10,
                  fontWeight: isSelected ? 600 : 400,
                  border,
                  borderRadius: 4,
                  background,
                  color,
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
