"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import { ThreeEvent, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  type Container,
  type HingedWall,
  ContainerSize,
  CONTAINER_DIMENSIONS,
  WallSide,
  ModuleType,
  type ContainerDimensions,
  type Zone,
  type SurfaceType,
  type Voxel,
  VOXEL_COLS,
  VOXEL_ROWS,
} from "@/types/container";
import { useStore } from "@/store/useStore";

const Y = 0.5;

// ── Voxel grid constants ────────────────────────────────────
const COLS = VOXEL_COLS; // 8
const ROWS = VOXEL_ROWS; // 4
const BPV_EDGE = 0.09;   // Wall edge line thickness in blueprint view
const BORDER_THICK = 0.04;

// ── Container floor materials ───────────────────────────────
const matFloor         = new THREE.MeshBasicMaterial({ color: "#ffffff", depthTest: false });
const matFloorSelected = new THREE.MeshBasicMaterial({ color: "#e3f2fd", depthTest: false });
const matBorder        = new THREE.MeshBasicMaterial({ color: "#90a4ae", depthTest: false });
const matBorderSelected= new THREE.MeshBasicMaterial({ color: "#2196f3", depthTest: false });
const matFloorHover    = new THREE.MeshBasicMaterial({ color: "#e3f2fd", transparent: true, opacity: 0.3, depthTest: false });
const matFloorRemovedDash = new THREE.MeshBasicMaterial({ color: "#ef9a9a", depthTest: false });

const FLOOR_MAT_COLORS: Record<string, string> = {
  'wood:light': '#c4956a', 'wood:cedar': '#9e5e3a', 'wood:dark': '#6d4c2a',
  'concrete': '#bdbdbd', 'tile:white': '#f5f5f5', 'tile:dark': '#616161',
  'steel': '#90a4ae', 'bamboo': '#a0c080',
};

// ── BPV voxel floor fill materials (keyed by bottom face SurfaceType) ──────────
const bpvFloorMats: Partial<Record<SurfaceType, THREE.MeshBasicMaterial>> = {
  Deck_Wood:     new THREE.MeshBasicMaterial({ color: "#8d6e63", depthTest: false }),
  Concrete:      new THREE.MeshBasicMaterial({ color: "#9e9e9e", depthTest: false }),
  Solid_Steel:   new THREE.MeshBasicMaterial({ color: "#cfd8dc", depthTest: false }),
  Glass_Pane:    new THREE.MeshBasicMaterial({ color: "#b3e5fc", depthTest: false }),
  Railing_Cable: new THREE.MeshBasicMaterial({ color: "#e0e0e0", transparent: true, opacity: 0.5, depthTest: false }),
  Railing_Glass: new THREE.MeshBasicMaterial({ color: "#e1f5fe", transparent: true, opacity: 0.6, depthTest: false }),
  Door:          new THREE.MeshBasicMaterial({ color: "#d7ccc8", depthTest: false }),
};

// ── BPV voxel wall edge materials (keyed by N/S/E/W face SurfaceType) ──────────
const bpvWallMats: Partial<Record<SurfaceType, THREE.MeshBasicMaterial>> = {
  Solid_Steel:   new THREE.MeshBasicMaterial({ color: "#37474f", depthTest: false }),
  Glass_Pane:    new THREE.MeshBasicMaterial({ color: "#4fc3f7", depthTest: false }),
  Railing_Cable: new THREE.MeshBasicMaterial({ color: "#90a4ae", depthTest: false }),
  Railing_Glass: new THREE.MeshBasicMaterial({ color: "#81d4fa", depthTest: false }),
  Door:          new THREE.MeshBasicMaterial({ color: "#5c4033", depthTest: false }),
  Gull_Wing:     new THREE.MeshBasicMaterial({ color: "#e64a19", depthTest: false }),
  Half_Fold:     new THREE.MeshBasicMaterial({ color: "#ff8a65", depthTest: false }),
  Deck_Wood:     new THREE.MeshBasicMaterial({ color: "#6d4c41", depthTest: false }),
  Concrete:      new THREE.MeshBasicMaterial({ color: "#757575", depthTest: false }),
  Stairs:        new THREE.MeshBasicMaterial({ color: "#5d4037", depthTest: false }),
  Stairs_Down:   new THREE.MeshBasicMaterial({ color: "#3e2723", depthTest: false }),
};

