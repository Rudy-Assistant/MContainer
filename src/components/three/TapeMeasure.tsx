"use client";

/**
 * TapeMeasure.tsx — Phase 9 Distance Measurement Tool
 *
 * Click twice in the scene to place two measurement points.
 * A line is drawn between them with a distance label in metres.
 * Third click resets and starts a new measurement.
 */

import * as THREE from "three";
import { Text } from "@react-three/drei";
import { useStore } from "@/store/useStore";
import type { ThreeEvent } from "@react-three/fiber";

// ── Module-scope materials ───────────────────────────────────

const dotMat = new THREE.MeshBasicMaterial({
  color: 0xf59e0b, depthWrite: false,
});
const dotGeo = new THREE.SphereGeometry(0.06, 8, 8);

const lineMat = new THREE.LineBasicMaterial({
  color: 0xf59e0b, depthTest: false,
});

const planeMat = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
  colorWrite: false,
});

// ── Component ────────────────────────────────────────────────

export default function TapeMeasure() {
  const tapeActive = useStore((s) => s.tapeActive);
  const tapePoints = useStore((s) => s.tapePoints);
  const addTapePoint = useStore((s) => s.addTapePoint);

  if (!tapeActive) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    addTapePoint({ x: e.point.x, y: e.point.y, z: e.point.z });
  };

  const hasTwoPoints = tapePoints.length >= 2;
  const p0 = tapePoints[0];
  const p1 = tapePoints[1];

  const distance = hasTwoPoints
    ? Math.sqrt(
        (p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2 + (p1.z - p0.z) ** 2
      )
    : 0;

  const linePositions = hasTwoPoints
    ? new Float32Array([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z])
    : null;

  return (
    <group>
      {/* Large invisible click-capture ground plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, 0]}
        material={planeMat}
        onClick={handleClick}
      >
        <planeGeometry args={[200, 200]} />
      </mesh>

      {/* Dots at measurement points */}
      {tapePoints.map((pt, i) => (
        <mesh
          key={i}
          position={[pt.x, pt.y + 0.06, pt.z]}
          geometry={dotGeo}
          material={dotMat}
          renderOrder={999}
        />
      ))}

      {/* Line between two points */}
      {linePositions && (
        <lineSegments renderOrder={999}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[linePositions, 3]}
            />
          </bufferGeometry>
          <primitive object={lineMat} attach="material" />
        </lineSegments>
      )}

      {/* Distance label at midpoint */}
      {hasTwoPoints && (
        <Text
          position={[
            (p0.x + p1.x) / 2,
            Math.max(p0.y, p1.y) + 0.4,
            (p0.z + p1.z) / 2,
          ]}
          fontSize={0.25}
          color="#f59e0b"
          anchorX="center"
          anchorY="bottom"
          renderOrder={1000}
          material-depthTest={false}
        >
          {distance.toFixed(2)}m
        </Text>
      )}
    </group>
  );
}
