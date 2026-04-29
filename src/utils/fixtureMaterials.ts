/**
 * fixtureMaterials.ts — Cached materials for fixtures (appliances + bathroom fixtures).
 *
 * Materials are keyed by paletteHint, not per-fixture, so a kitchen of
 * stainless appliances shares one material instance across many meshes.
 */

import * as THREE from 'three';
import type { FixtureTemplate } from '@/config/fixtureTemplates';

export interface FixtureMaterials {
  body: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  knob: THREE.MeshStandardMaterial;
}

const _cache = new Map<FixtureTemplate['paletteHint'], FixtureMaterials>();

export function getFixtureMaterials(hint: FixtureTemplate['paletteHint']): FixtureMaterials {
  let mats = _cache.get(hint);
  if (mats) return mats;

  let bodyColor: string, trimColor: string;
  let metalness: number, roughness: number;
  switch (hint) {
    case 'stainless':
      bodyColor = '#c0c4c8'; trimColor = '#9aa0a6';
      metalness = 0.85; roughness = 0.32;
      break;
    case 'porcelain':
      bodyColor = '#f8f8f6'; trimColor = '#d6d6d2';
      metalness = 0.05; roughness = 0.18;
      break;
    case 'enamel':
      bodyColor = '#f5f5f3'; trimColor = '#e0e0dc';
      metalness = 0.1; roughness = 0.28;
      break;
    case 'glass':
      bodyColor = '#dde7f0'; trimColor = '#9aa3ad';
      metalness = 0.1; roughness = 0.05;
      break;
    case 'panel_match':
    default:
      // Generic neutral panel — caller may supply a real cabinetry skin
      // material when the fixture is panel-front (e.g. dishwasher hidden
      // behind a kitchen cabinet front). For V1 just use a light grey.
      bodyColor = '#e0e0dc'; trimColor = '#9aa0a6';
      metalness = 0.15; roughness = 0.4;
      break;
  }

  mats = {
    body: new THREE.MeshStandardMaterial({
      color: new THREE.Color(bodyColor),
      metalness,
      roughness,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: new THREE.Color(trimColor),
      metalness: Math.max(0.4, metalness),
      roughness: Math.max(0.18, roughness * 0.6),
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e0eef2'),
      metalness: 0,
      roughness: 0.05,
      transmission: 0.85,
      thickness: 0.02,
      ior: 1.5,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    }),
    knob: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3a3a3a'),
      metalness: 0.65,
      roughness: 0.35,
    }),
  };
  _cache.set(hint, mats);
  return mats;
}
