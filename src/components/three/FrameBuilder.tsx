"use client";

/**
 * FrameBuilder.tsx — Universal Tile Renderer + Ghost Cursor
 *
 * Renders tiles from frameStore as:
 *   Edges  → cylinders (beams)
 *   Faces  → flat boxes (panels)
 *   Corners → small cubes (columns)
 *
 * Ghost cursor: hover ground → shows container footprint ghost.
 * Left-click = stamp. Right-click = erase tile. Scroll = cycle tool.
 */

import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  useFrameStore,
  CELL, WALL_H, BAY_40FT,
  parseKey,
  cellToWorld,
  worldToCell,
  type StylePreset,
  type TileState,
  type EdgeKey,
  type FaceKey,
  type CornerKey,
  type PanelKind,
} from "@/store/frameStore";

// ── Style Material Sets ──────────────────────────────────────

interface MatSet {
  beam: THREE.Material;
  column: THREE.Material;
  floor: THREE.Material;
  wall: THREE.Material;
  glass: THREE.Material;
  roof: THREE.Material;
  railing: THREE.Material;
}

const STYLE_MATS: Record<StylePreset, MatSet> = {
  Industrial: {
    beam: new THREE.MeshStandardMaterial({ color: "#37474f", roughness: 0.4, metalness: 0.6 }),
    column: new THREE.MeshStandardMaterial({ color: "#455a64", roughness: 0.3, metalness: 0.7 }),
    floor: new THREE.MeshStandardMaterial({ color: "#5d4037", roughness: 0.85 }),
    wall: new THREE.MeshStandardMaterial({ color: "#546e7a", roughness: 0.7, metalness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: "#81d4fa", roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    roof: new THREE.MeshStandardMaterial({ color: "#455a64", roughness: 0.6, metalness: 0.3 }),
    railing: new THREE.MeshStandardMaterial({ color: "#78909c", roughness: 0.5, metalness: 0.4, transparent: true, opacity: 0.5 }),
  },
  Modern: {
    beam: new THREE.MeshStandardMaterial({ color: "#212121", roughness: 0.2, metalness: 0.8 }),
    column: new THREE.MeshStandardMaterial({ color: "#424242", roughness: 0.2, metalness: 0.8 }),
    floor: new THREE.MeshStandardMaterial({ color: "#e0e0e0", roughness: 0.3 }),
    wall: new THREE.MeshStandardMaterial({ color: "#fafafa", roughness: 0.2 }),
    glass: new THREE.MeshStandardMaterial({ color: "#b3e5fc", roughness: 0.02, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
    roof: new THREE.MeshStandardMaterial({ color: "#e0e0e0", roughness: 0.3 }),
    railing: new THREE.MeshStandardMaterial({ color: "#616161", roughness: 0.3, metalness: 0.6, transparent: true, opacity: 0.5 }),
  },
  Rustic: {
    beam: new THREE.MeshStandardMaterial({ color: "#6d4c41", roughness: 0.9 }),
    column: new THREE.MeshStandardMaterial({ color: "#5d4037", roughness: 0.85 }),
    floor: new THREE.MeshStandardMaterial({ color: "#8d6e63", roughness: 0.9 }),
    wall: new THREE.MeshStandardMaterial({ color: "#a1887f", roughness: 0.85 }),
    glass: new THREE.MeshStandardMaterial({ color: "#a5d6a7", roughness: 0.1, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
    roof: new THREE.MeshStandardMaterial({ color: "#795548", roughness: 0.9 }),
    railing: new THREE.MeshStandardMaterial({ color: "#8d6e63", roughness: 0.8, transparent: true, opacity: 0.5 }),
  },
};

const ghostMat = new THREE.MeshBasicMaterial({ color: "#4caf50", transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
const ghostWire = new THREE.MeshBasicMaterial({ color: "#4caf50", transparent: true, opacity: 0.5, wireframe: true });

// ── Geometry constants ───────────────────────────────────────

const BEAM_R = 0.04;
const COL_SIZE = 0.10;
const PANEL_THICK = 0.04;

// ── Edge position/rotation lookup ────────────────────────────
// Returns [offsetX, offsetY, offsetZ, rotX, rotY, rotZ, length] relative to cell center

const H = CELL;    // horizontal beam length
const V = WALL_H;  // vertical beam length
const hx = CELL / 2;
const hz = CELL / 2;
const hy = WALL_H / 2;

type EdgeGeom = [number, number, number, number, number, number, number];

const EDGE_GEOM: Record<EdgeKey, EdgeGeom> = {
  // Bottom ring (y=0)
  b_front: [0, 0, -hz, 0, 0, Math.PI / 2, H],
  b_back:  [0, 0,  hz, 0, 0, Math.PI / 2, H],
  b_left:  [-hx, 0, 0, Math.PI / 2, 0, 0, H],
  b_right: [ hx, 0, 0, Math.PI / 2, 0, 0, H],
  // Top ring (y=WALL_H)
  t_front: [0, V, -hz, 0, 0, Math.PI / 2, H],
  t_back:  [0, V,  hz, 0, 0, Math.PI / 2, H],
  t_left:  [-hx, V, 0, Math.PI / 2, 0, 0, H],
  t_right: [ hx, V, 0, Math.PI / 2, 0, 0, H],
  // Verticals
  v_fl: [-hx, hy, -hz, 0, 0, 0, V],
  v_fr: [ hx, hy, -hz, 0, 0, 0, V],
  v_br: [ hx, hy,  hz, 0, 0, 0, V],
  v_bl: [-hx, hy,  hz, 0, 0, 0, V],
};

// ── Face position/rotation/size lookup ───────────────────────
// Returns [offsetX, offsetY, offsetZ, rotX, rotY, rotZ, sizeW, sizeH]

type FaceGeom = [number, number, number, number, number, number, number, number];

const FACE_GEOM: Record<FaceKey, FaceGeom> = {
  bottom: [0, 0, 0,        0, 0, 0,           CELL, CELL],     // XZ plane at y=0
  top:    [0, V, 0,        0, 0, 0,           CELL, CELL],     // XZ plane at y=H
  front:  [0, hy, -hz,     Math.PI / 2, 0, 0, CELL, WALL_H],  // XY plane at z=-hz
  back:   [0, hy,  hz,     Math.PI / 2, 0, 0, CELL, WALL_H],  // XY plane at z=+hz
  left:   [-hx, hy, 0,     0, 0, Math.PI / 2, WALL_H, CELL],  // ZY plane at x=-hx
  right:  [ hx, hy, 0,     0, 0, Math.PI / 2, WALL_H, CELL],  // ZY plane at x=+hx
};

// ── Corner position lookup ───────────────────────────────────

const CORNER_POS: Record<CornerKey, [number, number, number]> = {
  bfl: [-hx, 0, -hz],
  bfr: [ hx, 0, -hz],
  bbr: [ hx, 0,  hz],
  bbl: [-hx, 0,  hz],
  tfl: [-hx, V, -hz],
  tfr: [ hx, V, -hz],
  tbr: [ hx, V,  hz],
  tbl: [-hx, V,  hz],
};

// ── Shared geometries (created once) ─────────────────────────

const beamGeoCache = new Map<number, THREE.CylinderGeometry>();
function getBeamGeo(length: number): THREE.CylinderGeometry {
  if (!beamGeoCache.has(length)) {
    beamGeoCache.set(length, new THREE.CylinderGeometry(BEAM_R, BEAM_R, length, 8));
  }
  return beamGeoCache.get(length)!;
}

const colGeo = new THREE.BoxGeometry(COL_SIZE, COL_SIZE, COL_SIZE);

// ── Tile Renderer ────────────────────────────────────────────

function TileMesh({ tileKey, tile, mats }: { tileKey: string; tile: TileState; mats: MatSet }) {
  const [gx, gy, gz] = parseKey(tileKey);
  const [wx, wy, wz] = cellToWorld(gx, gy, gz);

  return (
    <group position={[wx, wy, wz]}>
      {/* Edges (beams) */}
      {(Object.keys(tile.edges) as EdgeKey[]).map((ek) => {
        const [ox, oy, oz, rx, ry, rz, len] = EDGE_GEOM[ek];
        return (
          <mesh
            key={`e_${ek}`}
            position={[ox, oy, oz]}
            rotation={[rx, ry, rz]}
            geometry={getBeamGeo(len)}
            material={mats.beam}
            castShadow
          />
        );
      })}

      {/* Faces (panels) */}
      {(Object.entries(tile.faces) as [FaceKey, PanelKind][]).map(([fk, kind]) => {
        if (kind === "open") return null;
        const [ox, oy, oz, rx, ry, rz, sw, sh] = FACE_GEOM[fk];
        const mat = mats[kind] || mats.wall;
        const isHoriz = fk === "top" || fk === "bottom";

        return (
          <mesh
            key={`f_${fk}`}
            position={[ox, oy, oz]}
            rotation={isHoriz ? [-Math.PI / 2, 0, 0] : [rx, ry, rz]}
            material={mat}
            castShadow={!isHoriz}
            receiveShadow={isHoriz}
          >
            <boxGeometry args={[sw, sh, PANEL_THICK]} />
          </mesh>
        );
      })}

      {/* Corners (columns) */}
      {(Object.keys(tile.corners) as CornerKey[]).map((ck) => {
        const [ox, oy, oz] = CORNER_POS[ck];
        return (
          <mesh
            key={`c_${ck}`}
            position={[ox, oy, oz]}
            geometry={colGeo}
            material={mats.column}
            castShadow
          />
        );
      })}
    </group>
  );
}

// ── Ghost Cursor ─────────────────────────────────────────────

function GhostCursor() {
  const buildMode = useFrameStore((s) => s.buildMode);
  const tool = useFrameStore((s) => s.tool);
  const brushRotation = useFrameStore((s) => s.brushRotation);
  const { camera } = useThree();

  const groupRef = useRef<THREE.Group>(null);
  const mouseNDC = useRef(new THREE.Vector2(0, 0));
  const snappedCell = useRef({ gx: 0, gy: 0, gz: 0 });
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  useEffect(() => {
    if (!buildMode) return;
    const onMove = (e: MouseEvent) => {
      mouseNDC.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNDC.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).tagName !== "CANVAS") return;
      const store = useFrameStore.getState();
      const { gx, gy, gz } = snappedCell.current;
      if (store.tool === "container") {
        store.stampContainer(gx, gy, gz, store.brushRotation);
      } else if (store.tool === "eraser") {
        store.removeTile(gx, gy, gz);
      }
    };
    const onContext = (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName !== "CANVAS") return;
      e.preventDefault();
      const { gx, gy, gz } = snappedCell.current;
      useFrameStore.getState().removeTile(gx, gy, gz);
    };
    // Scroll-wheel tool cycling REMOVED — scroll is now always camera zoom.
    // Use number keys 1-4 to switch tools in Frame Builder.
    const onWheel = (e: WheelEvent) => { void e; };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.code === "KeyR" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        useFrameStore.getState().rotateBrush();
      }
      const n = parseInt(e.key);
      if (n >= 1 && n <= 4) {
        const tools = ["beam", "panel", "container", "eraser"] as const;
        useFrameStore.getState().setTool(tools[n - 1]);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("click", onClick);
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick);
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [buildMode]);

  useFrame(() => {
    if (!buildMode || !groupRef.current) return;
    ray.setFromCamera(mouseNDC.current, camera);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, hit)) {
      const [gx, gy, gz] = worldToCell(hit.x, 0, hit.z);
      snappedCell.current = { gx, gy, gz };
      const [wx, , wz] = cellToWorld(gx, gy, gz);
      groupRef.current.position.set(wx, 0, wz);
      groupRef.current.visible = true;
    }
  });

  if (!buildMode) return null;

  const rotRad = (brushRotation * Math.PI) / 180;
  const len = BAY_40FT;
  const halfLen = ((len - 1) * CELL) / 2;

  return (
    <group ref={groupRef} visible={false}>
      <group rotation={[0, rotRad, 0]}>
        {tool === "container" && (
          <>
            {/* Container footprint: 5 cells */}
            <mesh material={ghostMat} position={[halfLen, 0.03, 0]}>
              <boxGeometry args={[len * CELL, 0.06, CELL]} />
            </mesh>
            <mesh material={ghostWire} position={[halfLen, 0.04, 0]}>
              <boxGeometry args={[len * CELL, 0.06, CELL]} />
            </mesh>
            {/* Ghost corner posts at each end */}
            {[
              [0, -CELL / 2], [0, CELL / 2],
              [(len - 1) * CELL, -CELL / 2], [(len - 1) * CELL, CELL / 2],
            ].map(([lx, lz], i) => (
              <mesh key={i} material={ghostMat} position={[lx, WALL_H / 2, lz]}>
                <boxGeometry args={[0.12, WALL_H, 0.12]} />
              </mesh>
            ))}
            {/* Ghost top beams */}
            <mesh material={ghostWire} position={[halfLen, WALL_H, -CELL / 2]}>
              <boxGeometry args={[len * CELL, 0.08, 0.08]} />
            </mesh>
            <mesh material={ghostWire} position={[halfLen, WALL_H, CELL / 2]}>
              <boxGeometry args={[len * CELL, 0.08, 0.08]} />
            </mesh>
          </>
        )}
        {tool === "beam" && (
          <mesh material={ghostMat} position={[0, WALL_H / 2, 0]}>
            <boxGeometry args={[0.12, WALL_H, 0.12]} />
          </mesh>
        )}
        {tool === "panel" && (
          <mesh material={ghostMat} position={[0, WALL_H / 2, 0]}>
            <boxGeometry args={[CELL, WALL_H, 0.04]} />
          </mesh>
        )}
        {tool === "eraser" && (
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.3, 12, 8]} />
            <meshBasicMaterial color="#f44336" transparent opacity={0.3} depthWrite={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function FrameBuilder() {
  const tiles = useFrameStore((s) => s.tiles);
  const style = useFrameStore((s) => s.style);
  const matSet = STYLE_MATS[style];

  return (
    <group>
      {Object.entries(tiles).map(([key, tile]) => (
        <TileMesh key={key} tileKey={key} tile={tile} mats={matSet} />
      ))}
      <GhostCursor />
    </group>
  );
}
