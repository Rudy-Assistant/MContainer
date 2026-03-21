"use client";

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';
import { QUALITY_PRESETS } from '@/config/qualityPresets';
import { useShallow } from 'zustand/react/shallow';
import { _themeMats } from '@/config/materialCache';
import {
  CONTAINER_DIMENSIONS,
  VOXEL_COLS,
  VOXEL_ROWS,
  type ContainerSize,
} from '@/types/container';
import type { ThemeId } from '@/config/themes';

const LIGHT_COLOR = 0xffe4b5; // Warm white (3000K)
const SPOT_ANGLE = Math.PI / 3; // ~60 degrees
const SPOT_PENUMBRA = 0.5;
const POINT_RANGE = 3; // meters

const nullRaycast = () => {};

/** Pure function — exported for testing */
export function getLightIntensity(timeOfDay: number): number {
  // Daytime: low intensity (ambient daylight dominates)
  if (timeOfDay >= 8 && timeOfDay <= 16) return 0.3;
  // Nighttime: full intensity
  if (timeOfDay >= 18 || timeOfDay <= 5) return 2.0;
  // Dawn transition (5 → 8): intensity ramps down from 2.0 to 0.3
  if (timeOfDay < 8) return 0.3 + (8 - timeOfDay) / 3 * 1.7;
  // Dusk transition (16 → 18): intensity ramps up from 0.3 to 2.0
  return 0.3 + (timeOfDay - 16) / 2 * 1.7;
}

/**
 * Compute voxel center X/Z in container-local space.
 * Matches ContainerSkin getVoxelLayout coordinate system:
 *   col → X = -(col - 3.5) * coreWidth  (negated X axis)
 *   row → Z = (row - 1.5) * coreDepth
 * Halo cols/rows use dims.height as pitch (fold depth).
 */
function voxelLocalXZ(
  col: number, row: number,
  dims: { length: number; width: number; height: number },
): [number, number] {
  const coreWidth = dims.length / 6;
  const coreDepth = dims.width / 2;
  const foldDepth = dims.height;

  let px: number;
  if (col === 0) px = dims.length / 2 + foldDepth / 2;
  else if (col === VOXEL_COLS - 1) px = -(dims.length / 2 + foldDepth / 2);
  else px = -(col - 3.5) * coreWidth;

  let pz: number;
  if (row === 0) pz = -(dims.width / 2 + foldDepth / 2);
  else if (row === VOXEL_ROWS - 1) pz = dims.width / 2 + foldDepth / 2;
  else pz = (row - 1.5) * coreDepth;

  return [px, pz];
}

interface LightData {
  key: string;
  position: [number, number, number];
  type: 'ceiling' | 'lamp';
}

export default function InteriorLights() {
  const qualityPreset = useStore((s) => s.qualityPreset);
  const config = QUALITY_PRESETS[qualityPreset];
  const timeOfDay = useStore((s) => s.environment.timeOfDay);
  const currentTheme = useStore((s) => s.currentTheme) as ThemeId;

  // Collect containers that have lights — useShallow prevents re-renders when unrelated state changes
  const containersWithLights = useStore(useShallow((s) => {
    const result: {
      id: string;
      position: { x: number; y: number; z: number };
      size: ContainerSize;
      lights: { voxelIndex: number; type: 'ceiling' | 'lamp' }[];
      level: number;
    }[] = [];
    for (const [id, c] of Object.entries(s.containers)) {
      if (c.lights && c.lights.length > 0) {
        result.push({
          id,
          position: c.position,
          size: c.size,
          lights: c.lights,
          level: c.level,
        });
      }
    }
    return result;
  }));

  const intensity = useMemo(() => getLightIntensity(timeOfDay), [timeOfDay]);

  // Glass emissive boost at low sun angles
  useEffect(() => {
    const matSet = _themeMats[currentTheme];
    if (!matSet?.glass) return;
    const sunLow = timeOfDay < 7 || timeOfDay > 17;
    (matSet.glass as THREE.MeshPhysicalMaterial).emissive.setHex(sunLow ? 0xffe4b5 : 0x000000);
    (matSet.glass as THREE.MeshPhysicalMaterial).emissiveIntensity = sunLow ? 0.15 : 0;
    matSet.glass.needsUpdate = true;
  }, [timeOfDay, currentTheme]);

  // Build light positions from container data
  const lights = useMemo<LightData[]>(() => {
    const result: LightData[] = [];
    for (const c of containersWithLights) {
      const dims = CONTAINER_DIMENSIONS[c.size];
      const vHeight = dims.height;

      for (const light of c.lights) {
        if (result.length >= config.maxLights) break;

        const row = Math.floor(light.voxelIndex / VOXEL_COLS);
        const col = light.voxelIndex % VOXEL_COLS;

        const [localX, localZ] = voxelLocalXZ(col, row, dims);

        const worldX = c.position.x + localX;
        const worldY = c.position.y + (light.type === 'ceiling' ? vHeight - 0.05 : 0.5);
        const worldZ = c.position.z + localZ;

        result.push({
          key: `${c.id}-${light.voxelIndex}-${light.type}`,
          position: [worldX, worldY, worldZ],
          type: light.type,
        });
      }
    }
    return result;
  }, [containersWithLights, config.maxLights]);

  if (lights.length === 0) return null;

  return (
    <>
      {lights.map((light) => {
        if (light.type === 'ceiling') {
          return (
            <group key={light.key} position={light.position}>
              {/* Visual: recessed disc */}
              <mesh rotation={[Math.PI / 2, 0, 0]} raycast={nullRaycast}>
                <cylinderGeometry args={[0.08, 0.1, 0.02, 16]} />
                <meshStandardMaterial color={0x333333} metalness={0.8} roughness={0.2} />
              </mesh>
              <spotLight
                color={LIGHT_COLOR}
                intensity={intensity}
                angle={SPOT_ANGLE}
                penumbra={SPOT_PENUMBRA}
                castShadow={config.lightShadows}
              />
            </group>
          );
        }

        // Floor lamp
        return (
          <group key={light.key} position={light.position}>
            {/* Pole */}
            <mesh position={[0, 0.3, 0]} raycast={nullRaycast}>
              <cylinderGeometry args={[0.02, 0.05, 0.6, 8]} />
              <meshStandardMaterial color={0x444444} metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Shade */}
            <mesh position={[0, 0.65, 0]} raycast={nullRaycast}>
              <coneGeometry args={[0.12, 0.15, 16]} />
              <meshStandardMaterial
                color={0xffeedd}
                emissive={LIGHT_COLOR}
                emissiveIntensity={intensity * 0.3}
              />
            </mesh>
            <pointLight
              color={LIGHT_COLOR}
              intensity={intensity * 0.6}
              distance={POINT_RANGE}
              position={[0, 0.65, 0]}
            />
          </group>
        );
      })}
    </>
  );
}
