/**
 * GridSystem.ts — "Lego Grid" Snapping Engine
 *
 * All positions snap to 30cm increments.
 * Adjacency merge detection prevents double-balcony Z-fighting.
 */

import { CONTAINER_DIMENSIONS, type ContainerSize, type Container, WallSide, ModuleType } from "@/types/container";

// ── Grid Constants ──────────────────────────────────────────
export const GRID_STEP = 0.3; // 30cm — the universal snap increment
export const GRID_CELL = 1.2; // 4 grid steps — visual grid cell (≈ half container width)
export const GRID_SECTION = 2.4; // 8 grid steps — full container width

// ── Module-Aligned Snap Constants ───────────────────────────
/** Container width (Z-axis) — authoritative module pitch */
export const MODULE_WIDTH = 2.44;
/** Half container width — rowPitch for adjacency alignment */
export const MODULE_HALF = 1.22;

/**
 * Snap a value to the nearest 30cm grid increment.
 * `NewPosition = Math.round(RawPosition / 0.3) * 0.3`
 */
export function gridSnap(value: number): number {
  return Math.round(value / GRID_STEP) * GRID_STEP;
}

/**
 * Snap a 2D position (x, z) to the grid.
 */
export function gridSnap2D(x: number, z: number): { x: number; z: number } {
  return { x: gridSnap(x), z: gridSnap(z) };
}

/**
 * Snap a value to the nearest integer multiple of the given pitch.
 * Used for container-dimension-aligned placement (avoids 0.3m grid drift).
 * `NewPos = Math.round(val / pitch) * pitch`
 */
export function containerSnap(val: number, pitch: number): number {
  return Math.round(val / pitch) * pitch;
}

// ── Collision / Overlap Detection ───────────────────────────

interface DeckExtent {
  containerId: string;
  wall: WallSide;
  /** World-space AABB of the deployed deck */
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  y: number;
}

/**
 * Find all deployed deck extensions in the scene.
 */
export function getAllDeckExtents(containers: Record<string, Container>): DeckExtent[] {
  const extents: DeckExtent[] = [];

  for (const c of Object.values(containers)) {
    const dims = CONTAINER_DIMENSIONS[c.size];
    const halfL = dims.length / 2;
    const halfW = dims.width / 2;
    const h = dims.height;
    const cosR = Math.cos(c.rotation);
    const sinR = Math.sin(c.rotation);

    for (const side of [WallSide.Left, WallSide.Right, WallSide.Front, WallSide.Back] as const) {
      // Skip merged walls
      if (c.mergedWalls.some(mw => mw.endsWith(`:${side}`))) continue;

      const wall = c.walls[side];
      const hasDeployedDeck = wall.bays.some(
        b => b.module.type === ModuleType.HingedWall && b.module.foldsDown && b.module.openAmount > 0.5
      );
      if (!hasDeployedDeck) continue;

      // Local-space extent of deck
      let lx1: number, lz1: number, lx2: number, lz2: number;
      switch (side) {
        case WallSide.Left:
          lx1 = -halfL; lz1 = -halfW - h; lx2 = halfL; lz2 = -halfW; break;
        case WallSide.Right:
          lx1 = -halfL; lz1 = halfW; lx2 = halfL; lz2 = halfW + h; break;
        case WallSide.Front:
          lx1 = halfL; lz1 = -halfW; lx2 = halfL + h; lz2 = halfW; break;
        case WallSide.Back:
          lx1 = -halfL - h; lz1 = -halfW; lx2 = -halfL; lz2 = halfW; break;
      }

      // Transform to world space (AABB)
      const corners = [
        { lx: lx1, lz: lz1 }, { lx: lx2, lz: lz1 },
        { lx: lx2, lz: lz2 }, { lx: lx1, lz: lz2 },
      ];
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of corners) {
        const wx = c.position.x + p.lx * cosR - p.lz * sinR;
        const wz = c.position.z + p.lx * sinR + p.lz * cosR;
        minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
        minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
      }

      extents.push({
        containerId: c.id,
        wall: side,
        minX: gridSnap(minX), maxX: gridSnap(maxX),
        minZ: gridSnap(minZ), maxZ: gridSnap(maxZ),
        y: c.position.y,
      });
    }
  }

  return extents;
}

/**
 * Detect overlapping deck extents at the same Y level.
 * Returns pairs of overlapping decks (for shared-floor rendering).
 */
export function findOverlappingDecks(
  extents: DeckExtent[]
): Array<{ a: DeckExtent; b: DeckExtent; overlapMinX: number; overlapMaxX: number; overlapMinZ: number; overlapMaxZ: number }> {
  const overlaps: Array<{ a: DeckExtent; b: DeckExtent; overlapMinX: number; overlapMaxX: number; overlapMinZ: number; overlapMaxZ: number }> = [];

  for (let i = 0; i < extents.length; i++) {
    for (let j = i + 1; j < extents.length; j++) {
      const a = extents[i];
      const b = extents[j];

      // Must be at same Y level
      if (Math.abs(a.y - b.y) > 0.1) continue;

      // Must be different containers
      if (a.containerId === b.containerId) continue;

      // Check AABB overlap
      const overlapMinX = Math.max(a.minX, b.minX);
      const overlapMaxX = Math.min(a.maxX, b.maxX);
      const overlapMinZ = Math.max(a.minZ, b.minZ);
      const overlapMaxZ = Math.min(a.maxZ, b.maxZ);

      if (overlapMinX < overlapMaxX - 0.05 && overlapMinZ < overlapMaxZ - 0.05) {
        overlaps.push({ a, b, overlapMinX, overlapMaxX, overlapMinZ, overlapMaxZ });
      }
    }
  }

  return overlaps;
}
