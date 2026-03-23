/**
 * Spatial Engine — Physics & adjacency queries for the container graph.
 *
 * Pure functions that operate on container records.
 * No Zustand dependency — can be tested independently.
 */

import {
  type Container,
  type ContainerSize,
  type Voxel,
  type VoxelFaces,
  type SurfaceType,
  CONTAINER_DIMENSIONS,
  MAX_STACK_LEVEL,
  VOXEL_COLS,
  VOXEL_ROWS,
  VOXEL_LEVELS,
  WallSide,
  isRailingSurface,
} from "@/types/container";

// ── Types ───────────────────────────────────────────────────

export interface ContainerFootprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface StackTarget {
  containerId: string;
  level: number;
  y: number; // World Y for top of the target container
}

export interface AdjacencyPair {
  containerA: string;
  containerB: string;
  /** The wall side of container A that faces container B */
  sideA: WallSide;
  /** The wall side of container B that faces container A */
  sideB: WallSide;
}

// ── Rotation-Aware Wall Side Mapping ────────────────────────

/**
 * Determine which wall side of a container corresponds to a given AABB face,
 * accounting for the container's Y-axis rotation.
 *
 * For rotation=0:
 *   Front (+X local) → maxX, Back (-X local) → minX
 *   Right (+Z local) → maxZ, Left (-Z local) → minZ
 */
function wallSideAtFace(
  rotation: number,
  face: "maxX" | "minX" | "maxZ" | "minZ"
): WallSide {
  const r = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const quadrant = Math.round(r / (Math.PI / 2)) % 4;

  const maps: Record<number, Record<string, WallSide>> = {
    0: { maxX: WallSide.Front, minX: WallSide.Back, maxZ: WallSide.Right, minZ: WallSide.Left },
    1: { maxX: WallSide.Left, minX: WallSide.Right, maxZ: WallSide.Front, minZ: WallSide.Back },
    2: { maxX: WallSide.Back, minX: WallSide.Front, maxZ: WallSide.Left, minZ: WallSide.Right },
    3: { maxX: WallSide.Right, minX: WallSide.Left, maxZ: WallSide.Back, minZ: WallSide.Front },
  };

  return maps[quadrant][face];
}

// ── Extension Detection ─────────────────────────────────────

/**
 * Detect which extension directions have active (non-Open) voxels.
 * An extension direction is active if ANY voxel in that row/column
 * has at least one non-Open face.
 *
 * Returns { north, south, east, west } booleans.
 * At rotation=0: col 0 = +X (east), col 7 = -X (west), row 0 = -Z (north), row 3 = +Z (south)
 */
export function getActiveExtensions(c: Container): {
  north: boolean; south: boolean; east: boolean; west: boolean;
} {
  const result = { north: false, south: false, east: false, west: false };
  if (!c.voxelGrid) return result;

  const hasNonOpenFace = (v: { active: boolean; faces: VoxelFaces }): boolean => {
    if (!v.active) return false;
    const f = v.faces;
    return f.top !== 'Open' || f.bottom !== 'Open' ||
           f.n !== 'Open' || f.s !== 'Open' ||
           f.e !== 'Open' || f.w !== 'Open';
  };

  for (let level = 0; level < VOXEL_LEVELS; level++) {
    const off = level * VOXEL_ROWS * VOXEL_COLS;
    // Row 0 = north extension (-Z at rotation=0)
    for (let col = 0; col < VOXEL_COLS; col++) {
      if (hasNonOpenFace(c.voxelGrid[off + 0 * VOXEL_COLS + col])) { result.north = true; break; }
    }
    // Row 3 = south extension (+Z at rotation=0)
    for (let col = 0; col < VOXEL_COLS; col++) {
      if (hasNonOpenFace(c.voxelGrid[off + 3 * VOXEL_COLS + col])) { result.south = true; break; }
    }
    // Col 0 = east extension (+X at rotation=0)
    for (let row = 0; row < VOXEL_ROWS; row++) {
      if (hasNonOpenFace(c.voxelGrid[off + row * VOXEL_COLS + 0])) { result.east = true; break; }
    }
    // Col 7 = west extension (-X at rotation=0)
    for (let row = 0; row < VOXEL_ROWS; row++) {
      if (hasNonOpenFace(c.voxelGrid[off + row * VOXEL_COLS + 7])) { result.west = true; break; }
    }
  }
  return result;
}

