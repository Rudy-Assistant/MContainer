/**
 * Surface cycle arrays — shared between ContainerSkin (scroll-to-paint)
 * and useStore (cycleVoxelFace action).
 *
 * Extracted here to avoid circular imports (ContainerSkin ↔ useStore).
 */
import type { SurfaceType } from "@/types/container";

// Face-type-aware surface cycles — each face only cycles architecturally valid surfaces.
export const WALL_CYCLE: SurfaceType[]  = ['Solid_Steel', 'Window_Half', 'Window_Standard', 'Window_Sill', 'Window_Clerestory', 'Glass_Pane', 'Door', 'Wall_Washi', 'Glass_Shoji', 'Railing_Glass', 'Open', 'Stairs', 'Stairs_Down'];
export const FLOOR_CYCLE: SurfaceType[] = ['Deck_Wood', 'Floor_Tatami', 'Wood_Hinoki', 'Concrete', 'Open'];
export const CEIL_CYCLE: SurfaceType[]  = ['Solid_Steel', 'Deck_Wood', 'Wood_Hinoki', 'Concrete', 'Open'];

/** Get the appropriate cycle array for a given face direction. */
export function getCycleForFace(face: keyof import("@/types/container").VoxelFaces): SurfaceType[] {
  return face === 'bottom' ? FLOOR_CYCLE : face === 'top' ? CEIL_CYCLE : WALL_CYCLE;
}
