"use client";

/**
 * SiteFeatures.tsx — Outdoor site context above the ground plane.
 *
 * Renders driveway, walkway, trees, and plant beds around the placed
 * containers. All deterministic — tree positions are seeded off container
 * IDs so a saved design always looks the same.
 *
 * Cosmetic layer; doesn't affect rooms, walkthrough collision, or cost.
 *
 * Toggleable via `state.environment.siteContextEnabled` — off by default
 * so existing designs render unchanged unless the user opts in.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';
import { CONTAINER_DIMENSIONS, type Container } from '@/types/container';

// ── Materials (module-scope cache, one set for the whole scene) ──

const drivewayMat = new THREE.MeshStandardMaterial({
  color: '#5e6062',
  metalness: 0.0,
  roughness: 0.85,
});
const walkwayMat = new THREE.MeshStandardMaterial({
  color: '#8a8a88',
  metalness: 0.0,
  roughness: 0.78,
});
const mulchMat = new THREE.MeshStandardMaterial({
  color: '#3a2a1c',
  metalness: 0.0,
  roughness: 0.95,
});
const trunkMat = new THREE.MeshStandardMaterial({
  color: '#3a2620',
  metalness: 0.0,
  roughness: 0.9,
});
const foliageDarkMat = new THREE.MeshStandardMaterial({
  color: '#2c5a2a',
  metalness: 0.0,
  roughness: 0.9,
});
const foliageLightMat = new THREE.MeshStandardMaterial({
  color: '#4a7a3a',
  metalness: 0.0,
  roughness: 0.9,
});

// ── Helpers ──

/** Mulberry32 PRNG — small, deterministic, 32-bit seed.
 *  Used so tree positions are stable for a given container set. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a container id string into a 32-bit integer for the PRNG seed. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── Trees (low-poly: trunk cylinder + 1-2 foliage cones) ──

const treeTrunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.6, 8);
const treeFoliageGeoLarge = new THREE.ConeGeometry(1.0, 2.4, 12);
const treeFoliageGeoSmall = new THREE.ConeGeometry(0.7, 1.8, 12);

interface TreeInstance {
  x: number;
  z: number;
  scale: number;
  rotationY: number;
  variant: 'large' | 'small';
}

function generateTrees(containers: Container[]): TreeInstance[] {
  if (containers.length === 0) return [];
  // Seed off the sorted concatenation of container IDs for determinism
  const seedKey = containers.map((c) => c.id).sort().join('|');
  const rand = mulberry32(hashId(seedKey));
  const trees: TreeInstance[] = [];
  // Place ~10 trees in a ring 8-15 m from the centroid
  const cx = containers.reduce((s, c) => s + c.position.x, 0) / containers.length;
  const cz = containers.reduce((s, c) => s + c.position.z, 0) / containers.length;
  // Compute a "no-fly zone" radius from the container envelope
  let maxRadius = 0;
  for (const c of containers) {
    const dims = CONTAINER_DIMENSIONS[c.size];
    const dx = c.position.x - cx;
    const dz = c.position.z - cz;
    const cornerR = Math.hypot(dx + dims.length / 2, dz + dims.width / 2);
    maxRadius = Math.max(maxRadius, cornerR);
  }
  const ringInner = maxRadius + 4;
  const ringOuter = maxRadius + 14;
  const treeCount = 10;
  for (let i = 0; i < treeCount; i++) {
    const angle = (i / treeCount) * Math.PI * 2 + rand() * 0.6;
    const r = ringInner + rand() * (ringOuter - ringInner);
    trees.push({
      x: cx + Math.cos(angle) * r,
      z: cz + Math.sin(angle) * r,
      scale: 0.85 + rand() * 0.6,
      rotationY: rand() * Math.PI * 2,
      variant: rand() > 0.4 ? 'large' : 'small',
    });
  }
  return trees;
}

function Tree({ tree }: { tree: TreeInstance }) {
  const foliageGeo = tree.variant === 'large' ? treeFoliageGeoLarge : treeFoliageGeoSmall;
  const foliageMat = tree.variant === 'large' ? foliageDarkMat : foliageLightMat;
  const trunkH = 1.6 * tree.scale;
  const foliageH = (tree.variant === 'large' ? 2.4 : 1.8) * tree.scale;
  return (
    <group position={[tree.x, 0, tree.z]} rotation={[0, tree.rotationY, 0]} scale={tree.scale}>
      <mesh position={[0, trunkH / 2, 0]} geometry={treeTrunkGeo} material={trunkMat} castShadow receiveShadow />
      <mesh position={[0, trunkH + foliageH / 2 - 0.2, 0]} geometry={foliageGeo} material={foliageMat} castShadow receiveShadow />
      {/* Second smaller foliage layer for layered look */}
      <mesh
        position={[0, trunkH + foliageH * 0.85 - 0.2, 0]}
        geometry={treeFoliageGeoSmall}
        material={foliageMat}
        scale={0.75}
        castShadow receiveShadow
      />
    </group>
  );
}

