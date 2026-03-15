"use client";

import { useRef, useEffect, useMemo, useCallback } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import { useStore } from "@/store/useStore";
import { CONTAINER_DIMENSIONS, ViewMode, WallSide, ModuleType, FurnitureType, FURNITURE_CATALOG, type FloorMaterialType, VOXEL_COLS, VOXEL_ROWS } from "@/types/container";
import { getCycleForFace, getVoxelLayout } from "@/components/objects/ContainerSkin";

// ── Constants ────────────────────────────────────────────────

const EYE_HEIGHT = 1.6; // metres — average eye level
const WALK_SPEED = 4.0; // m/s
const SPRINT_SPEED = 8.0; // m/s
const COLLISION_RADIUS = 0.3; // metres — body radius for wall collision
const TARGET_RANGE = 15; // max range for crosshair targeting (metres)

// ── Key State ────────────────────────────────────────────────

const keys: Record<string, boolean> = {};

/** Safe pointer lock release — guards against zombie element errors */
function safeExitPointerLock() {
  try {
    if (document.pointerLockElement && document.body.contains(document.pointerLockElement)) {
      document.exitPointerLock();
    }
  } catch {
    // Ignore errors from unmounted/detached elements
  }
}

/** Re-acquire pointer lock on the canvas element */
function safeRequestPointerLock() {
  try {
    const canvas = document.querySelector('canvas');
    if (canvas && !document.pointerLockElement) {
      canvas.requestPointerLock();
    }
  } catch {
    // Ignore errors
  }
}

/** Track whether a menu is open — prevents re-locking during menu interaction */
let _menuOpenFlag = false;
function setMenuOpen(open: boolean) { _menuOpenFlag = open; }
function isMenuOpen() { return _menuOpenFlag; }

// ── Auto-Tour waypoint generation ────────────────────────────

type TourMode = 'interior' | 'exterior';

/** Exterior tour: walk around the building perimeter (existing behavior) */
function generateExteriorTourWaypoints(): { waypoints: THREE.Vector3[]; center: THREE.Vector3 } {
  const allC = Object.values(useStore.getState().containers);
  if (allC.length === 0) return { waypoints: [], center: new THREE.Vector3() };

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let sumX = 0, sumZ = 0, maxY = 0;

  for (const c of allC) {
    const dims = CONTAINER_DIMENSIONS[c.size];
    const halfL = dims.length / 2;
    const halfW = dims.width / 2;
    const cos = Math.cos(c.rotation);
    const sin = Math.sin(c.rotation);
    for (const [lx, lz] of [[halfL, halfW], [halfL, -halfW], [-halfL, halfW], [-halfL, -halfW]]) {
      const wx = c.position.x + lx * cos - lz * sin;
      const wz = c.position.z + lx * sin + lz * cos;
      minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
      minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
    }
    sumX += c.position.x; sumZ += c.position.z;
    maxY = Math.max(maxY, c.position.y + CONTAINER_DIMENSIONS[c.size].height);
  }

  const cx = sumX / allC.length;
  const cz = sumZ / allC.length;
  const center = new THREE.Vector3(cx, maxY * 0.5 + 1, cz);

  const pad = 6.0;
  const x0 = minX - pad, x1 = maxX + pad, z0 = minZ - pad, z1 = maxZ + pad;
  const step = 2.5;
  const y = EYE_HEIGHT;
  const wp: THREE.Vector3[] = [];

  for (let x = x0; x < x1; x += step) wp.push(new THREE.Vector3(x, y, z1));
  wp.push(new THREE.Vector3(x1, y, z1));
  for (let z = z1; z > z0; z -= step) wp.push(new THREE.Vector3(x1, y, z));
  wp.push(new THREE.Vector3(x1, y, z0));
  for (let x = x1; x > x0; x -= step) wp.push(new THREE.Vector3(x, y, z0));
  wp.push(new THREE.Vector3(x0, y, z0));
  for (let z = z0; z < z1; z += step) wp.push(new THREE.Vector3(x0, y, z));
  wp.push(new THREE.Vector3(x0, y, z1));

  return { waypoints: wp, center };
}