// BPV interaction overlays
const matVoxelHover    = new THREE.MeshBasicMaterial({ color: "#00e5ff", transparent: true, opacity: 0.25, depthTest: false });
const matVoxelSelected = new THREE.MeshBasicMaterial({ color: "#1565c0", transparent: true, opacity: 0.30, depthTest: false });
const matStairArrow    = new THREE.MeshBasicMaterial({ color: "#37474f", depthTest: false });

// Zone overlay colors
const zoneColors = [
  { fill: "#e3f2fd", border: "#1565c0", text: "#1565c0" },
  { fill: "#fce4ec", border: "#c62828", text: "#c62828" },
  { fill: "#e8f5e9", border: "#2e7d32", text: "#2e7d32" },
  { fill: "#fff3e0", border: "#e65100", text: "#e65100" },
];

// Grid line materials
const gridLineMat    = new THREE.LineBasicMaterial({ color: "#e0e0e0", depthTest: false });
const gridSectionMat = new THREE.LineBasicMaterial({ color: "#cfd8dc", depthTest: false, linewidth: 1 });

// ── FlatRect helper ─────────────────────────────────────────
function FlatRect({
  x, z, w, h, y, material, order,
}: {
  x: number; z: number; w: number; h: number; y: number; material: THREE.Material; order?: number;
}) {
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={order ?? 999}>
      <planeGeometry args={[w, h]} />
    </mesh>
  );
}

// ── Voxel layout helper ─────────────────────────────────────
// Mirrors ContainerSkin's getVoxelLayout exactly (negated X axis, halo at container edges).
function getVoxelLayout(col: number, row: number, dims: ContainerDimensions) {
  const coreW   = dims.length / 6;   // colPitch
  const coreD   = dims.width  / 2;   // rowPitch
  const haloExt = dims.height;       // halo voxel outward extent = container height

  const isHaloCol = col === 0 || col === COLS - 1;
  const isHaloRow = row === 0 || row === ROWS - 1;

  const voxW = isHaloCol ? haloExt : coreW;
  const voxD = isHaloRow ? haloExt : coreD;

  let px: number;
  if      (col === 0)        px =  (dims.length / 2 + haloExt / 2);  // left halo (+X)
  else if (col === COLS - 1) px = -(dims.length / 2 + haloExt / 2);  // right halo (-X)
  else                       px = -(col - 3.5) * coreW;              // NEGATED X axis

  let pz: number;
  if      (row === 0)        pz = -(dims.width / 2 + haloExt / 2);   // front halo (-Z)
  else if (row === ROWS - 1) pz =  (dims.width / 2 + haloExt / 2);   // back halo (+Z)
  else                       pz =  (row - 1.5) * coreD;

  return { voxW, voxD, px, pz };
}

// ── BPV adjacency check ─────────────────────────────────────
// Returns true when the neighbor voxel in direction `dir` is active.
// CRITICAL: E/W are INVERTED because col→X mapping is negated.
function bpvAdj(grid: Voxel[], col: number, row: number, dir: 'n' | 's' | 'e' | 'w', level: number): boolean {
  const dc = dir === 'e' ? -1 : dir === 'w' ? 1  : 0;
  const dr = dir === 's' ?  1 : dir === 'n' ? -1 : 0;
  const nc = col + dc;
  const nr = row + dr;
  if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return false;
  return grid[level * ROWS * COLS + nr * COLS + nc]?.active ?? false;
}

// ── Stair direction arrow ────────────────────────────────────
function StairArrow({ px, pz, voxW, voxD, ascending }: {
  px: number; pz: number; voxW: number; voxD: number; ascending: string;
}) {
  const isNS = ascending === 'n' || ascending === 's';
  // N/W = negative direction (-Z or -X); S/E = positive direction (+Z or +X)
  const sign = (ascending === 'n' || ascending === 'w') ? -1 : 1;

  const bodyLen  = (isNS ? voxD : voxW) * 0.42;
  const bodyThin = (isNS ? voxW : voxD) * 0.10;
  const bodyX    = isNS ? px : px + sign * bodyLen / 2;
  const bodyZ    = isNS ? pz + sign * bodyLen / 2 : pz;

  const headWide = (isNS ? voxW : voxD) * 0.25;
  const headLen  = (isNS ? voxD : voxW) * 0.12;
  const headX    = isNS ? px : px + sign * (bodyLen + headLen / 2);
  const headZ    = isNS ? pz + sign * (bodyLen + headLen / 2) : pz;

  return (
    <>
      <FlatRect
        x={bodyX} z={bodyZ}
        w={isNS ? bodyThin : bodyLen} h={isNS ? bodyLen : bodyThin}
        y={Y + 0.002} material={matStairArrow} order={1002}
      />
      <FlatRect
        x={headX} z={headZ}
        w={isNS ? headWide : headLen} h={isNS ? headLen : headWide}
        y={Y + 0.002} material={matStairArrow} order={1002}
      />
    </>
  );
}

