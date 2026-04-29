/**
 * counterTopMaterials.ts (utils) — Cached THREE materials per counter top.
 */

import * as THREE from 'three';
import {
  COUNTER_TOP_MATERIALS,
  type CounterTopMaterialId,
  DEFAULT_COUNTER_TOP,
} from '@/config/counterTopMaterials';

const _cache = new Map<CounterTopMaterialId, THREE.MeshStandardMaterial>();

export function getCounterTopThreeMaterial(id?: CounterTopMaterialId): THREE.MeshStandardMaterial {
  const key = id ?? DEFAULT_COUNTER_TOP;
  let mat = _cache.get(key);
  if (mat) return mat;
  const def = COUNTER_TOP_MATERIALS.find((m) => m.id === key) ?? COUNTER_TOP_MATERIALS[0];
  // Stone: low metalness, low roughness (polished). Wood: low metalness, high roughness.
  // Metal: high metalness, low roughness. Concrete: zero metalness, high roughness.
  const metalness = def.kind === 'metal' ? 0.85 : 0.05;
  const roughness =
    def.kind === 'stone' ? 0.18 :
    def.kind === 'metal' ? 0.4 :
    def.kind === 'wood'  ? 0.65 :
    /* concrete */          0.75;
  mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(def.color),
    metalness,
    roughness,
  });
  _cache.set(key, mat);
  return mat;
}