// ── Footprint Calculation ───────────────────────────────────

/** Calculate the body-only AABB footprint of a container (no extensions). */
export function getFootprint(c: Container): ContainerFootprint {
  const dims = CONTAINER_DIMENSIONS[c.size];
  const halfL = dims.length / 2;
  const halfW = dims.width / 2;
  const cosA = Math.abs(Math.cos(c.rotation));
  const sinA = Math.abs(Math.sin(c.rotation));
  const extX = halfL * cosA + halfW * sinA;
  const extZ = halfL * sinA + halfW * cosA;
  return {
    minX: c.position.x - extX,
    maxX: c.position.x + extX,
    minZ: c.position.z - extZ,
    maxZ: c.position.z + extZ,
  };
}

/** Calculate footprint for a hypothetical container at a given position/size. */
export function getFootprintAt(
  x: number,
  z: number,
  size: ContainerSize,
  rotation: number = 0
): ContainerFootprint {
  const dims = CONTAINER_DIMENSIONS[size];
  const halfL = dims.length / 2;
  const halfW = dims.width / 2;
  const cosA = Math.abs(Math.cos(rotation));
  const sinA = Math.abs(Math.sin(rotation));
  const extX = halfL * cosA + halfW * sinA;
  const extZ = halfL * sinA + halfW * cosA;
  return {
    minX: x - extX,
    maxX: x + extX,
    minZ: z - extZ,
    maxZ: z + extZ,
  };
}

/**
 * Calculate the full footprint of a container INCLUDING active extensions.
 * Extensions expand the AABB by `dims.height` in each active direction.
 *
 * At rotation=0:
 *   east (col 0) → +X by haloExt,  west (col 7) → -X by haloExt
 *   north (row 0) → -Z by haloExt, south (row 3) → +Z by haloExt
 *
 * For rotated containers, the extension directions rotate with the container.
 */
export function getFullFootprint(c: Container): ContainerFootprint {
  const body = getFootprint(c);
  if (!c.voxelGrid) return body;

  const ext = getActiveExtensions(c);
  const dims = CONTAINER_DIMENSIONS[c.size];
  const haloExt = dims.height; // Extension outward extent = container height

  // Compute local extension offsets, then rotate into world space
  // Local: east=+X, west=-X, north=-Z, south=+Z
  let dMinX = 0, dMaxX = 0, dMinZ = 0, dMaxZ = 0;

  const cosA = Math.cos(c.rotation);
  const sinA = Math.sin(c.rotation);

  // Each active extension direction contributes a local offset that needs rotation
  // Local +X (east) → world: +X*cos, +Z*sin
  if (ext.east) {
    const wx = haloExt * Math.abs(cosA);
    const wz = haloExt * Math.abs(sinA);
    dMaxX = Math.max(dMaxX, wx);
    dMaxZ = Math.max(dMaxZ, wz);
  }
  // Local -X (west) → world: same magnitude, opposite sign
  if (ext.west) {
    const wx = haloExt * Math.abs(cosA);
    const wz = haloExt * Math.abs(sinA);
    dMinX = Math.max(dMinX, wx);
    dMinZ = Math.max(dMinZ, wz);
  }
  // Local -Z (north)
  if (ext.north) {
    const wx = haloExt * Math.abs(sinA);
    const wz = haloExt * Math.abs(cosA);
    dMinZ = Math.max(dMinZ, wz);
    dMinX = Math.max(dMinX, wx);
  }
  // Local +Z (south)
  if (ext.south) {
    const wx = haloExt * Math.abs(sinA);
    const wz = haloExt * Math.abs(cosA);
    dMaxZ = Math.max(dMaxZ, wz);
    dMaxX = Math.max(dMaxX, wx);
  }

  return {
    minX: body.minX - dMinX,
    maxX: body.maxX + dMaxX,
    minZ: body.minZ - dMinZ,
    maxZ: body.maxZ + dMaxZ,
  };
}