// ── Voxel Blueprint Grid ────────────────────────────────────
// Renders all active voxels at the given level as floor fills + wall edge lines.
function VoxelBlueprintGrid({
  container, dims, level,
}: {
  container: Container;
  dims: ContainerDimensions;
  level: number;
}) {
  const setSelectedVoxel = useStore((s) => s.setSelectedVoxel);
  const select           = useStore((s) => s.select);
  const setHoveredVoxel  = useStore((s) => s.setHoveredVoxel);
  const selectedVoxel    = useStore((s) => s.selectedVoxel);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const grid: Voxel[] = container.voxelGrid ?? [];

  return (
    <group>
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const row = Math.floor(i / COLS);
        const col = i % COLS;
        const idx = level * ROWS * COLS + row * COLS + col;
        const voxel = grid[idx];
        if (!voxel?.active) return null;

        const { voxW, voxD, px, pz } = getVoxelLayout(col, row, dims);
        const isHov = hoveredIdx === idx;
        const isSel = selectedVoxel?.containerId === container.id &&
          'index' in (selectedVoxel ?? {}) && (selectedVoxel as { index: number }).index === idx;

        const floorMat = bpvFloorMats[voxel.faces.bottom] ?? matFloor;

        return (
          <group key={idx}>
            {/* Floor fill */}
            <FlatRect x={px} z={pz} w={voxW} h={voxD} y={Y - 0.003} material={floorMat} order={992} />

            {/* Selection / hover overlay */}
            {isSel && (
              <FlatRect x={px} z={pz} w={voxW} h={voxD} y={Y - 0.002} material={matVoxelSelected} order={993} />
            )}
            {isHov && !isSel && (
              <FlatRect x={px} z={pz} w={voxW} h={voxD} y={Y - 0.001} material={matVoxelHover} order={994} />
            )}

            {/* Wall edge lines — one per non-Open face with no active neighbor */}
            {(['n', 's', 'e', 'w'] as const).map((dir) => {
              const surface = voxel.faces[dir];
              if (surface === 'Open') return null;
              if (bpvAdj(grid, col, row, dir, level)) return null;
              const wallMat = bpvWallMats[surface];
              if (!wallMat) return null;

              const isNS     = dir === 'n' || dir === 's';
              const edgeSign = (dir === 's' || dir === 'e') ? 1 : -1;
              const edgeX    = isNS ? px : px + edgeSign * (voxW / 2 - BPV_EDGE / 2);
              const edgeZ    = isNS ? pz + edgeSign * (voxD / 2 - BPV_EDGE / 2) : pz;

              return (
                <FlatRect
                  key={dir}
                  x={edgeX} z={edgeZ}
                  w={isNS ? voxW : BPV_EDGE}
                  h={isNS ? BPV_EDGE : voxD}
                  y={Y - 0.001} material={wallMat} order={995}
                />
              );
            })}

            {/* Stair direction arrow */}
            {voxel.voxelType === 'stairs' && voxel.stairAscending && (
              <StairArrow
                px={px} pz={pz} voxW={voxW} voxD={voxD}
                ascending={voxel.stairAscending}
              />
            )}

            {/* Hit mesh — above floor click target so voxel wins */}
            <mesh
              position={[px, Y + 0.004, pz]}
              rotation={[-Math.PI / 2, 0, 0]}
              renderOrder={1001}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                select(container.id, e.nativeEvent.shiftKey);
                setSelectedVoxel({ containerId: container.id, index: idx });
              }}
              onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                setHoveredIdx(idx);
                setHoveredVoxel({ containerId: container.id, index: idx });
              }}
              onPointerOut={() => {
                setHoveredIdx(null);
                setHoveredVoxel(null);
              }}
            >
              <planeGeometry args={[voxW - 0.02, voxD - 0.02]} />
              <meshBasicMaterial transparent opacity={0.001} depthWrite={false} depthTest={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ── Blueprint Container ─────────────────────────────────────
function BlueprintContainer({ container }: { container: Container }) {
  const dims = CONTAINER_DIMENSIONS[container.size];

  const bpvLevel                = useStore((s) => s.bpvLevel);
  const selection               = useStore((s) => s.selection);
  const select                  = useStore((s) => s.select);
  const startContainerDrag      = useStore((s) => s.startContainerDrag);
  const renameContainer         = useStore((s) => s.renameContainer);
  const openFloorContextMenu    = useStore((s) => s.openFloorContextMenu);
  const openContainerContextMenu = useStore((s) => s.openContainerContextMenu);
  const dragMovingId            = useStore((s) => s.dragMovingId);

  const isSelected     = selection.includes(container.id);
  const isBeingDragged = dragMovingId === container.id;

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(container.name);
  const [hovered, setHovered]         = useState(false);
  const [floorHovered, setFloorHovered] = useState(false);

  const dragPendingRef = useRef<{ id: string; sx: number; sy: number } | null>(null);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const p = dragPendingRef.current;
      if (!p) return;
      const dx = e.clientX - p.sx;
      const dy = e.clientY - p.sy;
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        startContainerDrag(p.id);
        dragPendingRef.current = null;
      }
    };
    const handleUp = () => { dragPendingRef.current = null; };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [startContainerDrag]);

  const floorColor = container.floorMaterial
    ? (FLOOR_MAT_COLORS[container.floorMaterial] ?? '#ffffff')
    : '#ffffff';

  const floorMat = useMemo(() => {
    if (isSelected) return matFloorSelected;
    if (floorColor === '#ffffff') return matFloor;
    return new THREE.MeshBasicMaterial({ color: floorColor, depthTest: false });
  }, [isSelected, floorColor]);

  // All hooks must come before early return
  if (isBeingDragged) return null;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (isSelected) {
      dragPendingRef.current = { id: container.id, sx: e.nativeEvent.clientX, sy: e.nativeEvent.clientY };
    } else {
      select(container.id, e.nativeEvent.shiftKey);
    }
  };

  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setRenameValue(container.name);
    setIsRenaming(true);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== container.name) renameContainer(container.id, trimmed);
    setIsRenaming(false);
  };

  const sizeLabel = container.size === ContainerSize.Standard20 ? "20'" :
                    container.size === ContainerSize.Standard40 ? "40'" : "40' HC";

  return (
    <group
      position={[container.position.x, 0, container.position.z]}
      rotation={[0, container.rotation, 0]}
    >
      {/* Outer border — thin gray or blue when selected/hovered */}
      <FlatRect
        x={0} z={0}
        w={dims.length + BORDER_THICK * 2} h={dims.width + BORDER_THICK * 2}
        y={Y - 0.004} material={isSelected || hovered ? matBorderSelected : matBorder} order={990}
      />

      {/* Floor fill */}
      {!container.floorRemoved ? (
        <>
          <FlatRect x={0} z={0} w={dims.length} h={dims.width}
            y={Y - 0.003} material={floorMat} order={991} />
          {floorHovered && (
            <FlatRect x={0} z={0} w={dims.length} h={dims.width}
              y={Y - 0.002} material={matFloorHover} order={992} />
          )}
        </>
      ) : (
        /* Floor removed — dashed edge markers */
        <>
          {[
            { x: 0,               z: -dims.width  / 2, w: dims.length * 0.3, h: 0.03 },
            { x: 0,               z:  dims.width  / 2, w: dims.length * 0.3, h: 0.03 },
            { x: -dims.length / 2, z: 0,               w: 0.03, h: dims.width * 0.3 },
            { x:  dims.length / 2, z: 0,               w: 0.03, h: dims.width * 0.3 },
          ].map((d, di) => (
            <FlatRect key={di} x={d.x} z={d.z} w={d.w} h={d.h}
              y={Y - 0.003} material={matFloorRemovedDash} order={991} />
          ))}
        </>
      )}

      {/* Voxel blueprint grid (floor fills + wall edge lines) */}
      <VoxelBlueprintGrid container={container} dims={dims} level={bpvLevel} />

      {/* Floor click target — below voxel hit meshes (Y+0.001 vs Y+0.004) */}
      <mesh
        position={[0, Y + 0.001, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={993}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          openFloorContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY, container.id);
        }}
        onContextMenu={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          e.nativeEvent.preventDefault();
          openContainerContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY, container.id);
        }}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
          setFloorHovered(true);
        }}
        onPointerOut={() => { setHovered(false); setFloorHovered(false); }}
      >
        <planeGeometry args={[dims.length - 0.1, dims.width - 0.1]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} depthTest={false} />
      </mesh>

      {/* Label — suppressed for grouped containers (WU-3) */}
      {container.groupId === null && (
        <Html
          position={[0, Y + 0.01, 0]}
          center
          style={{ pointerEvents: isRenaming ? "auto" : "none", userSelect: "none" }}
        >
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setIsRenaming(false);
              }}
              style={{
                fontSize: "11px", fontWeight: 700, fontFamily: "system-ui, sans-serif",
                border: "1px solid #2196f3", borderRadius: "3px",
                padding: "1px 4px", outline: "none", textAlign: "center",
                width: "100px", background: "#fff",
              }}
            />
          ) : (
            <div style={{ textAlign: "center", fontFamily: "system-ui, sans-serif", whiteSpace: "nowrap" }}>
              <div style={{
                color: isSelected ? "#1565c0" : "#37474f",
                fontSize: "11px", fontWeight: 600,
                textShadow: isSelected ? "none" : "0 0 4px rgba(255,255,255,0.9)",
              }}>
                {container.name}
              </div>
              <div style={{
                color: isSelected ? "#90a4ae" : "#78909c",
                fontSize: "9px", fontWeight: 500, marginTop: "1px",
              }}>
                {sizeLabel} — {dims.length.toFixed(1)} × {dims.width.toFixed(1)} m
              </div>
            </div>
          )}
        </Html>
      )}

      {/* Level badge */}
      {container.level > 0 && (
        <Html
          position={[dims.length / 2 - 0.3, Y + 0.01, -dims.width / 2 + 0.3]}
          center
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div style={{
            width: "20px", height: "20px", borderRadius: "50%",
            background: "#1565c0", color: "#fff",
            fontSize: "10px", fontWeight: 700, fontFamily: "system-ui",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1.5px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}>
            L{container.level}
          </div>
        </Html>
      )}
    </group>
  );
}