/** Interior tour: walk through the house interior, up stairs, across decks */
function generateInteriorTourWaypoints(): { waypoints: THREE.Vector3[]; center: THREE.Vector3 } {
  const state = useStore.getState();
  const allC = Object.values(state.containers);
  if (allC.length === 0) return { waypoints: [], center: new THREE.Vector3() };

  const INSET = 1.2; // metres inset from walls for interior path
  const STEP = 2.0;

  // Building center
  let sumX = 0, sumZ = 0, maxY = 0;
  for (const c of allC) {
    sumX += c.position.x; sumZ += c.position.z;
    maxY = Math.max(maxY, c.position.y + CONTAINER_DIMENSIONS[c.size].height);
  }
  const center = new THREE.Vector3(sumX / allC.length, maxY * 0.5 + 1, sumZ / allC.length);

  // Group containers by level
  const byLevel = new Map<number, typeof allC>();
  for (const c of allC) {
    if (!byLevel.has(c.level)) byLevel.set(c.level, []);
    byLevel.get(c.level)!.push(c);
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);

  const wp: THREE.Vector3[] = [];

  // Helper: get world-space bounds of a set of containers
  const getBounds = (cs: typeof allC) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const c of cs) {
      const dims = CONTAINER_DIMENSIONS[c.size];
      const halfL = dims.length / 2, halfW = dims.width / 2;
      const cosR = Math.cos(c.rotation), sinR = Math.sin(c.rotation);
      for (const [lx, lz] of [[halfL, halfW], [halfL, -halfW], [-halfL, halfW], [-halfL, -halfW]]) {
        const wx = c.position.x + lx * cosR - lz * sinR;
        const wz = c.position.z + lx * sinR + lz * cosR;
        minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
        minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
      }
    }
    return { minX, maxX, minZ, maxZ };
  };

  // Helper: get bounds including deck extensions
  const getDeckBounds = (cs: typeof allC) => {
    const b = getBounds(cs);
    let { minX, maxX, minZ, maxZ } = b;
    for (const c of cs) {
      const dims = CONTAINER_DIMENSIONS[c.size];
      const dd = dims.height; // deck depth = wall height
      const halfL = dims.length / 2, halfW = dims.width / 2;
      for (const side of [WallSide.Left, WallSide.Right, WallSide.Front, WallSide.Back] as const) {
        if (c.mergedWalls.some(mw => mw.endsWith(`:${side}`))) continue;
        const hasDeck = c.walls[side].bays.some(bay =>
          bay.module.type === ModuleType.HingedWall &&
          (bay.module as any).foldsDown && (bay.module as any).openAmount > 0.5
        );
        if (!hasDeck) continue;
        switch (side) {
          case WallSide.Left:  minZ = Math.min(minZ, c.position.z - halfW - dd); break;
          case WallSide.Right: maxZ = Math.max(maxZ, c.position.z + halfW + dd); break;
          case WallSide.Front: maxX = Math.max(maxX, c.position.x + halfL + dd); break;
          case WallSide.Back:  minX = Math.min(minX, c.position.x - halfL - dd); break;
        }
      }
    }
    return { minX, maxX, minZ, maxZ };
  };

  // Helper: add a rectangular perimeter walk
  const addRect = (x0: number, x1: number, z0: number, z1: number, y: number) => {
    for (let x = x0; x <= x1; x += STEP) wp.push(new THREE.Vector3(x, y, z0));
    for (let z = z0; z <= z1; z += STEP) wp.push(new THREE.Vector3(x1, y, z));
    for (let x = x1; x >= x0; x -= STEP) wp.push(new THREE.Vector3(x, y, z1));
    for (let z = z1; z >= z0; z -= STEP) wp.push(new THREE.Vector3(x0, y, z));
  };

  // Process each level
  for (let li = 0; li < levels.length; li++) {
    const level = levels[li];
    const containers = byLevel.get(level)!;
    const walkable = containers.filter(c => !c.floorRemoved);
    if (walkable.length === 0) continue;

    const floorY = walkable[0].position.y + 0.06 + EYE_HEIGHT;

    // 1. Interior perimeter walk (inset from container walls)
    const ib = getBounds(walkable);
    addRect(
      ib.minX + INSET, ib.maxX - INSET,
      ib.minZ + INSET, ib.maxZ - INSET,
      floorY
    );

    // 2. Walk deck extensions if they exist
    const db = getDeckBounds(walkable);
    const hasDeckExtension = db.minX < ib.minX - 0.5 || db.maxX > ib.maxX + 0.5 ||
                              db.minZ < ib.minZ - 0.5 || db.maxZ > ib.maxZ + 0.5;
    if (hasDeckExtension) {
      // Walk to a wall opening (transition from interior to deck)
      wp.push(new THREE.Vector3(ib.minX, floorY, ib.minZ + INSET));
      // Deck perimeter
      addRect(
        db.minX + INSET, db.maxX - INSET,
        db.minZ + INSET, db.maxZ - INSET,
        floorY
      );
      // Walk back inside
      wp.push(new THREE.Vector3(ib.minX + INSET, floorY, ib.minZ + INSET));
    }

    // 3. Find stairs to transition to the next level
    for (const c of containers) {
      for (const item of c.furniture) {
        if (item.type !== FurnitureType.Stairs) continue;
        const cosR = Math.cos(c.rotation), sinR = Math.sin(c.rotation);
        const wx = c.position.x + item.position.x * cosR - item.position.z * sinR;
        const wz = c.position.z + item.position.x * sinR + item.position.z * cosR;

        // Walk to staircase base
        wp.push(new THREE.Vector3(wx, floorY, wz));

        // Walk up stairs (10 intermediate waypoints)
        const h = CONTAINER_DIMENSIONS[c.size].height;
        const stairCat = FURNITURE_CATALOG.find(cat => cat.type === FurnitureType.Stairs)!;
        const stairDir = new THREE.Vector2(Math.sin(item.rotation), Math.cos(item.rotation));
        for (let s = 1; s <= 10; s++) {
          const t = s / 10;
          const dy = t * h;
          const offset = t * stairCat.dims.width;
          wp.push(new THREE.Vector3(
            wx + stairDir.x * offset,
            floorY + dy,
            wz + stairDir.y * offset
          ));
        }
        break; // Use first staircase at this level
      }
    }
  }

  return { waypoints: wp, center };
}

// ── Component ────────────────────────────────────────────────

