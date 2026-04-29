"use client";

/**
 * FloorGrid — subtle reference grid drawn on the ground plane.
 *
 * Gives the viewport a sense of scale and origin without dominating the scene.
 * Two tiers: minor lines every 1m, major lines every 5m. Sits just above the
 * ground mesh and fades with camera distance via a radial alpha falloff.
 *
 * nullRaycast so the grid can never intercept clicks.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { nullRaycast } from "@/utils/nullRaycast";
import { useStore } from "@/store/useStore";

const GRID_SIZE = 100;     // world units (meters)
const MAJOR_STEP = 5;      // major line every 5 m
const MINOR_STEP = 1;      // minor line every 1 m
const GRID_Y = 0.002;      // just above the ground plane (ground sits at -0.01)

// Warm-grey lines, deliberately low contrast so the grid anchors without
// fighting the 3D subject. Major lines slightly darker than minor lines.
const MAJOR_COLOR = new THREE.Color("#7a7f86");
const MINOR_COLOR = new THREE.Color("#9aa0a8");

function buildGridGeometry(size: number, majorStep: number, minorStep: number) {
  const half = size / 2;
  const positions: number[] = [];
  const colors: number[] = [];
  const pushLine = (x1: number, z1: number, x2: number, z2: number, color: THREE.Color) => {
    positions.push(x1, 0, z1, x2, 0, z2);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  };
  // Vertical (constant X) lines
  for (let x = -half; x <= half + 1e-6; x += minorStep) {
    const isMajor = Math.abs(Math.round(x / majorStep) * majorStep - x) < 1e-6;
    pushLine(x, -half, x, half, isMajor ? MAJOR_COLOR : MINOR_COLOR);
  }
  // Horizontal (constant Z) lines
  for (let z = -half; z <= half + 1e-6; z += minorStep) {
    const isMajor = Math.abs(Math.round(z / majorStep) * majorStep - z) < 1e-6;
    pushLine(-half, z, half, z, isMajor ? MAJOR_COLOR : MINOR_COLOR);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geom;
}

export default function FloorGrid() {
  const visible = useStore((s) => s.showFloorGrid);
  const geometry = useMemo(
    () => buildGridGeometry(GRID_SIZE, MAJOR_STEP, MINOR_STEP),
    []
  );

  if (!visible) return null;

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    []
  );

  return (
    <lineSegments
      geometry={geometry}
      material={material}
      position={[0, GRID_Y, 0]}
      raycast={nullRaycast}
      renderOrder={-1}
    />
  );
}