// ── Grid ─────────────────────────────────────────────────────
function SimpleGrid() {
  const { lines, sections } = useMemo(() => {
    const EXTENT = 60;
    const CELL    = 1.2;
    const SECTION = 2.4;
    const GY = 0.3;

    const linePoints: THREE.Vector3[]    = [];
    const sectionPoints: THREE.Vector3[] = [];

    const cellCount = Math.floor(EXTENT / CELL);
    for (let n = -cellCount; n <= cellCount; n++) {
      const pos = n * CELL;
      linePoints.push(new THREE.Vector3(pos, GY, -EXTENT), new THREE.Vector3(pos, GY, EXTENT));
      linePoints.push(new THREE.Vector3(-EXTENT, GY, pos), new THREE.Vector3(EXTENT, GY, pos));
    }

    const secCount = Math.floor(EXTENT / SECTION);
    for (let n = -secCount; n <= secCount; n++) {
      const pos = n * SECTION;
      sectionPoints.push(new THREE.Vector3(pos, GY + 0.001, -EXTENT), new THREE.Vector3(pos, GY + 0.001, EXTENT));
      sectionPoints.push(new THREE.Vector3(-EXTENT, GY + 0.001, pos), new THREE.Vector3(EXTENT, GY + 0.001, pos));
    }

    return {
      lines:    new THREE.BufferGeometry().setFromPoints(linePoints),
      sections: new THREE.BufferGeometry().setFromPoints(sectionPoints),
    };
  }, []);

  return (
    <group renderOrder={0}>
      <lineSegments geometry={lines}    material={gridLineMat}    renderOrder={0} />
      <lineSegments geometry={sections} material={gridSectionMat} renderOrder={1} />
    </group>
  );
}

