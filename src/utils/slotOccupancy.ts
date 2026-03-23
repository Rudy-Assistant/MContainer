import type { SceneObject, FormDefinition, WallDirection } from '@/types/sceneObject';

export function getOccupiedSlots(
  objects: SceneObject[],
  containerId: string,
  voxelIndex: number,
  face: WallDirection,
  formMap?: Map<string, FormDefinition>,
): Set<number> {
  const occupied = new Set<number>();
  for (const obj of objects) {
    const a = obj.anchor;
    if (a.containerId !== containerId || a.voxelIndex !== voxelIndex || a.face !== face || a.type !== 'face') continue;
    const slotWidth = formMap?.get(obj.formId)?.slotWidth ?? 1;
    const startSlot = a.slot ?? 0;
    for (let i = 0; i < slotWidth; i++) {
      occupied.add(startSlot + i);
    }
  }
  return occupied;
}

export function canPlaceInSlot(occupied: Set<number>, startSlot: number, slotWidth: number): boolean {
  if (startSlot + slotWidth > 3) return false;
  for (let i = 0; i < slotWidth; i++) {
    if (occupied.has(startSlot + i)) return false;
  }
  return true;
}

export function getSlotsForPlacement(occupied: Set<number>, slotWidth: number): number[] {
  const valid: number[] = [];
  for (let s = 0; s <= 3 - slotWidth; s++) {
    if (canPlaceInSlot(occupied, s, slotWidth)) valid.push(s);
  }
  return valid;
}

export function canPlaceFloorObject(
  dims: { w: number; h: number; d: number },
  offset: [number, number],
  existing: { dims: { w: number; h: number; d: number }; offset: [number, number] }[],
): boolean {
  for (const e of existing) {
    const overlapX = Math.abs(offset[0] - e.offset[0]) < (dims.w + e.dims.w) / 2;
    const overlapZ = Math.abs(offset[1] - e.offset[1]) < (dims.d + e.dims.d) / 2;
    if (overlapX && overlapZ) return false;
  }
  return true;
}