export default function WalkthroughControls() {
  const controlsRef = useRef<any>(null);
  const { camera, scene } = useThree();
  const containers = useStore((s) => s.containers);
  const viewLevel = useStore((s) => s.viewLevel);
  const setViewMode = useStore((s) => s.setViewMode);
  const bayContextMenu = useStore((s) => s.bayContextMenu);
  const yawRef = useRef(0); // tracks current yaw for save/restore

  // Re-acquire pointer lock when menu closes
  useEffect(() => {
    if (!bayContextMenu && isMenuOpen()) {
      setMenuOpen(false);
      // Small delay to let the menu DOM unmount before re-locking
      const timer = setTimeout(() => safeRequestPointerLock(), 100);
      return () => clearTimeout(timer);
    }
  }, [bayContextMenu]);

  // Movement direction vector (reused)
  const moveDir = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  // Auto-tour state
  const tourRef = useRef<{
    waypoints: THREE.Vector3[];
    idx: number;
    t: number;
    center: THREE.Vector3;
    mode: TourMode;
  } | null>(null);

  // Crosshair target state — expanded for all interactable types
  type CrosshairTarget =
    | { kind: 'bay'; containerId: string; wallSide: WallSide; bayIndex: number; moduleType: ModuleType }
    | { kind: 'railing'; containerId: string; wallSide: WallSide; bayIndex: number }
    | { kind: 'edge'; containerId: string; wall: WallSide; bayIndex: number }
    | { kind: 'floor'; containerId: string }
    | { kind: 'corner'; containerId: string; cornerIndex: number }
    | { kind: 'structural'; containerId: string; elementKey: string }
    | { kind: 'roof'; containerId: string };

  const targetRef = useRef<CrosshairTarget | null>(null);
  const hudLabelRef = useRef<string>('');
  const hudDomRef = useRef<HTMLDivElement | null>(null);
  const currentFloorY = useRef(0); // current ground/floor Y level

  // Create/destroy HUD DOM element for target label (no React re-renders)
  useEffect(() => {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; bottom:120px; left:50%; transform:translateX(-50%);
      padding:6px 16px; border-radius:8px; font-size:13px; font-weight:600;
      color:#fff; background:rgba(0,0,0,0.65); backdrop-filter:blur(8px);
      pointer-events:none; z-index:9999; white-space:nowrap;
      transition:opacity 0.15s; opacity:0; font-family:system-ui,sans-serif;
    `;
    document.body.appendChild(el);
    hudDomRef.current = el;
    return () => { document.body.removeChild(el); hudDomRef.current = null; };
  }, []);

  // Build wall collision boxes — PER-BAY: rebuild when containers change
  const wallBoxes = useMemo(() => {
    const boxes: THREE.Box3[] = [];
    const visibleContainers = Object.values(containers).filter(
      (c) => viewLevel === null || c.level <= viewLevel
    );

    const WALL_T = 0.06;

    for (const c of visibleContainers) {
      const dims = CONTAINER_DIMENSIONS[c.size];
      const cosR = Math.cos(c.rotation);
      const sinR = Math.sin(c.rotation);
      const halfL = dims.length / 2;
      const halfW = dims.width / 2;
      const h = dims.height;
      const y = c.position.y;

      // Helper: transform local AABB to world AABB
      const localBoxToWorld = (lcx: number, lcz: number, lhw: number, lhd: number, boxH: number, boxY: number = y) => {
        const wx = c.position.x + lcx * cosR - lcz * sinR;
        const wz = c.position.z + lcx * sinR + lcz * cosR;
        const extX = Math.abs(lhw * cosR) + Math.abs(lhd * sinR);
        const extZ = Math.abs(lhw * sinR) + Math.abs(lhd * cosR);
        return new THREE.Box3(
          new THREE.Vector3(wx - extX, boxY, wz - extZ),
          new THREE.Vector3(wx + extX, boxY + boxH, wz + extZ)
        );
      };

      const wallDefs: { side: WallSide; wallCx: number; wallCz: number; isLong: boolean }[] = [
        { side: WallSide.Left,  wallCx: 0,      wallCz: -halfW, isLong: true },
        { side: WallSide.Right, wallCx: 0,      wallCz: halfW,  isLong: true },
        { side: WallSide.Front, wallCx: halfL,  wallCz: 0,      isLong: false },
        { side: WallSide.Back,  wallCx: -halfL, wallCz: 0,      isLong: false },
      ];

      // ★ Phase 4: Voxel-granularity collision — per-face physics from voxel grid.
      // Each non-Open face of an active voxel generates a collision box.
      // Railing faces generate waist-height (1.0m) collision boxes.
      const hasActiveVoxels = c.voxelGrid?.some((v) => v?.active) ?? false;

      if (hasActiveVoxels && c.voxelGrid) {
        const grid = c.voxelGrid;
        const colP = dims.length / 6;   // halo architecture: 6 core cols
        const rowP = dims.width / 2;    // 2 core rows

        for (let vr = 0; vr < VOXEL_ROWS; vr++) {
          for (let vc = 0; vc < VOXEL_COLS; vc++) {
            const vIdx = vr * VOXEL_COLS + vc;
            const voxel = grid[vIdx];
            if (!voxel?.active) continue;

            // Voxel center in container-local coords (matching ContainerSkin)
            const vx = -(vc - 3.5) * colP;
            const vz = (vr - 1.5) * rowP;

            // 4 wall faces — top/bottom skipped (floor detection handles Y)
            // NOTE: vx = -(vc-3.5)*colP so col axis is INVERTED — E(+X)=dc:-1, W(-X)=dc:+1
            const vFaces: { dir: 'n'|'s'|'e'|'w'; dc: number; dr: number;
                            cx: number; cz: number; hw: number; hd: number }[] = [
              { dir: 'n', dc: 0, dr:-1, cx: vx, cz: vz - rowP/2, hw: colP/2, hd: WALL_T },
              { dir: 's', dc: 0, dr: 1, cx: vx, cz: vz + rowP/2, hw: colP/2, hd: WALL_T },
              { dir: 'e', dc:-1, dr: 0, cx: vx + colP/2, cz: vz, hw: WALL_T, hd: rowP/2 },
              { dir: 'w', dc: 1, dr: 0, cx: vx - colP/2, cz: vz, hw: WALL_T, hd: rowP/2 },
            ];

            for (const f of vFaces) {
              const nr = vr + f.dr;
              const nc = vc + f.dc;
              const inBounds = nc >= 0 && nc < VOXEL_COLS && nr >= 0 && nr < VOXEL_ROWS;
              const sameGridActive = inBounds && (grid[nr * VOXEL_COLS + nc]?.active ?? false);
              if (sameGridActive) continue; // face shared with active same-container neighbour

              // Probe 0.3m beyond this face to test for cross-container adjacency (melt check).
              // Runs for BOTH out-of-bounds AND in-bounds-but-inactive neighbours (e.g. halo cells).
              const probeOff = { n: [0, -0.3], s: [0, +0.3], e: [+0.3, 0], w: [-0.3, 0] }[f.dir];
              const pLX = f.cx + probeOff[0];
              const pLZ = f.cz + probeOff[1];
              const probeWX = c.position.x + pLX * cosR - pLZ * sinR;
              const probeWZ = c.position.z + pLX * sinR + pLZ * cosR;

              let isMeltedCross = false;
              for (const other of visibleContainers) {
                if (other.id === c.id) continue;
                const oDims = CONTAINER_DIMENSIONS[other.size];
                const odx = probeWX - other.position.x;
                const odz = probeWZ - other.position.z;
                if (Math.abs(odx) > oDims.length / 2 + 0.5 || Math.abs(odz) > oDims.width / 2 + 0.5) continue;
                const oCosR = Math.cos(other.rotation ?? 0);
                const oSinR = Math.sin(other.rotation ?? 0);
                const localX =  odx * oCosR + odz * oSinR;
                const localZ = -odx * oSinR + odz * oCosR;
                const oColP = oDims.length / 6;
                const oRowP = oDims.width / 2;
                const oVc = Math.round(-localX / oColP + 3.5);
                const oVr = Math.round(localZ / oRowP + 1.5);
                if (oVc < 0 || oVc >= VOXEL_COLS || oVr < 0 || oVr >= VOXEL_ROWS) continue;
                for (let oLvl = 0; oLvl < 2; oLvl++) {
                  const oVoxel = other.voxelGrid?.[oLvl * VOXEL_ROWS * VOXEL_COLS + oVr * VOXEL_COLS + oVc];
                  if (oVoxel?.active) { isMeltedCross = true; break; }
                }
                if (isMeltedCross) break;
              }
              if (isMeltedCross) continue; // face shared with adjacent container — skip collision

              // Open faces are passable — no collision
              const surface = voxel.faces[f.dir];
              if (surface === 'Open') continue;
              // Railing types: collision only up to railing height
              const fH = (surface === 'Railing_Cable' || surface === 'Railing_Glass') ? 1.0 : h;
              boxes.push(localBoxToWorld(f.cx, f.cz, f.hw, f.hd, fH));
            }
          }
        }
        continue; // Skip legacy wall processing — voxelGrid branch handled above
      }

      // Legacy containers without voxelGrid: add 4 perimeter boxes
      for (const wallDef of wallDefs) {
        if (c.mergedWalls.some((mw) => mw.endsWith(`:${wallDef.side}`))) continue;
        const wallLen = wallDef.isLong ? dims.length : dims.width;
        if (wallDef.isLong) {
          boxes.push(localBoxToWorld(0, wallDef.wallCz, wallLen / 2, WALL_T, h));
        } else {
          boxes.push(localBoxToWorld(wallDef.wallCx, 0, WALL_T, wallLen / 2, h));
        }
      }
    }

    return boxes;
  }, [containers, viewLevel]);

  // Build walkable floor surfaces for Y-level detection (includes stair steps + floor holes)
  const { floorSurfaces, floorHoles } = useMemo(() => {
    const surfaces: { box: THREE.Box2; y: number }[] = [];
    const holes: { box: THREE.Box2; y: number }[] = [];
    const visibleContainers = Object.values(containers).filter(
      (c) => viewLevel === null || c.level <= viewLevel
    );

    // Helper: transform local rect to world AABB
    const localToWorld = (c: typeof visibleContainers[0], lx1: number, lz1: number, lx2: number, lz2: number) => {
      const cosR = Math.cos(c.rotation);
      const sinR = Math.sin(c.rotation);
      const pts = [
        { lx: lx1, lz: lz1 }, { lx: lx2, lz: lz1 },
        { lx: lx2, lz: lz2 }, { lx: lx1, lz: lz2 },
      ];
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of pts) {
        const wx = c.position.x + p.lx * cosR - p.lz * sinR;
        const wz = c.position.z + p.lx * sinR + p.lz * cosR;
        minX = Math.min(minX, wx);
        maxX = Math.max(maxX, wx);
        minZ = Math.min(minZ, wz);
        maxZ = Math.max(maxZ, wz);
      }
      return new THREE.Box2(new THREE.Vector2(minX, minZ), new THREE.Vector2(maxX, maxZ));
    };

    const stairCatalog = FURNITURE_CATALOG.find(cat => cat.type === FurnitureType.Stairs)!;

    for (const c of visibleContainers) {
      const dims = CONTAINER_DIMENSIONS[c.size];
      const halfL = dims.length / 2;
      const halfW = dims.width / 2;
      const floorY = c.position.y + 0.06;

      // Container interior floor (skip if floor is removed for atrium)
      if (!c.floorRemoved) {
        surfaces.push({
          box: localToWorld(c, -halfL, -halfW, halfL, halfW),
          y: floorY,
        });
      }

      // ── Voxel stair surfaces (Cycle 17 Req 4C) ──────────────
      // Stair voxels (voxelType === 'stairs') provide 6 tread-level step surfaces
      // for FPV smooth ascent. Uses the same colPitch/rowPitch grid math as ContainerSkin.
      if (c.voxelGrid) {
        const VOXEL_LEVELS = 2;
        const vHeight = dims.height / VOXEL_LEVELS;
        const vOffset = vHeight / 2;
        const colPitch = dims.length / 6;
        const rowPitch = dims.width / (VOXEL_ROWS - 2); // 2 core rows
        const STEPS = 6;

        for (let vi = 0; vi < c.voxelGrid.length; vi++) {
          const voxel = c.voxelGrid[vi];
          if (!voxel?.active || voxel.voxelType !== 'stairs') continue;

          const level  = Math.floor(vi / (VOXEL_COLS * VOXEL_ROWS));
          const rowLocal = Math.floor((vi % (VOXEL_COLS * VOXEL_ROWS)) / VOXEL_COLS);
          const col    = vi % VOXEL_COLS;

          // Voxel local position in container space (same negated-X logic as ContainerSkin)
          const voxWLocal = col === 0 || col === VOXEL_COLS - 1 ? colPitch : colPitch;
          const voxDLocal = rowLocal === 0 || rowLocal === VOXEL_ROWS - 1 ? rowPitch : rowPitch;
          const px = -(col - 3.5) * colPitch;
          const pz = (rowLocal - 1.5) * rowPitch;
          const py = c.position.y + level * vHeight; // base of this voxel level

          const isNS = voxel.stairDir !== 'ew';
          const stepH = vHeight / STEPS;
          const treadLen = (isNS ? voxDLocal : voxWLocal) / STEPS;

          for (let step = 0; step < STEPS; step++) {
            const treadY = py + stepH * (step + 1); // top of tread surface
            if (isNS) {
              // N-S stair: treads advance along Z
              const treadZ = pz - voxDLocal / 2 + treadLen * step;
              surfaces.push({
                box: localToWorld(c, px - voxWLocal / 2, treadZ, px + voxWLocal / 2, treadZ + treadLen),
                y: treadY,
              });
            } else {
              // E-W stair: treads advance along X (note: px is negated)
              const treadX = px + voxWLocal / 2 - treadLen * (step + 1);
              surfaces.push({
                box: localToWorld(c, treadX, pz - voxDLocal / 2, treadX + treadLen, pz + voxDLocal / 2),
                y: treadY,
              });
            }
          }
        }
      }

      // ── Voxel roof walkable surfaces — halo-aware (WU-4) ─────────────────
      // Any active voxel with faces.top !== 'Open' is walkable from above.
      // Uses getVoxelLayout for correct sizing (including halo voxels).
      if (c.voxelGrid) {
        const VOXEL_LEVELS_LOCAL = 2;
        const vH = dims.height / VOXEL_LEVELS_LOCAL;

        for (let vi = 0; vi < c.voxelGrid.length; vi++) {
          const voxel = c.voxelGrid[vi];
          if (!voxel?.active || voxel?.faces?.top === 'Open') continue;

          const level    = Math.floor(vi / (VOXEL_COLS * VOXEL_ROWS));
          const localIdx = vi % (VOXEL_COLS * VOXEL_ROWS);
          const col      = localIdx % VOXEL_COLS;
          const row      = Math.floor(localIdx / VOXEL_COLS);

          const { voxW, voxD, px, pz } = getVoxelLayout(col, row, dims);
          const roofY = c.position.y + (level + 1) * vH;

          surfaces.push({
            box: localToWorld(c,
              px - voxW / 2 + 0.04, pz - voxD / 2 + 0.04,
              px + voxW / 2 - 0.04, pz + voxD / 2 - 0.04),
            y: roofY,
          });
        }
      }

      // Staircase walkable steps (furniture-based) — 13 individual step surfaces
      for (const item of c.furniture) {
        if (item.type !== FurnitureType.Stairs) continue;
        const { length: sW, width: sD, height: sH } = stairCatalog.dims;
        const stepCount = 13;
        const stepH = sH / stepCount;
        const stepD = sD / stepCount;
        const cosF = Math.cos(item.rotation);
        const sinF = Math.sin(item.rotation);

        for (let step = 0; step < stepCount; step++) {
          // Local step position (in container space, accounting for furniture rotation)
          const localStepZ = -sD / 2 + (step + 0.5) * stepD;
          // Rotate step offset by furniture rotation
          const rotX = localStepZ * sinF;
          const rotZ = localStepZ * cosF;
          const cx = item.position.x + rotX;
          const cz = item.position.z + rotZ;
          const stepY = c.position.y + item.position.y + (step + 1) * stepH;

          // Step footprint in container local space
          const halfSX = sW / 2;
          const halfSZ = stepD / 2;

          // For simplicity with rotation, use a slightly oversized square step
          const radius = Math.max(halfSX, halfSZ);
          surfaces.push({
            box: localToWorld(c, cx - radius, cz - radius, cx + radius, cz + radius),
            y: stepY,
          });
        }

        // Floor hole in the container above — allows walking up through the floor
        for (const topId of c.supporting) {
          const topC = containers[topId];
          if (!topC) continue;
          const holeY = topC.position.y + 0.06;
          const halfSX = sW / 2 + 0.1; // slightly larger to ensure coverage
          const halfSZ = sD / 2 + 0.1;
          holes.push({
            box: localToWorld(c, item.position.x - halfSX, item.position.z - halfSZ,
                               item.position.x + halfSX, item.position.z + halfSZ),
            y: holeY,
          });
        }
      }
    }

    return { floorSurfaces: surfaces, floorHoles: holes };
  }, [containers, viewLevel]);

  // ── Scroll handler — cycles voxel face or legacy floor/roof ──────────────

  /** Cycle a voxel face surface via hoveredVoxelEdge */
  const cycleVoxelFace = useCallback((delta: 1 | -1) => {
    const store = useStore.getState();
    const edge = store.hoveredVoxelEdge;
    if (!edge) return;
    const c = store.containers[edge.containerId];
    const voxel = c?.voxelGrid?.[edge.voxelIndex];
    if (!voxel) return;
    const face = edge.face as keyof typeof voxel.faces;
    const currentSurface = voxel.faces[face];
    const cycle = getCycleForFace(face);
    const currentIdx = cycle.indexOf(currentSurface as never);
    const nextSurface = cycle[((currentIdx + delta) % cycle.length + cycle.length) % cycle.length];
    store.setVoxelFace(edge.containerId, edge.voxelIndex, face, nextSurface as never);
  }, []);

  /** Scroll handler — cycles state based on target kind */
  const handleScroll = useCallback((deltaY: number) => {
    const target = targetRef.current;
    const forward = deltaY < 0; // scroll up = forward through cycle
    const store = useStore.getState();
    const delta: 1 | -1 = forward ? 1 : -1;

    // Voxel face hover takes priority
    if (store.hoveredVoxelEdge) {
      cycleVoxelFace(delta);
      return;
    }

    if (!target) return;

    switch (target.kind) {
      case 'bay':
      case 'railing':
      case 'edge':
        // Legacy bay targets — cycle as voxel face if hoveredVoxelEdge is set (handled above)
        // otherwise fall through silently
        break;
      case 'floor': {
        const LEGACY_FLOOR_CYCLE: Array<FloorMaterialType | undefined> = [
          undefined, 'wood:light', 'wood:cedar', 'wood:dark', 'concrete', 'tile:white', 'tile:dark', 'steel', 'bamboo'
        ];
        const c = store.containers[target.containerId];
        if (!c) return;
        const cur = c.floorMaterial;
        const idx = LEGACY_FLOOR_CYCLE.indexOf(cur);
        const next = LEGACY_FLOOR_CYCLE[(idx + (forward ? 1 : LEGACY_FLOOR_CYCLE.length - 1)) % LEGACY_FLOOR_CYCLE.length];
        store.setFloorMaterial(target.containerId, next);
        break;
      }
      case 'roof':
        store.toggleRoof(target.containerId);
        break;
      case 'structural':
        store.toggleStructuralElement(target.containerId, target.elementKey);
        break;
      case 'corner':
        break;
    }
  }, [cycleVoxelFace]);

  // Legacy toggleTarget — still used by spacebar/click (always forward cycle)
  const toggleTarget = useCallback(() => {
    const target = targetRef.current;
    if (!target) return;
    // Forward cycle
    handleScroll(-1);
  }, [handleScroll]);

  // Keyboard handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      // ESC exits walkthrough
      if (e.code === "Escape") {
        setViewMode(ViewMode.Realistic3D);
      }
      // SPACE = toggle door/shoji open state, or cycle voxel face, or toggle targeted panel
      if (e.code === "Space") {
        e.preventDefault();
        const store = useStore.getState();
        const edge = store.hoveredVoxelEdge;
        if (edge) {
          const c = store.containers[edge.containerId];
          const voxel = c?.voxelGrid?.[edge.voxelIndex];
          const face = edge.face;
          if (voxel?.faces[face] === 'Door' || voxel?.faces[face] === 'Glass_Shoji') {
            store.toggleOpenFace(edge.containerId, edge.voxelIndex, face);
          } else {
            cycleVoxelFace(1);
          }
        } else {
          toggleTarget();
        }
      }
      // E = open deep-edit menu (same as left-click)
      if (e.code === "KeyE") {
        const target = targetRef.current;
        if (target) {
          const store = useStore.getState();
          const cx = window.innerWidth / 2;
          const cy = window.innerHeight / 2;
          if (target.kind === 'floor') {
            store.openFloorContextMenu(cx, cy, target.containerId);
            setMenuOpen(true);
            safeExitPointerLock();
          }
        }
      }
      // T = toggle auto-tour (cycles: off → interior → exterior → off)
      if (e.code === "KeyT") {
        if (tourRef.current) {
          // If interior, switch to exterior; if exterior, stop
          if (tourRef.current.mode === 'interior') {
            const { waypoints, center } = generateExteriorTourWaypoints();
            if (waypoints.length > 1) {
              tourRef.current = { waypoints, idx: 0, t: 0, center, mode: 'exterior' };
            } else {
              tourRef.current = null;
            }
          } else {
            tourRef.current = null;
          }
        } else {
          // Start with interior tour
          const { waypoints, center } = generateInteriorTourWaypoints();
          if (waypoints.length > 1) {
            tourRef.current = { waypoints, idx: 0, t: 0, center, mode: 'interior' };
            safeExitPointerLock();
          } else {
            // Fallback to exterior if no interior waypoints
            const ext = generateExteriorTourWaypoints();
            if (ext.waypoints.length > 1) {
              tourRef.current = { waypoints: ext.waypoints, idx: 0, t: 0, center: ext.center, mode: 'exterior' };
              safeExitPointerLock();
            }
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    // Left-Click = stop tour, OR open menu on target (releases pointer lock)
    const onClick = () => {
      if (tourRef.current) {
        tourRef.current = null;
        return;
      }
      if (!document.pointerLockElement) return;

      const target = targetRef.current;
      if (!target) return;

      const store = useStore.getState();
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      if (target.kind === 'bay') {
        store.openBayContextMenu(cx, cy, target.containerId, target.wallSide, target.bayIndex);
        setMenuOpen(true);
        safeExitPointerLock();
      } else if (target.kind === 'edge' || target.kind === 'railing') {
        const wall = target.kind === 'railing' ? target.wallSide : target.wall;
        store.openEdgeContextMenu(cx, cy, target.containerId, wall, target.bayIndex);
        setMenuOpen(true);
        safeExitPointerLock();
      } else if (target.kind === 'floor') {
        store.openFloorContextMenu(cx, cy, target.containerId);
        setMenuOpen(true);
        safeExitPointerLock();
      } else {
        // For structural/roof/corner — toggle immediately (no menu)
        toggleTarget();
      }
    };

    // Right-click = IMMEDIATE state cycle (no menu, no pointer unlock)
    // This is the "Valheim rapid-build" pattern
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (!document.pointerLockElement) return;
      const target = targetRef.current;
      if (!target) return;

      // Forward-cycle the target state immediately
      handleScroll(-1); // -1 deltaY = forward cycle
    };

    // Scroll wheel = cycle target state without unlocking mouse
    const onWheel = (e: WheelEvent) => {
      if (!document.pointerLockElement) return;
      e.preventDefault();
      handleScroll(e.deltaY);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("click", onClick);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("click", onClick);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("wheel", onWheel);
      // Clear all keys on unmount
      for (const k of Object.keys(keys)) keys[k] = false;
    };
  }, [setViewMode, toggleTarget, handleScroll]);

  // WU-6: Save FPV position on unmount so re-entry restores the last explored position
  useEffect(() => {
    return () => {
      useStore.getState().saveWalkthroughPos(
        camera.position.toArray() as [number, number, number],
        yawRef.current
      );
      safeExitPointerLock();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // cleanup only

  // Set initial camera position — restore saved FPV position or spawn inside ground floor container
  const hasSpawned = useRef(false);
  useEffect(() => {
    if (hasSpawned.current) return;
    hasSpawned.current = true;

    // WU-6: Restore saved FPV position if available
    const savedPos = useStore.getState().savedWalkthroughPos;
    if (savedPos) {
      camera.position.set(...savedPos.position);
      yawRef.current = savedPos.yaw;
      // Reconstruct look direction from saved yaw
      const lookX = camera.position.x + Math.sin(savedPos.yaw) * 5;
      const lookZ = camera.position.z + Math.cos(savedPos.yaw) * 5;
      camera.lookAt(lookX, camera.position.y, lookZ);
      return;
    }

    const allContainers = Object.values(useStore.getState().containers);
    if (allContainers.length === 0) {
      camera.position.set(0, EYE_HEIGHT, 8);
      camera.lookAt(0, EYE_HEIGHT, 0);
      return;
    }

    // Find the largest ground-floor container (level 0) — spawn inside it
    const groundFloor = allContainers
      .filter((c) => c.level === 0)
      .sort((a, b) => {
        const da = CONTAINER_DIMENSIONS[a.size];
        const db = CONTAINER_DIMENSIONS[b.size];
        return (db.length * db.width) - (da.length * da.width);
      });

    const target = groundFloor[0] || allContainers[0];
    const spawnX = target.position.x;
    const spawnZ = target.position.z;
    const spawnFloorY = target.position.y + 0.06;

    camera.position.set(spawnX, spawnFloorY + EYE_HEIGHT, spawnZ);
    currentFloorY.current = spawnFloorY;

    // Look toward the center of all containers
    let cx = 0, cz = 0;
    for (const c of allContainers) { cx += c.position.x; cz += c.position.z; }
    cx /= allContainers.length; cz /= allContainers.length;
    // Look outward from the container if we're at the center
    if (Math.abs(cx - spawnX) < 0.5 && Math.abs(cz - spawnZ) < 0.5) {
      camera.lookAt(spawnX, spawnFloorY + EYE_HEIGHT, spawnZ - 5);
    } else {
      camera.lookAt(cx, spawnFloorY + EYE_HEIGHT, cz);
    }
  }, [camera]);

  // Check if a position collides with any wall box
  const collides = useCallback(
    (x: number, z: number, eyeY: number): boolean => {
      const body = new THREE.Box3(
        new THREE.Vector3(x - COLLISION_RADIUS, eyeY - 1.5, z - COLLISION_RADIUS),
        new THREE.Vector3(x + COLLISION_RADIUS, eyeY + 0.2, z + COLLISION_RADIUS)
      );
      for (const box of wallBoxes) {
        if (body.intersectsBox(box)) return true;
      }
      return false;
    },
    [wallBoxes]
  );

  // Find the floor Y at a given XZ position (respects floor holes above stairs)
  const getFloorY = useCallback(
    (x: number, z: number, currentY: number): number => {
      const pt = new THREE.Vector2(x, z);
      let bestY = 0; // ground level
      const feetY = currentY - EYE_HEIGHT; // current floor Y from feet position
      const maxStepUp = 1.0; // max height player can step up (1m = stair step)

      for (const surface of floorSurfaces) {
        if (!surface.box.containsPoint(pt)) continue;
        // Only consider surfaces at or below current feet + step-up tolerance
        if (surface.y > feetY + maxStepUp) continue;

        // Skip surfaces that have a floor hole at this point (staircase openings)
        const hasHole = floorHoles.some(
          hole => Math.abs(hole.y - surface.y) < 0.15 && hole.box.containsPoint(pt)
        );
        if (hasHole) continue;

        if (surface.y > bestY) bestY = surface.y;
      }
      return bestY;
    },
    [floorSurfaces, floorHoles]
  );

  // Movement loop
  useFrame((_, delta) => {
    // Clamp delta to prevent huge jumps
    const dt = Math.min(delta, 0.1);

    // ── Auto-Tour ─────────────────────────────────────────────
    if (tourRef.current) {
      const tour = tourRef.current;
      const wp = tour.waypoints;
      const from = wp[tour.idx];
      const to = wp[(tour.idx + 1) % wp.length];
      const segLen = from.distanceTo(to);

      tour.t += (dt * WALK_SPEED) / Math.max(segLen, 0.01);

      if (tour.t >= 1) {
        tour.t = 0;
        tour.idx++;
        if (tour.idx >= wp.length - 1) {
          tourRef.current = null; // Tour complete
          return;
        }
      }

      // Interpolate position
      camera.position.lerpVectors(from, to, tour.t);

      // Look direction depends on tour mode
      let targetDir: THREE.Vector3;
      if (tour.mode === 'interior') {
        // Interior: look ahead along path (direction of travel)
        // Use the next segment start to smooth out corners
        const nextIdx = Math.min(tour.idx + 2, wp.length - 1);
        const lookAhead = wp[nextIdx].clone();
        lookAhead.y = camera.position.y;
        targetDir = lookAhead.sub(camera.position);
        if (targetDir.lengthSq() < 0.01) {
          // Fallback: look toward building center when nearly at waypoint
          targetDir = tour.center.clone().setY(camera.position.y).sub(camera.position);
        }
        targetDir.normalize();
      } else {
        // Exterior: look toward building center
        const lookTarget = tour.center.clone();
        lookTarget.y = camera.position.y;
        targetDir = lookTarget.sub(camera.position).normalize();
      }

      const targetQuat = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(camera.position, camera.position.clone().add(targetDir), camera.up)
      );
      camera.quaternion.slerp(targetQuat, dt * 2);
      return;
    }

    const speed = keys["ShiftLeft"] || keys["ShiftRight"] ? SPRINT_SPEED : WALK_SPEED;

    // Get camera forward/right vectors (XZ plane only)
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    right.crossVectors(forward, camera.up).normalize();

    // WASD = movement, Arrow keys = look direction, Q/Z = fly up/down
    moveDir.set(0, 0, 0);
    if (keys["KeyW"]) moveDir.add(forward);
    if (keys["KeyS"]) moveDir.sub(forward);
    if (keys["KeyA"]) moveDir.sub(right);
    if (keys["KeyD"]) moveDir.add(right);

    const eyeY = currentFloorY.current + EYE_HEIGHT;

    if (moveDir.lengthSq() > 0.001) {
      moveDir.normalize().multiplyScalar(speed * dt);

      // Try X movement
      const newX = camera.position.x + moveDir.x;
      if (!collides(newX, camera.position.z, eyeY)) {
        camera.position.x = newX;
      }

      // Try Z movement independently (slide along walls)
      const newZ = camera.position.z + moveDir.z;
      if (!collides(camera.position.x, newZ, eyeY)) {
        camera.position.z = newZ;
      }
    }

    // Q/Z = fly up/down (noclip vertical)
    if (keys["KeyQ"]) currentFloorY.current += speed * dt;
    if (keys["KeyZ"]) currentFloorY.current = Math.max(0, currentFloorY.current - speed * dt);

    // Arrow keys = look direction (rotate camera pitch/yaw)
    const lookSpeed = 1.5; // rad/sec
    if (keys["ArrowLeft"] || keys["ArrowRight"] || keys["ArrowUp"] || keys["ArrowDown"]) {
      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.setFromQuaternion(camera.quaternion);
      if (keys["ArrowLeft"]) euler.y += lookSpeed * dt;
      if (keys["ArrowRight"]) euler.y -= lookSpeed * dt;
      if (keys["ArrowUp"]) euler.x = Math.min(Math.PI / 2 - 0.05, euler.x + lookSpeed * dt);
      if (keys["ArrowDown"]) euler.x = Math.max(-Math.PI / 2 + 0.05, euler.x - lookSpeed * dt);
      camera.quaternion.setFromEuler(euler);
    }
    // WU-6: Keep yawRef in sync for save/restore
    const _eulerYaw = new THREE.Euler(0, 0, 0, 'YXZ');
    _eulerYaw.setFromQuaternion(camera.quaternion);
    yawRef.current = _eulerYaw.y;

    // Detect floor level at current position (only when not flying)
    if (!keys["KeyQ"] && !keys["KeyZ"]) {
      const floorY = getFloorY(camera.position.x, camera.position.z, eyeY);
      // Smooth floor transition to prevent jarring teleports
      const targetFloorY = floorY;
      const diff = targetFloorY - currentFloorY.current;
      if (Math.abs(diff) < 0.01) {
        currentFloorY.current = targetFloorY;
      } else {
        // Smooth step: fast for going up (stairs), gradual for falling
        const rate = diff > 0 ? 8.0 : 4.0;
        currentFloorY.current += diff * Math.min(1, rate * dt);
      }
    }
    camera.position.y = currentFloorY.current + EYE_HEIGHT;

    // ── Crosshair Raycasting — detect ALL interactable types ──
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    raycaster.set(camera.position, dir);
    raycaster.far = TARGET_RANGE;

    const intersects = raycaster.intersectObjects(scene.children, true);
    let foundTarget = false;

    for (const hit of intersects) {
      const ud = hit.object.userData;
      if (!ud) continue;

      let newTarget: CrosshairTarget | null = null;
      let label = '';

      if (ud.isRailing) {
        const ws = ud.wallSide as WallSide;
        const bi = ud.bayIndex as number;
        newTarget = { kind: 'railing', containerId: ud.containerId, wallSide: ws, bayIndex: bi };
        const c = useStore.getState().containers[ud.containerId];
        const mod = c?.walls[ws]?.bays[bi]?.module;
        const owType = mod?.type === ModuleType.HingedWall ? mod.outerWall : '?';
        label = `Edge: ${owType} [scroll]`;
      } else if (ud.isBay) {
        // WU-5: If this hitbox carries voxel face data, set hoveredVoxelEdge for FPV editing
        if (ud.face && ud.containerId && ud.voxelIndex != null) {
          const faceCtx = ud.face === 'top' ? 'roof' : ud.face === 'bottom' ? 'floor' : 'wall';
          useStore.getState().setHoveredVoxelEdge({ containerId: ud.containerId, voxelIndex: ud.voxelIndex, face: ud.face });
          useStore.getState().setFaceContext(faceCtx);
          const faceNames: Record<string, string> = { n: 'North', s: 'South', e: 'East', w: 'West', top: 'Roof', bottom: 'Floor' };
          label = `${faceNames[ud.face] ?? ud.face} face [scroll]`;
          newTarget = { kind: 'bay', containerId: ud.containerId, wallSide: undefined as any, bayIndex: ud.voxelIndex, moduleType: ModuleType.OpenVoid };
        } else {
          const ws = ud.wallSide as WallSide;
          const bi = ud.bayIndex as number;
          newTarget = { kind: 'bay', containerId: ud.containerId, wallSide: ws, bayIndex: bi, moduleType: ud.moduleType };
          const names: Record<string, string> = {
            [ModuleType.PanelSolid]: 'Solid', [ModuleType.PanelGlass]: 'Glass',
            [ModuleType.HingedWall]: 'Hinged', [ModuleType.OpenVoid]: 'Open',
          };
          const displayName = ud.moduleType ? (names[ud.moduleType] || ud.moduleType) : 'Voxel';
          label = `${displayName} [scroll]`;
        }
      } else if (ud.isFloorEdge) {
        const w = ud.wall as WallSide;
        const bi = ud.bayIndex as number;
        newTarget = { kind: 'edge', containerId: ud.containerId, wall: w, bayIndex: bi };
        const c = useStore.getState().containers[ud.containerId];
        const mod = c?.walls[w]?.bays[bi]?.module;
        const owType = mod?.type === ModuleType.HingedWall ? mod.outerWall : '?';
        label = `Edge: ${owType} [scroll]`;
      } else if (ud.isFloor) {
        newTarget = { kind: 'floor', containerId: ud.containerId ?? '' };
        // Try to get floor material name
        if (ud.containerId) {
          const c = useStore.getState().containers[ud.containerId];
          label = `Floor: ${c?.floorMaterial || 'default'} [scroll]`;
        } else {
          label = 'Floor [scroll]';
        }
      } else if (ud.isCornerEdge) {
        // Corner edge proxy — treat as an edge for cycling
        const w = ud.wall as WallSide;
        const bi = ud.bayIndex as number;
        newTarget = { kind: 'edge', containerId: ud.containerId, wall: w, bayIndex: bi };
        const c = useStore.getState().containers[ud.containerId];
        const mod = c?.walls[w]?.bays[bi]?.module;
        const owType = mod?.type === ModuleType.HingedWall ? mod.outerWall : 'none';
        label = `Corner Edge: ${owType} [R-click cycle]`;
      } else if (ud.isCorner) {
        newTarget = { kind: 'corner', containerId: ud.containerId, cornerIndex: ud.cornerIndex };
        label = 'Corner Deck [scroll]';
      } else if (ud.isStructural) {
        newTarget = { kind: 'structural', containerId: ud.containerId, elementKey: ud.elementKey };
        label = `Frame: ${ud.elementKey} [scroll]`;
      } else if (ud.isRoof) {
        newTarget = { kind: 'roof', containerId: ud.containerId };
        label = 'Roof [scroll]';
      }

      if (newTarget) {
        targetRef.current = newTarget;
        hudLabelRef.current = label;
        foundTarget = true;
        break;
      }
    }

    if (!foundTarget) {
      targetRef.current = null;
      hudLabelRef.current = '';
      // WU-5: Clear FPV face highlight when crosshair loses target
      const st = useStore.getState();
      if (st.hoveredVoxelEdge) st.setHoveredVoxelEdge(null);
    }

    // Update HUD DOM label (no React re-render)
    if (hudDomRef.current) {
      const lbl = hudLabelRef.current;
      if (lbl) {
        hudDomRef.current.textContent = lbl;
        hudDomRef.current.style.opacity = '1';
      } else {
        hudDomRef.current.style.opacity = '0';
      }
    }
  });

  return (
    <>
      <PointerLockControls
        ref={controlsRef}
        makeDefault
      />
    </>
  );
}