// ── Overlap Calculation ─────────────────────────────────────

/** Calculate the overlap fraction between two footprints (0 to 1, relative to `a`). */
export function overlapFraction(a: ContainerFootprint, b: ContainerFootprint): number {
  const overlapX = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const overlapZ = Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
  const overlapArea = overlapX * overlapZ;
  const aArea = (a.maxX - a.minX) * (a.maxZ - a.minZ);
  if (aArea <= 0) return 0;
  return overlapArea / aArea;
}

/** Check if a footprint overlaps with any existing container (excludes one container by ID).
 *  Uses full footprint (including extensions) for existing containers. */
export function checkOverlap(
  containers: Record<string, Container>,
  excludeId: string | null,
  foot: ContainerFootprint,
  tolerance: number = 0.05
): boolean {
  for (const c of Object.values(containers)) {
    if (c.id === excludeId) continue;
    const existing = getFullFootprint(c);
    // Shrink both footprints by tolerance to allow edge-touching (adjacency)
    const shrunkNew = {
      minX: foot.minX + tolerance,
      maxX: foot.maxX - tolerance,
      minZ: foot.minZ + tolerance,
      maxZ: foot.maxZ - tolerance,
    };
    const shrunkExisting = {
      minX: existing.minX + tolerance,
      maxX: existing.maxX - tolerance,
      minZ: existing.minZ + tolerance,
      maxZ: existing.maxZ - tolerance,
    };
    // Check if shrunken footprints overlap
    if (
      shrunkNew.minX < shrunkExisting.maxX &&
      shrunkNew.maxX > shrunkExisting.minX &&
      shrunkNew.minZ < shrunkExisting.maxZ &&
      shrunkNew.maxZ > shrunkExisting.minZ
    ) {
      return true;
    }
  }
  return false;
}

// ── Adjacency Snap ──────────────────────────────────────────

export interface SnapResult {
  x: number;
  z: number;
  snapped: boolean;
  adjacentTo: string | null;
}

/**
 * Given a rough position, snap to an adjacent container's edge if close enough.
 * Prioritizes adjacency snap over grid snap.
 */
