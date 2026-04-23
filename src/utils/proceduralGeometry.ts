// src/utils/proceduralGeometry.ts
// Category-specific procedural placeholder geometries for forms.
// Cached at module scope so geometry is shared across instances.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { FormCategory } from '@/types/sceneObject';

const cache = new Map<string, THREE.BufferGeometry>();

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(x, y, z);
  return geo;
}

function mergeParts(parts: THREE.BufferGeometry[], fallback: THREE.BufferGeometry): THREE.BufferGeometry {
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!merged) return fallback;
  fallback.dispose();
  return merged;
}

function getDoorGeometry(formId: string, dims: { w: number; h: number; d: number }): THREE.BufferGeometry {
  const rail = Math.max(dims.w * 0.055, 0.035);
  const stile = Math.max(dims.w * 0.045, 0.03);
  const panelDepth = Math.max(dims.d * 0.45, 0.018);
  const frameDepth = Math.max(dims.d, 0.035);
  const parts: THREE.BufferGeometry[] = [
    box(stile, dims.h, frameDepth, -dims.w / 2 + stile / 2),
    box(stile, dims.h, frameDepth, dims.w / 2 - stile / 2),
    box(dims.w, rail, frameDepth, 0, dims.h / 2 - rail / 2),
    box(dims.w, rail, frameDepth, 0, -dims.h / 2 + rail / 2),
  ];

  if (formId.includes('glass') || formId.includes('french')) {
    parts.push(box(dims.w - stile * 2.6, dims.h - rail * 3, panelDepth, 0, rail * 0.2, 0));
    const mullionCount = formId.includes('french') ? 3 : 1;
    for (let i = 1; i <= mullionCount; i++) {
      const x = -dims.w / 2 + (dims.w * i) / (mullionCount + 1);
      parts.push(box(stile * 0.65, dims.h - rail * 2.4, frameDepth, x));
    }
    parts.push(box(dims.w - stile * 2, stile * 0.75, frameDepth, 0, dims.h * 0.08));
  } else if (formId.includes('slide') || formId.includes('shoji')) {
    parts.push(box(dims.w * 0.92, rail * 0.9, frameDepth * 1.25, 0, dims.h / 2 + rail * 0.8));
    parts.push(box(dims.w * 0.92, dims.h - rail * 3, panelDepth, dims.w * 0.08, -rail * 0.1));
    if (formId.includes('shoji')) {
      for (const x of [-0.22, 0, 0.22]) parts.push(box(stile * 0.55, dims.h - rail * 3.5, frameDepth, dims.w * x));
      for (const y of [-0.22, 0.08, 0.38]) parts.push(box(dims.w * 0.82, stile * 0.55, frameDepth, 0, dims.h * y));
    }
  } else if (formId.includes('double') || formId.includes('bifold')) {
    parts.push(box(stile * 0.8, dims.h - rail * 2, frameDepth, 0));
    parts.push(box(dims.w / 2 - stile * 1.6, dims.h - rail * 3, panelDepth, -dims.w * 0.25));
    parts.push(box(dims.w / 2 - stile * 1.6, dims.h - rail * 3, panelDepth, dims.w * 0.25));
  } else {
    parts.push(box(dims.w - stile * 2.4, dims.h - rail * 3, panelDepth, 0, -rail * 0.15));
  }

  parts.push(box(stile * 0.55, rail * 1.4, frameDepth * 1.4, dims.w * 0.32, 0, dims.d * 0.75));
  return mergeParts(parts, new THREE.BoxGeometry(dims.w, dims.h, dims.d));
}

function getElectricalGeometry(formId: string, dims: { w: number; h: number; d: number }): THREE.BufferGeometry {
  const plateDepth = Math.max(dims.d * 0.22, 0.006);
  const detailDepth = Math.max(dims.d * 0.18, 0.006);
  const detailZ = plateDepth / 2 + detailDepth / 2;
  const parts: THREE.BufferGeometry[] = [
    box(dims.w, dims.h, plateDepth),
  ];

  if (formId.includes('usb')) {
    for (const y of [dims.h * 0.21, -dims.h * 0.21]) {
      parts.push(box(dims.w * 0.32, dims.h * 0.13, detailDepth, 0, y, detailZ));
      parts.push(box(dims.w * 0.08, dims.h * 0.035, detailDepth * 1.15, 0, y, detailZ + detailDepth * 0.25));
    }
    parts.push(box(dims.w * 0.44, dims.h * 0.1, detailDepth, 0, 0, detailZ));
    parts.push(box(dims.w * 0.18, dims.h * 0.035, detailDepth * 1.15, 0, 0, detailZ + detailDepth * 0.25));
  } else if (formId.includes('dimmer')) {
    parts.push(box(dims.w * 0.18, dims.h * 0.62, detailDepth, 0, 0, detailZ));
    parts.push(box(dims.w * 0.52, dims.h * 0.12, detailDepth * 1.4, 0, dims.h * 0.16, detailZ + detailDepth * 0.25));
  } else if (formId.includes('switch')) {
    parts.push(box(dims.w * 0.44, dims.h * 0.58, detailDepth, 0, 0, detailZ));
    parts.push(box(dims.w * 0.32, dims.h * 0.16, detailDepth * 1.35, 0, dims.h * 0.1, detailZ + detailDepth * 0.25));
  } else {
    for (const y of [dims.h * 0.22, -dims.h * 0.22]) {
      parts.push(box(dims.w * 0.34, dims.h * 0.17, detailDepth, 0, y, detailZ));
      parts.push(box(dims.w * 0.035, dims.h * 0.075, detailDepth * 1.2, -dims.w * 0.065, y, detailZ + detailDepth * 0.25));
      parts.push(box(dims.w * 0.035, dims.h * 0.075, detailDepth * 1.2, dims.w * 0.065, y, detailZ + detailDepth * 0.25));
      parts.push(box(dims.w * 0.09, dims.h * 0.025, detailDepth * 1.2, 0, y - dims.h * 0.055, detailZ + detailDepth * 0.25));
    }
  }

  return mergeParts(parts, new THREE.BoxGeometry(dims.w, dims.h, dims.d * 0.2));
}

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
      geo = getDoorGeometry(formId, dims);
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
      geo = getElectricalGeometry(formId, dims);
      break;
    }
    default:
      geo = new THREE.BoxGeometry(dims.w, dims.h, dims.d);
  }

  cache.set(key, geo);
  return geo;
}
