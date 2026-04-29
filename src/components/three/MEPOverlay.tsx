"use client";

/**
 * MEPOverlay.tsx — Mechanical / Electrical / Plumbing visualization layer.
 *
 * When `state.environment.showMEP` is true, walks the scene and renders:
 *   • Blue water supply + grey drain pipes from every plumbing fixture
 *     (sinks, toilets, showers, tubs, washer, dishwasher) routed via
 *     Manhattan paths to a per-container wet-wall stack.
 *   • Orange electrical wire runs from every face with `electrical` finish
 *     (outlets, switches) to a per-container service panel.
 *
 * Cosmetic / illustrative — not a BIM-grade routing engine. Scope is
 * "builder + client can see at a glance where the wet wall and panel are."
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';
import {
  CONTAINER_DIMENSIONS,
  type Container,
  VOXEL_COLS,
  VOXEL_ROWS,
} from '@/types/container';

const supplyMat = new THREE.MeshStandardMaterial({ color: '#1f6fdc', metalness: 0.4, roughness: 0.3 });
const drainMat = new THREE.MeshStandardMaterial({ color: '#5a5a5a', metalness: 0.4, roughness: 0.4 });
const wireMat = new THREE.MeshStandardMaterial({ color: '#e08c1c', metalness: 0.2, roughness: 0.5, emissive: '#e08c1c', emissiveIntensity: 0.15 });

const SUPPLY_RADIUS = 0.022;
const DRAIN_RADIUS = 0.04;
const WIRE_RADIUS = 0.012;

interface RouteSegment {
  from: [number, number, number];
  to: [number, number, number];
  kind: 'supply' | 'drain' | 'wire';
}

/** Render a single straight segment as an oriented cylinder. */
function Segment({ from, to, kind }: RouteSegment) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.001) return null;
  const cx = (from[0] + to[0]) / 2;
  const cy = (from[1] + to[1]) / 2;
  const cz = (from[2] + to[2]) / 2;
  // Orient cylinder (default Y axis) along the segment direction
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
  const radius = kind === 'wire' ? WIRE_RADIUS : kind === 'drain' ? DRAIN_RADIUS : SUPPLY_RADIUS;
  const mat = kind === 'wire' ? wireMat : kind === 'drain' ? drainMat : supplyMat;
  return (
    <mesh position={[cx, cy, cz]} quaternion={quat} material={mat} raycast={() => null}>
      <cylinderGeometry args={[radius, radius, len, 8]} />
    </mesh>
  );
}

/** Manhattan-path routing: from → up to ceiling height → across to target XZ → down. */
function routeManhattan(from: [number, number, number], to: [number, number, number]): RouteSegment[] {
  const apexY = Math.max(from[1], to[1]) + 0.05;
  // Step 1: up to apex
  // Step 2: across in X
  // Step 3: across in Z
  // Step 4: down to target
  return [
    { from, to: [from[0], apexY, from[2]], kind: 'supply' },
    { from: [from[0], apexY, from[2]], to: [to[0], apexY, from[2]], kind: 'supply' },
    { from: [to[0], apexY, from[2]], to: [to[0], apexY, to[2]], kind: 'supply' },
    { from: [to[0], apexY, to[2]], to, kind: 'supply' },
  ];
}

interface FixtureSource {
  /** Position in container-local coords */
  x: number;
  y: number;
  z: number;
  needsSupply: boolean;
  needsDrain: boolean;
}