// ── Zone Overlay ─────────────────────────────────────────────
function ZoneOverlay({ zone, containers, colorIdx }: {
  zone: Zone; containers: Record<string, Container>; colorIdx: number;
}) {
  const colors = zoneColors[colorIdx % zoneColors.length];

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let count = 0;

  for (const id of zone.containerIds) {
    const c = containers[id];
    if (!c) continue;
    const dims   = CONTAINER_DIMENSIONS[c.size];
    const halfL  = dims.length / 2;
    const halfW  = dims.width  / 2;
    let extL = 0, extR = 0, extF = 0, extB = 0;

    for (const side of [WallSide.Left, WallSide.Right, WallSide.Front, WallSide.Back] as const) {
      if (c.mergedWalls.some(mw => mw.endsWith(`:${side}`))) continue;
      const hasDeck = c.walls[side].bays.some(b =>
        b.module.type === ModuleType.HingedWall &&
        (b.module as HingedWall).foldsDown &&
        (b.module as HingedWall).openAmount > 0.5
      );
      if (!hasDeck) continue;
      if (side === WallSide.Left)  extB = dims.height;
      if (side === WallSide.Right) extF = dims.height;
      if (side === WallSide.Front) extR = dims.height;
      if (side === WallSide.Back)  extL = dims.height;
    }

    minX = Math.min(minX, c.position.x - halfL - extL);
    maxX = Math.max(maxX, c.position.x + halfL + extR);
    minZ = Math.min(minZ, c.position.z - halfW - extB);
    maxZ = Math.max(maxZ, c.position.z + halfW + extF);
    count++;
  }

  if (count === 0) return null;

  const pad = 0.5;
  const cx  = (minX + maxX) / 2;
  const cz  = (minZ + maxZ) / 2;
  const w   = maxX - minX + pad * 2;
  const h   = maxZ - minZ + pad * 2;

  return (
    <group>
      <mesh position={[cx, Y - 0.012, cz]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color={colors.fill} transparent opacity={0.5} depthTest={false} />
      </mesh>
      <mesh position={[cx, Y - 0.011, cz]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={11}>
        <planeGeometry args={[w + 0.08, h + 0.08]} />
        <meshBasicMaterial color={colors.border} transparent opacity={0.3} depthTest={false} />
      </mesh>
      <Html position={[cx, Y + 0.02, minZ - pad - 0.3]} center style={{ pointerEvents: "none", userSelect: "none" }}>
        <div style={{
          color: colors.text, fontSize: "12px", fontWeight: 700, fontFamily: "system-ui, sans-serif",
          background: "rgba(255,255,255,0.85)", padding: "2px 8px", borderRadius: "4px",
          border: `1px solid ${colors.border}`, whiteSpace: "nowrap",
        }}>
          {zone.name}
        </div>
      </Html>
    </group>
  );
}

// ── Marquee Drag-Select ─────────────────────────────────────
const DRAG_THRESHOLD = 5;

function MarqueeSelect({ containers }: { containers: Container[] }) {
  const selectMultiple = useStore((s) => s.selectMultiple);
  const clearSelection = useStore((s) => s.clearSelection);
  const { camera, gl } = useThree();

  const [marquee, setMarquee] = useState<{
    x1: number; z1: number; x2: number; z2: number;
  } | null>(null);

  const dragRef = useRef<{
    startX: number; startZ: number;
    screenX: number; screenY: number;
    active: boolean;
  } | null>(null);

  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2), []);

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width)  * 2 - 1;
    const ndcY = -((clientY - rect.top)  / rect.height) * 2 + 1;
    const ray  = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const hit = new THREE.Vector3();
    ray.ray.intersectPlane(groundPlane, hit);
    return { x: hit.x, z: hit.z };
  }, [camera, gl.domElement, groundPlane]);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const world = screenToWorld(e.nativeEvent.clientX, e.nativeEvent.clientY);
    dragRef.current = {
      startX: world.x, startZ: world.z,
      screenX: e.nativeEvent.clientX, screenY: e.nativeEvent.clientY,
      active: false,
    };
  }, [screenToWorld]);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.screenX;
      const dy = e.clientY - dragRef.current.screenY;

      if (!dragRef.current.active && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        dragRef.current.active = true;
      }

      if (dragRef.current.active) {
        const world = screenToWorld(e.clientX, e.clientY);
        setMarquee({
          x1: dragRef.current.startX, z1: dragRef.current.startZ,
          x2: world.x, z2: world.z,
        });
      }
    };

    const handleUp = (e: PointerEvent) => {
      if (!dragRef.current) return;

      if (dragRef.current.active) {
        const world = screenToWorld(e.clientX, e.clientY);
        const minX = Math.min(dragRef.current.startX, world.x);
        const maxX = Math.max(dragRef.current.startX, world.x);
        const minZ = Math.min(dragRef.current.startZ, world.z);
        const maxZ = Math.max(dragRef.current.startZ, world.z);

        const selected: string[] = [];
        for (const c of containers) {
          const dims  = CONTAINER_DIMENSIONS[c.size];
          const cx    = c.position.x;
          const cz    = c.position.z;
          const halfL = dims.length / 2;
          const halfW = dims.width  / 2;
          if (cx - halfL < maxX && cx + halfL > minX && cz - halfW < maxZ && cz + halfW > minZ) {
            selected.push(c.id);
          }
        }

        if (selected.length > 0) selectMultiple(selected);
        else clearSelection();
      } else {
        clearSelection();
      }

      dragRef.current = null;
      setMarquee(null);
    };

    canvas.addEventListener("pointermove", handleMove);
    canvas.addEventListener("pointerup", handleUp);
    return () => {
      canvas.removeEventListener("pointermove", handleMove);
      canvas.removeEventListener("pointerup", handleUp);
    };
  }, [gl.domElement, screenToWorld, containers, selectMultiple, clearSelection]);

  return (
    <>
      {/* Marquee catch-plane — far below container tiles so it only catches empty-space clicks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -10, 0]} onPointerDown={handlePointerDown}>
        <planeGeometry args={[500, 500]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>

      {marquee && (() => {
        const mx = (marquee.x1 + marquee.x2) / 2;
        const mz = (marquee.z1 + marquee.z2) / 2;
        const mw = Math.abs(marquee.x2 - marquee.x1);
        const mh = Math.abs(marquee.z2 - marquee.z1);
        return (
          <group>
            <mesh position={[mx, Y + 0.006, mz]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2001}>
              <planeGeometry args={[mw + 0.06, mh + 0.06]} />
              <meshBasicMaterial color="#1565c0" transparent opacity={0.4} depthTest={false} />
            </mesh>
            <mesh position={[mx, Y + 0.007, mz]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2002}>
              <planeGeometry args={[mw, mh]} />
              <meshBasicMaterial color="#2196f3" transparent opacity={0.1} depthTest={false} />
            </mesh>
          </group>
        );
      })()}
    </>
  );
}

// ── Main Blueprint Scene ────────────────────────────────────
export default function BlueprintRenderer() {
  const containers = useStore((s) => s.containers);
  const zones      = useStore((s) => s.zones);
  const viewLevel  = useStore((s) => s.viewLevel);
  const bpvLevel   = useStore((s) => s.bpvLevel);
  const setBpvLevel = useStore((s) => s.setBpvLevel);

  const allContainers     = Object.values(containers);
  const visibleContainers = viewLevel === null
    ? allContainers
    : allContainers.filter((c) => c.level === viewLevel);

  return (
    <>
      <color attach="background" args={["#f4f6f8"]} />
      <ambientLight intensity={1.5} />

      <SimpleGrid />

      {Object.values(zones).map((zone, i) => (
        <ZoneOverlay key={zone.id} zone={zone} containers={containers} colorIdx={i} />
      ))}

      {visibleContainers.map((c) => (
        <BlueprintContainer key={c.id} container={c} />
      ))}

      <MarqueeSelect containers={visibleContainers} />

      {/* BPV level toggle — top-right corner overlay */}
      <Html
        position={[0, 0, 0]}
        style={{ position: "fixed", top: 68, right: 12, pointerEvents: "none" }}
        zIndexRange={[9999, 9999]}
      >
        <div style={{ pointerEvents: "auto", display: "flex", gap: 4 }}>
          {([0, 1] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setBpvLevel(lvl)}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "system-ui",
                borderRadius: 6,
                border: "1.5px solid",
                borderColor: bpvLevel === lvl ? "#1565c0" : "#cfd8dc",
                background: bpvLevel === lvl ? "#1565c0" : "#ffffff",
                color: bpvLevel === lvl ? "#ffffff" : "#37474f",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {lvl === 0 ? "Floor" : "Ceiling"}
            </button>
          ))}
        </div>
      </Html>
    </>
  );
}
