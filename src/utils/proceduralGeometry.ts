// src/utils/proceduralGeometry.ts
// Category-specific procedural placeholder geometries for forms.
// Cached at module scope so geometry is shared across instances.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { FormCategory } from '@/types/sceneObject';

const cache = new Map<string, THREE.BufferGeometry>();

/**
 * Get a procedural placeholder geometry for a form category.
 * Cached so geometry is shared across instances — do NOT dispose externally.
 */
export function getProceduralGeometry(
  formId: string,
  category: FormCategory,
  dims: { w: number; h: number; d: number },
): THREE.BufferGeometry {
  const key = `${formId}:${dims.w}:${dims.h}:${dims.d}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let geo: THREE.BufferGeometry;

  switch (category) {
    case 'door': {
      // Door: box panel (slightly taller than wide is already implied by dims)
      geo = new THREE.BoxGeometry(dims.w, dims.h, dims.d);
      break;
    }
    case 'window': {
      // Window: glass pane with cross mullions
      const pane = new THREE.BoxGeometry(dims.w, dims.h, dims.d * 0.3);
      const hBar = new THREE.BoxGeometry(dims.w, 0.02, dims.d * 0.5);
      const vBar = new THREE.BoxGeometry(0.02, dims.h, dims.d * 0.5);
      const merged = mergeGeometries([pane, hBar, vBar]);
      // Dispose intermediate geometries after merge (their GPU buffers are now in `merged`)
      pane.dispose(); hBar.dispose(); vBar.dispose();
      geo = merged ?? new THREE.BoxGeometry(dims.w, dims.h, dims.d);
      break;
    }
    case 'light': {
      if (dims.h > dims.w * 1.5) {
        // Tall = floor/table lamp: cylinder base + sphere top
        const base = new THREE.CylinderGeometry(dims.w * 0.15, dims.w * 0.2, dims.h * 0.7, 8);
        base.translate(0, -dims.h * 0.15, 0);
        const shade = new THREE.SphereGeometry(dims.w * 0.3, 8, 6);
        shade.translate(0, dims.h * 0.35, 0);
        const lampMerged = mergeGeometries([base, shade]);
        base.dispose(); shade.dispose();
        geo = lampMerged ?? new THREE.BoxGeometry(dims.w, dims.h, dims.d);
      } else {
        // Short = ceiling/wall fixture: cylinder disc
        geo = new THREE.CylinderGeometry(dims.w * 0.4, dims.w * 0.4, dims.h * 0.3, 12);
      }
      break;
    }
    case 'electrical': {
      // Electrical: small flat rectangle (outlet plate)
      geo = new THREE.BoxGeometry(dims.w, dims.h, dims.d * 0.2);
      break;
    }
    default:
      geo = new THREE.BoxGeometry(dims.w, dims.h, dims.d);
  }

  cache.set(key, geo);
  return geo;
}