export function findEdgeSnap(
  containers: Record<string, Container>,
  excludeId: string | null,
  x: number,
  z: number,
  size: ContainerSize,
  rotation: number = 0,
  snapDistance: number = 1.5
): SnapResult {
  const dims = CONTAINER_DIMENSIONS[size];
  const cosA = Math.abs(Math.cos(rotation));
  const sinA = Math.abs(Math.sin(rotation));
  const halfExtX = (dims.length / 2) * cosA + (dims.width / 2) * sinA;
  const halfExtZ = (dims.length / 2) * sinA + (dims.width / 2) * cosA;

  let bestX = x;
  let bestZ = z;
  let bestDist = Infinity;
  let adjacentTo: string | null = null;

  for (const c of Object.values(containers)) {
    if (c.id === excludeId) continue;
    // Skip containers not on ground level for edge snap (stacking handles elevated containers)
    // Only snap edges with containers at roughly the same Y level as the drag plane (Y=0)
    if (c.position.y > 0.5) continue;

    const cFoot = getFootprint(c);
    const cHalfExtX = (cFoot.maxX - cFoot.minX) / 2;
    const cHalfExtZ = (cFoot.maxZ - cFoot.minZ) / 2;

    // Check all 4 edge alignment scenarios:
    // New container's right edge → existing container's left edge
    const snapXRight = cFoot.minX - halfExtX;
    const distXRight = Math.abs(x - snapXRight);
    // Check Z overlap if we snap X
    const zOverlapR = Math.min(z + halfExtZ, cFoot.maxZ) - Math.max(z - halfExtZ, cFoot.minZ);
    if (distXRight < snapDistance && distXRight < bestDist && zOverlapR > 0.3) {
      bestX = snapXRight;
      bestZ = z;
      bestDist = distXRight;
      adjacentTo = c.id;
    }

    // New container's left edge → existing container's right edge
    const snapXLeft = cFoot.maxX + halfExtX;
    const distXLeft = Math.abs(x - snapXLeft);
    const zOverlapL = Math.min(z + halfExtZ, cFoot.maxZ) - Math.max(z - halfExtZ, cFoot.minZ);
    if (distXLeft < snapDistance && distXLeft < bestDist && zOverlapL > 0.3) {
      bestX = snapXLeft;
      bestZ = z;
      bestDist = distXLeft;
      adjacentTo = c.id;
    }

    // New container's front edge → existing container's back edge
    const snapZFront = cFoot.minZ - halfExtZ;
    const distZFront = Math.abs(z - snapZFront);
    const xOverlapF = Math.min(x + halfExtX, cFoot.maxX) - Math.max(x - halfExtX, cFoot.minX);
    if (distZFront < snapDistance && distZFront < bestDist && xOverlapF > 0.3) {
      bestX = x;
      bestZ = snapZFront;
      bestDist = distZFront;
      adjacentTo = c.id;
    }

    // New container's back edge → existing container's front edge
    const snapZBack = cFoot.maxZ + halfExtZ;
    const distZBack = Math.abs(z - snapZBack);
    const xOverlapB = Math.min(x + halfExtX, cFoot.maxX) - Math.max(x - halfExtX, cFoot.minX);
    if (distZBack < snapDistance && distZBack < bestDist && xOverlapB > 0.3) {
      bestX = x;
      bestZ = snapZBack;
      bestDist = distZBack;
      adjacentTo = c.id;
    }

    // Also snap Z alignment when X-snapped (align containers along their shared axis)
    if (adjacentTo === c.id) {
      const zAlign = c.position.z;
      if (Math.abs(bestZ - zAlign) < 2.0) {
        bestZ = zAlign;
      }
      const xAlign = c.position.x;
      if (Math.abs(bestX - xAlign) < 2.0) {
        bestX = xAlign;
      }
    }

    // Center alignment snap — strongly prefer same-center positions (for stacking / flush placement)
    if (adjacentTo !== c.id) {
      const centerDist = Math.sqrt(Math.pow(x - c.position.x, 2) + Math.pow(z - c.position.z, 2));
      if (centerDist < snapDistance && centerDist < bestDist) {
        bestX = c.position.x;
        bestZ = c.position.z;
        bestDist = centerDist;
        adjacentTo = c.id;
      }
    }
  }

  return { x: bestX, z: bestZ, snapped: bestDist < snapDistance, adjacentTo };
}

// ── Stack Target Detection ──────────────────────────────────

export function findStackTarget(
  containers: Record<string, Container>,
  x: number,
  z: number,
  size: ContainerSize,
  excludeId: string | null = null
): StackTarget | null {
  const newFoot = getFootprintAt(x, z, size);
  let bestTarget: StackTarget | null = null;

  for (const c of Object.values(containers)) {
    if (c.id === excludeId) continue;
    if (c.level >= MAX_STACK_LEVEL) continue;

    const existingFoot = getFootprint(c);
    const overlap = overlapFraction(newFoot, existingFoot);

    if (overlap < 0.6) continue;

    const dims = CONTAINER_DIMENSIONS[c.size];
    const topY = c.position.y + dims.height;
    const candidateLevel = c.level + 1;

    if (!bestTarget || candidateLevel > bestTarget.level) {
      bestTarget = {
        containerId: c.id,
        level: candidateLevel,
        y: topY,
      };
    }
  }

  return bestTarget;
}

// ── Adjacency Detection ─────────────────────────────────────