// ── Driveway + walkway ──

interface SiteSurfacesProps {
  centroidX: number;
  centroidZ: number;
  envelopeMaxR: number;
  rotation: number;
}

function SiteSurfaces({ centroidX, centroidZ, envelopeMaxR, rotation }: SiteSurfacesProps) {
  // Driveway: 6m long × 3m wide rectangle approaching from the south,
  // ending ~2m from the container envelope.
  const drivewayLen = 8;
  const drivewayW = 3;
  const drivewayDistance = envelopeMaxR + drivewayLen / 2 + 1.5;
  // Walkway: 1.2m wide concrete strip from driveway end to envelope edge
  const walkwayLen = drivewayDistance - drivewayLen / 2 - envelopeMaxR + 0.2;
  const walkwayW = 1.2;
  const walkwayDistance = envelopeMaxR + walkwayLen / 2;

  // Plant bed: thin strip of mulch flanking the walkway on one side
  const bedLen = walkwayLen;
  const bedW = 0.6;

  // Apply container's master rotation so site features follow orientation.
  return (
    <group position={[centroidX, 0.005, centroidZ]} rotation={[0, rotation, 0]}>
      {/* Driveway */}
      <mesh
        position={[0, 0, drivewayDistance]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={drivewayMat}
        receiveShadow
      >
        <planeGeometry args={[drivewayW, drivewayLen]} />
      </mesh>
      {/* Walkway */}
      <mesh
        position={[0, 0.012, walkwayDistance]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={walkwayMat}
        receiveShadow
      >
        <planeGeometry args={[walkwayW, walkwayLen]} />
      </mesh>
      {/* Plant bed flanking walkway (east side) */}
      <mesh
        position={[walkwayW / 2 + bedW / 2 + 0.05, 0.014, walkwayDistance]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={mulchMat}
        receiveShadow
      >
        <planeGeometry args={[bedW, bedLen]} />
      </mesh>
    </group>
  );
}

// ── Top-level component ──

export default function SiteFeatures() {
  const enabled = useStore((s) => s.environment.siteContextEnabled);
  const containers = useStore((s) => s.containers);

  const containerList = useMemo(() => Object.values(containers) as Container[], [containers]);

  const trees = useMemo(() => (enabled ? generateTrees(containerList) : []), [enabled, containerList]);

  const siteAnchor = useMemo(() => {
    if (containerList.length === 0) return null;
    const cx = containerList.reduce((s, c) => s + c.position.x, 0) / containerList.length;
    const cz = containerList.reduce((s, c) => s + c.position.z, 0) / containerList.length;
    let maxR = 0;
    for (const c of containerList) {
      const dims = CONTAINER_DIMENSIONS[c.size];
      const r = Math.hypot(c.position.x - cx + dims.length / 2, c.position.z - cz + dims.width / 2);
      maxR = Math.max(maxR, r);
    }
    return { cx, cz, maxR, rotation: containerList[0]?.rotation ?? 0 };
  }, [containerList]);

  if (!enabled || !siteAnchor) return null;

  return (
    <group>
      <SiteSurfaces
        centroidX={siteAnchor.cx}
        centroidZ={siteAnchor.cz}
        envelopeMaxR={siteAnchor.maxR}
        rotation={siteAnchor.rotation}
      />
      {trees.map((t, i) => <Tree key={`tree_${i}`} tree={t} />)}
    </group>
  );
}