/** Walk a container's voxels, collecting plumbing sources from fixtureConfig. */
function collectPlumbingSources(c: Container): FixtureSource[] {
  if (!c.voxelGrid) return [];
  const dims = CONTAINER_DIMENSIONS[c.size];
  const colP = dims.length / 6;
  const rowP = dims.width / 2;
  const sources: FixtureSource[] = [];
  const PLUMBING_TEMPLATES = new Set([
    'sink_kitchen_double', 'sink_kitchen_single', 'sink_pedestal', 'sink_vessel',
    'toilet_standard', 'toilet_wall_hung',
    'shower_stall', 'bathtub_alcove',
    'washer', 'dishwasher',
  ]);
  for (let i = 0; i < c.voxelGrid.length; i++) {
    const voxel = c.voxelGrid[i];
    if (!voxel?.active) continue;
    const col = i % VOXEL_COLS;
    const row = Math.floor((i % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS);
    const level = Math.floor(i / (VOXEL_ROWS * VOXEL_COLS));
    const vx = -(col - 3.5) * colP;
    const vz = (row - 1.5) * rowP;
    const vy = level * dims.height + 0.4; // 40 cm above voxel floor — typical fixture height
    for (const face of ['n', 's', 'e', 'w'] as const) {
      const fx = voxel.fixtureConfig?.[face];
      if (fx && PLUMBING_TEMPLATES.has(fx.template)) {
        // Push the source position toward the face's wall
        const dx = face === 'e' ? +colP / 3 : face === 'w' ? -colP / 3 : 0;
        const dz = face === 's' ? +rowP / 3 : face === 'n' ? -rowP / 3 : 0;
        sources.push({
          x: vx + dx,
          y: vy,
          z: vz + dz,
          needsSupply: !fx.template.startsWith('toilet_'),
          needsDrain: true,
        });
      }
    }
  }
  return sources;
}

/** Walk a container's voxels, collecting electrical-finish faces. */
function collectElectricalSources(c: Container): { x: number; y: number; z: number }[] {
  if (!c.voxelGrid) return [];
  const dims = CONTAINER_DIMENSIONS[c.size];
  const colP = dims.length / 6;
  const rowP = dims.width / 2;
  const sources: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < c.voxelGrid.length; i++) {
    const voxel = c.voxelGrid[i];
    if (!voxel?.active) continue;
    const col = i % VOXEL_COLS;
    const row = Math.floor((i % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS);
    const level = Math.floor(i / (VOXEL_ROWS * VOXEL_COLS));
    const vx = -(col - 3.5) * colP;
    const vz = (row - 1.5) * rowP;
    const vy = level * dims.height + 0.45;
    for (const face of ['n', 's', 'e', 'w'] as const) {
      const finish = voxel.faceFinishes?.[face];
      if (finish?.electrical && finish.electrical !== 'none') {
        const dx = face === 'e' ? +colP / 3 : face === 'w' ? -colP / 3 : 0;
        const dz = face === 's' ? +rowP / 3 : face === 'n' ? -rowP / 3 : 0;
        sources.push({ x: vx + dx, y: vy, z: vz + dz });
      }
    }
  }
  return sources;
}

function MEPForContainer({ container }: { container: Container }) {
  const dims = CONTAINER_DIMENSIONS[container.size];
  // Wet-wall stack = NE corner of container, full height up
  const stackLocal: [number, number, number] = [-dims.length / 2 + 0.3, 0, dims.width / 2 - 0.3];
  // Service panel = NW corner at ~1.5m
  const panelLocal: [number, number, number] = [+dims.length / 2 - 0.3, 1.5, dims.width / 2 - 0.3];

  const plumbing = useMemo(() => collectPlumbingSources(container), [container]);
  const electrical = useMemo(() => collectElectricalSources(container), [container]);

  const segments: RouteSegment[] = [];

  // Plumbing routes
  for (const src of plumbing) {
    if (src.needsSupply) {
      const path = routeManhattan([src.x, src.y, src.z], stackLocal);
      for (const s of path) segments.push({ ...s, kind: 'supply' });
    }
    if (src.needsDrain) {
      const drainStart: [number, number, number] = [src.x, src.y - 0.3, src.z];
      const path = routeManhattan(drainStart, [stackLocal[0], 0.1, stackLocal[2]]);
      for (const s of path) segments.push({ ...s, kind: 'drain' });
    }
  }
  // Electrical routes
  for (const src of electrical) {
    const path = routeManhattan([src.x, src.y, src.z], panelLocal);
    for (const s of path) segments.push({ ...s, kind: 'wire' });
  }

  // Render the stack + panel as small markers
  const cosR = Math.cos(container.rotation ?? 0);
  const sinR = Math.sin(container.rotation ?? 0);
  const localToWorld = (lx: number, ly: number, lz: number): [number, number, number] => [
    container.position.x + lx * cosR - lz * sinR,
    container.position.y + ly,
    container.position.z + lx * sinR + lz * cosR,
  ];
  return (
    <group>
      {segments.map((seg, i) => (
        <Segment
          key={i}
          from={localToWorld(seg.from[0], seg.from[1], seg.from[2])}
          to={localToWorld(seg.to[0], seg.to[1], seg.to[2])}
          kind={seg.kind}
        />
      ))}
      {/* Wet-wall stack marker */}
      <mesh position={localToWorld(stackLocal[0], dims.height / 2, stackLocal[2])} material={drainMat}>
        <cylinderGeometry args={[0.06, 0.06, dims.height - 0.1, 12]} />
      </mesh>
      {/* Service panel marker */}
      <mesh position={localToWorld(panelLocal[0], panelLocal[1], panelLocal[2])} material={wireMat}>
        <boxGeometry args={[0.3, 0.4, 0.08]} />
      </mesh>
    </group>
  );
}

export default function MEPOverlay() {
  const showMEP = useStore((s) => s.environment.showMEP);
  const containers = useStore((s) => s.containers);
  if (!showMEP) return null;
  return (
    <group>
      {(Object.values(containers) as Container[]).map((c) => (
        <MEPForContainer key={c.id} container={c} />
      ))}
    </group>
  );
}