const ADJACENCY_TOLERANCE = 0.15; // metres — how close walls must be to auto-merge

/**
 * Detect all pairs of adjacent containers that share a wall face.
 *
 * Two containers are adjacent if:
 * 1. They are on the same level (same Y position)
 * 2. One face of container A is within ADJACENCY_TOLERANCE of the opposite face of container B
 * 3. They overlap along the perpendicular axis
 */
export function findAdjacentPairs(
  containers: Record<string, Container>
): AdjacencyPair[] {
  const pairs: AdjacencyPair[] = [];
  const ids = Object.keys(containers);

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = containers[ids[i]];
      const b = containers[ids[j]];
      if (!a?.position || !b?.position) continue;

      // Must be on the same level
      if (Math.abs(a.position.y - b.position.y) > 0.1) continue;

      const footA = getFootprint(a);
      const footB = getFootprint(b);

      // A's maxX face vs B's minX face
      if (Math.abs(footA.maxX - footB.minX) < ADJACENCY_TOLERANCE) {
        const zOverlap = Math.min(footA.maxZ, footB.maxZ) - Math.max(footA.minZ, footB.minZ);
        if (zOverlap > 0.5) {
          pairs.push({
            containerA: a.id,
            containerB: b.id,
            sideA: wallSideAtFace(a.rotation, "maxX"),
            sideB: wallSideAtFace(b.rotation, "minX"),
          });
        }
      }

      // A's minX face vs B's maxX face
      if (Math.abs(footA.minX - footB.maxX) < ADJACENCY_TOLERANCE) {
        const zOverlap = Math.min(footA.maxZ, footB.maxZ) - Math.max(footA.minZ, footB.minZ);
        if (zOverlap > 0.5) {
          pairs.push({
            containerA: a.id,
            containerB: b.id,
            sideA: wallSideAtFace(a.rotation, "minX"),
            sideB: wallSideAtFace(b.rotation, "maxX"),
          });
        }
      }

      // A's maxZ face vs B's minZ face
      if (Math.abs(footA.maxZ - footB.minZ) < ADJACENCY_TOLERANCE) {
        const xOverlap = Math.min(footA.maxX, footB.maxX) - Math.max(footA.minX, footB.minX);
        if (xOverlap > 0.5) {
          pairs.push({
            containerA: a.id,
            containerB: b.id,
            sideA: wallSideAtFace(a.rotation, "maxZ"),
            sideB: wallSideAtFace(b.rotation, "minZ"),
          });
        }
      }

      // A's minZ face vs B's maxZ face
      if (Math.abs(footA.minZ - footB.maxZ) < ADJACENCY_TOLERANCE) {
        const xOverlap = Math.min(footA.maxX, footB.maxX) - Math.max(footA.minX, footB.minX);
        if (xOverlap > 0.5) {
          pairs.push({
            containerA: a.id,
            containerB: b.id,
            sideA: wallSideAtFace(a.rotation, "minZ"),
            sideB: wallSideAtFace(b.rotation, "maxZ"),
          });
        }
      }
    }
  }

  return pairs;
}

// ── Phase 4: Global Voxel-Level Adjacency Culling ────────────

/**
 * Map a WallSide to the boundary voxel column/row and outward face direction.
 *
 * For col-based boundaries (Front/Back):
 *   - Front (+X) → col 1 (first core col on +X), outward face = 'e'
 *   - Back  (-X) → col 6 (last core col on -X), outward face = 'w'
 *
 * For row-based boundaries (Left/Right):
 *   - Left  (-Z) → row 1 (first core row on -Z), outward face = 'n'
 *   - Right (+Z) → row 2 (last core row on +Z), outward face = 's'
 */
export function wallSideToBoundary(side: WallSide): {
  isRowBoundary: boolean;
  index: number;
  face: keyof VoxelFaces;
} {
  switch (side) {
    case WallSide.Front: return { isRowBoundary: false, index: 1, face: 'e' };
    case WallSide.Back:  return { isRowBoundary: false, index: 6, face: 'w' };
    case WallSide.Left:  return { isRowBoundary: true,  index: 1, face: 'n' };
    case WallSide.Right: return { isRowBoundary: true,  index: 2, face: 's' };
  }
}

