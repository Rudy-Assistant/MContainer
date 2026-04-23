export function getRectangularGridRange(
  startIndex: number,
  endIndex: number,
  levelOffset: number,
  columns: number,
  rows: number,
): number[] {
  const startRaw = startIndex - levelOffset;
  const endRaw = endIndex - levelOffset;
  const cellCount = columns * rows;

  if (startRaw < 0 || endRaw < 0 || startRaw >= cellCount || endRaw >= cellCount) {
    return [];
  }

  const startRow = Math.floor(startRaw / columns);
  const startCol = startRaw % columns;
  const endRow = Math.floor(endRaw / columns);
  const endCol = endRaw % columns;
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  const indices: number[] = [];

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      indices.push(levelOffset + row * columns + col);
    }
  }

  return indices;
}

export function filterSelectableGridIndices(
  indices: number[],
  isSelectable: (index: number) => boolean,
): number[] {
  const seen = new Set<number>();
  return indices.filter((index) => {
    if (seen.has(index)) return false;
    seen.add(index);
    return isSelectable(index);
  });
}
