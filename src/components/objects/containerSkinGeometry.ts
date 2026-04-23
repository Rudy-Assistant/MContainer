import * as THREE from "three";
import type { PoleShape, RailShape } from "@/config/frameMaterials";

const boxCache = new Map<string, THREE.BufferGeometry>();
const cylCache = new Map<string, THREE.BufferGeometry>();

export function getBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const safeW = Math.max(w, 0.001);
  const safeH = Math.max(h, 0.001);
  const safeD = Math.max(d, 0.001);
  const k = `${safeW.toFixed(3)}_${safeH.toFixed(3)}_${safeD.toFixed(3)}`;
  if (!boxCache.has(k)) boxCache.set(k, new THREE.BoxGeometry(safeW, safeH, safeD));
  return boxCache.get(k)!;
}

export function getCyl(r: number, h: number): THREE.BufferGeometry {
  const safeR = Math.max(r, 0.001);
  const safeH = Math.max(h, 0.001);
  const k = `${safeR.toFixed(3)}_${safeH.toFixed(3)}`;
  if (!cylCache.has(k)) cylCache.set(k, new THREE.CylinderGeometry(safeR, safeR, safeH, 8));
  return cylCache.get(k)!;
}

export function getPoleGeometry(r: number, h: number, shape: PoleShape): THREE.BufferGeometry {
  switch (shape) {
    case "Square": return getBox(r * 2, h, r * 2);
    case "I-Beam": return getBox(r * 2.5, h, r * 1.2);
    case "H-Beam": return getBox(r * 1.2, h, r * 2.5);
    default: return getCyl(r, h);
  }
}

export function getRailGeometry(r: number, length: number, shape: RailShape): THREE.BufferGeometry {
  switch (shape) {
    case "Square": return getBox(r * 2, length, r * 2);
    case "Channel": return getBox(r * 2.5, length, r * 1.5);
    default: return getCyl(r, length);
  }
}