/**
 * Compute the set of voxel faces that should be visually suppressed (rendered as Open)
 * due to cross-container adjacency. This is NON-DESTRUCTIVE — store data is untouched.
 *
 * Returns a Set of strings in the format: "containerId:voxelIndex:faceDir"
 * ContainerSkin checks this set before rendering each face.
 */
export function computeGlobalCulling(
  containers: Record<string, Container>,
  pairs: AdjacencyPair[]
): Set<string> {
  const cullSet = new Set<string>();

  const SOLID_SURFACES: SurfaceType[] = ['Solid_Steel', 'Concrete', 'Glass_Pane'];

  function shouldMelt(aSurface: SurfaceType | undefined, bSurface: SurfaceType | undefined): boolean {
    if (aSurface === undefined || bSurface === undefined) return false;
    // Same surface → melt
    if (aSurface === bSurface) return true;
    // Both railing variants → melt (Smart: unified deck perimeter)
    if (isRailingSurface(aSurface) && isRailingSurface(bSurface)) return true;
    // Solid surfaces against other solids → melt (internal walls inside assemblies)
    if (SOLID_SURFACES.includes(aSurface) && SOLID_SURFACES.includes(bSurface)) return true;
    return false;
  }

  /** Smart override: skip culling if EITHER side was explicitly user-painted */
  function isUserPainted(voxel: Voxel | undefined, face: keyof VoxelFaces): boolean {
    return !!(voxel?.userPaintedFaces?.[face]);
  }

  /** Try to cull a single voxel pair across the boundary */
  function tryCullPair(
    a: Container, aIdx: number, aBound: ReturnType<typeof wallSideToBoundary>,
    b: Container, bIdx: number, bBound: ReturnType<typeof wallSideToBoundary>,
    aOverlaps: boolean, bOverlaps: boolean,
  ) {
    const aVox = a.voxelGrid?.[aIdx];
    const bVox = b.voxelGrid?.[bIdx];

    // Only cull faces where BOTH the voxel is active AND it geometrically overlaps
    // the other container's grid extent. For same-size containers both always overlap.
    const aActive = !!(aOverlaps && aVox?.active);
    const bActive = !!(bOverlaps && bVox?.active);
    if (!aActive && !bActive) return;

    const aSurface = aActive ? aVox!.faces[aBound.face] : undefined;
    const bSurface = bActive ? bVox!.faces[bBound.face] : undefined;

    if (shouldMelt(aSurface, bSurface)) {
      if (aActive && !isUserPainted(aVox!, aBound.face)) cullSet.add(`${a.id}:${aIdx}:${aBound.face}`);
      if (bActive && !isUserPainted(bVox!, bBound.face)) cullSet.add(`${b.id}:${bIdx}:${bBound.face}`);
    }
  }

  for (const pair of pairs) {
    const a = containers[pair.containerA];
    const b = containers[pair.containerB];
    if (!a?.voxelGrid || !b?.voxelGrid) continue;

    const aBound = wallSideToBoundary(pair.sideA);
    const bBound = wallSideToBoundary(pair.sideB);

    // Compute pitch and grid extents for geometric overlap checks.
    // Same math as refreshAdjacency: colPitch = body length / 6 body cols,
    // rowPitch = body width / 2 body rows. Grid half-extent = (total cols or rows / 2) * pitch.
    const aDims = CONTAINER_DIMENSIONS[a.size as ContainerSize];
    const bDims = CONTAINER_DIMENSIONS[b.size as ContainerSize];
    const aColPitch = aDims.length / 6;
    const aRowPitch = aDims.width / 2;
    const bColPitch = bDims.length / 6;
    const bRowPitch = bDims.width / 2;

    // Iterate over both voxel levels (floor + roof)
    for (let level = 0; level < VOXEL_LEVELS; level++) {
      const lvlOff = level * VOXEL_ROWS * VOXEL_COLS;

      if (!aBound.isRowBoundary) {
        // Col-based boundary (Front/Back) — perpendicular axis is Z (rows)
        const bHalfZ = (VOXEL_ROWS / 2) * bRowPitch;
        const aHalfZ = (VOXEL_ROWS / 2) * aRowPitch;

        for (let row = 0; row < VOXEL_ROWS; row++) {
          const aWorldZ = a.position.z + (row - 1.5) * aRowPitch;
          const bWorldZ = b.position.z + (row - 1.5) * bRowPitch;
          const aOvl = aWorldZ >= b.position.z - bHalfZ - aRowPitch / 2
                    && aWorldZ <= b.position.z + bHalfZ + aRowPitch / 2;
          const bOvl = bWorldZ >= a.position.z - aHalfZ - bRowPitch / 2
                    && bWorldZ <= a.position.z + aHalfZ + bRowPitch / 2;

          if (!aOvl && !bOvl) continue;

          tryCullPair(
            a, lvlOff + row * VOXEL_COLS + aBound.index, aBound,
            b, lvlOff + row * VOXEL_COLS + bBound.index, bBound,
            aOvl, bOvl,
          );
        }
      } else {
        // Row-based boundary (Left/Right) — perpendicular axis is X (cols)
        const bHalfX = (VOXEL_COLS / 2) * bColPitch;
        const aHalfX = (VOXEL_COLS / 2) * aColPitch;

        for (let col = 0; col < VOXEL_COLS; col++) {
          const aWorldX = a.position.x + -(col - 3.5) * aColPitch;
          const bWorldX = b.position.x + -(col - 3.5) * bColPitch;
          const aOvl = aWorldX >= b.position.x - bHalfX - aColPitch / 2
                    && aWorldX <= b.position.x + bHalfX + aColPitch / 2;
          const bOvl = bWorldX >= a.position.x - aHalfX - bColPitch / 2
                    && bWorldX <= a.position.x + aHalfX + bColPitch / 2;

          if (!aOvl && !bOvl) continue;

          tryCullPair(
            a, lvlOff + aBound.index * VOXEL_COLS + col, aBound,
            b, lvlOff + bBound.index * VOXEL_COLS + col, bBound,
            aOvl, bOvl,
          );
        }
      }
    }
  }

  return cullSet;
}

