'use client';

/**
 * Vegetation.tsx — Stylized low-poly vegetation ring around the canvas.
 *
 * Sprint A2 of the industry-comparison roadmap (docs/research/2026-05-19-
 * industry-comparison-brief.md). The single biggest "Lumion gap" identified
 * was content, not renderer — empty ground around containers reads as a
 * blueprint, not a render. A modest ring of stylized trees + grass + dirt
 * patches gives the scene "alive" perception without committing to a
 * photoreal foliage pipeline.
 *
 * Performance:
 * - Trees (4x trunk + 4x canopy) and grass (60x tufts) instanced via drei
 *   `<Instances>` -- one draw call per primitive.
 * - Dirt patches (6x) too few to bother instancing.
 * - Layout is deterministic from a seeded Mulberry32 PRNG so the scene
 *   is stable across reloads and matches between SSR and client.
 *
 * Visual style: low-poly stylized matte colors -- NOT photoreal. Designed
 * to harmonize with the project's existing flat-shaded container aesthetic
 * rather than out-render it.
 */

import { useMemo } from 'react';
import { Instances, Instance } from '@react-three/drei';
import { mulberry32 } from '@/utils/prng';

interface VegetationProps {
  /** Inner radius of the ring (no vegetation closer than this). Default 15m. */
  innerRadius?: number;
  /** Outer radius of the ring. Default 35m. */
  outerRadius?: number;
}

interface Placement {
  position: [number, number, number];
}

function placeInRing(seed: number, count: number, inner: number, outer: number, yOffset = 0): Placement[] {
  const rng = mulberry32(seed);
  const out: Placement[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = inner + rng() * (outer - inner);
    out.push({ position: [Math.cos(angle) * radius, yOffset, Math.sin(angle) * radius] });
  }
  return out;
}

export function Vegetation({ innerRadius = 15, outerRadius = 35 }: VegetationProps) {
  const trees = useMemo(() => placeInRing(42, 4, innerRadius, outerRadius, 0), [innerRadius, outerRadius]);
  const grass = useMemo(() => placeInRing(43, 60, innerRadius, outerRadius, 0.02), [innerRadius, outerRadius]);
  const dirt  = useMemo(() => placeInRing(44, 6, innerRadius, outerRadius, 0.005), [innerRadius, outerRadius]);

  return (
    <group data-testid="vegetation">
      {/* Tree trunks */}
      <Instances limit={4} range={4}>
        <cylinderGeometry args={[0.15, 0.18, 2.5, 8]} />
        <meshStandardMaterial color="#5b4a3a" roughness={0.95} />
        {trees.map((t, i) => (
          <Instance key={`trunk-${i}`} position={[t.position[0], 1.25, t.position[2]]} />
        ))}
      </Instances>

      {/* Tree canopies */}
      <Instances limit={4} range={4}>
        <coneGeometry args={[1.5, 3, 8]} />
        <meshStandardMaterial color="#3a7a4a" roughness={0.85} />
        {trees.map((t, i) => (
          <Instance
            key={`canopy-${i}`}
            position={[t.position[0], 2.5 + 1.5, t.position[2]]}
            castShadow
          />
        ))}
      </Instances>

      {/* Grass tufts */}
      <Instances limit={60} range={60}>
        <boxGeometry args={[0.3, 0.2, 0.05]} />
        <meshStandardMaterial color="#4a8a4a" roughness={0.9} />
        {grass.map((g, i) => (
          <Instance key={`grass-${i}`} position={[g.position[0], 0.1, g.position[2]]} />
        ))}
      </Instances>

      {/* Dirt patches */}
      {dirt.map((d, i) => (
        <mesh key={`dirt-${i}`} position={d.position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[1.5, 16]} />
          <meshStandardMaterial color="#6b5440" roughness={1} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}