// ── Pool Fluid Plane ─────────────────────────────────────────

/** Returns the union bounding box of all pool containers for a single merged WaterPlane. */
export function computePoolUnion(
  containers: Record<string, Container>
): { minX: number; maxX: number; minZ: number; maxZ: number; waterY: number } | null {
  const pools = Object.values(containers).filter(isPoolContainer);
  if (pools.length === 0) return null;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let waterY = 0;
  for (const c of pools) {
    const pos = c.position ?? { x: 0, y: 0, z: 0 };
    const dims = CONTAINER_DIMENSIONS[c.size];
    minX = Math.min(minX, pos.x - dims.length / 2);
    maxX = Math.max(maxX, pos.x + dims.length / 2);
    minZ = Math.min(minZ, pos.z - dims.width / 2);
    maxZ = Math.max(maxZ, pos.z + dims.width / 2);
    // Pool voxels are at ground level (level 0 of VOXEL_LEVELS=2).
    // Their top face is at pos.y + dims.height/2.
    // Water fills to 90% of the single voxel height.
    const voxelH = dims.height / 2;
    waterY = Math.max(waterY, pos.y + voxelH * 0.90);
  }
  return { minX, maxX, minZ, maxZ, waterY };
}

function isPoolContainer(c: Container): boolean {
  if (!c.voxelGrid) return false;
  return c.voxelGrid.some(
    (v) => v.active && v.faces.top === 'Open' && v.faces.bottom === 'Concrete'
  );
}
