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
  type ContainerSize,
} from '@/types/container';
import { getVoxelLayout } from '@/components/objects/ContainerSkin';
import { nullRaycast } from '@/utils/nullRaycast';
import { getLightIntensity, isSunLow } from '@/config/timeOfDay';
import type { ThemeId } from '@/config/themes';

const LIGHT_COLOR = 0xffe4b5; // Warm white (3000K)
const SPOT_ANGLE = Math.PI / 3; // ~60 degrees
const SPOT_PENUMBRA = 0.5;
const POINT_RANGE = 3; // meters

// ── Geometry & material singletons (never recreated per render) ──
const _ceilingDiscGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.02, 16);
const _poleGeo = new THREE.CylinderGeometry(0.02, 0.05, 0.6, 8);
const _shadeGeo = new THREE.ConeGeometry(0.12, 0.15, 16);
const _housingMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
const _poleMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6, roughness: 0.3 });
const _shadeMat = new THREE.MeshStandardMaterial({ color: 0xffeedd, emissive: LIGHT_COLOR, emissiveIntensity: 0.6 });

// getLightIntensity and isSunLow imported from @/config/timeOfDay
// Re-export for test compatibility
export { getLightIntensity } from '@/config/timeOfDay';

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
      px: number; py: number; pz: number;
      size: ContainerSize;
      lights: { voxelIndex: number; type: 'ceiling' | 'lamp' }[];
    }[] = [];
    for (const [id, c] of Object.entries(s.containers)) {
      if (c.lights && c.lights.length > 0) {
        result.push({
          id,
          px: c.position.x, py: c.position.y, pz: c.position.z,
          size: c.size,
          lights: c.lights,
        });
      }
    }
    return result;
  }));

  const intensity = useMemo(() => getLightIntensity(timeOfDay), [timeOfDay]);

  // Glass emissive boost at low sun angles — only fires when threshold crossed
  const sunLow = isSunLow(timeOfDay);
  useEffect(() => {
    const matSet = _themeMats[currentTheme];
    if (!matSet?.glass) return;
    (matSet.glass as THREE.MeshPhysicalMaterial).emissive.setHex(sunLow ? LIGHT_COLOR : 0x000000);
    (matSet.glass as THREE.MeshPhysicalMaterial).emissiveIntensity = sunLow ? 0.15 : 0;
    matSet.glass.needsUpdate = true;
  }, [sunLow, currentTheme]);

  // Update lamp shade emissive to match time-of-day intensity
  useEffect(() => {
    _shadeMat.emissiveIntensity = intensity * 0.3;
    _shadeMat.needsUpdate = true;
  }, [intensity]);

  // Build light positions from container data
  const maxLights = config.maxLights;
  const lights = useMemo<LightData[]>(() => {
    const result: LightData[] = [];
    outer: for (const c of containersWithLights) {
      const dims = CONTAINER_DIMENSIONS[c.size];
      const vHeight = dims.height;

      for (const light of c.lights) {
        if (result.length >= maxLights) break outer;

        const row = Math.floor(light.voxelIndex / VOXEL_COLS);
        const col = light.voxelIndex % VOXEL_COLS;
        const { px: localX, pz: localZ } = getVoxelLayout(col, row, dims);

        result.push({
          key: `${c.id}-${light.voxelIndex}-${light.type}`,
          position: [
            c.px + localX,
            c.py + (light.type === 'ceiling' ? vHeight - 0.05 : 0.5),
            c.pz + localZ,
          ],
          type: light.type,
        });
      }
    }
    return result;
  }, [containersWithLights, maxLights]);

  if (lights.length === 0) return null;

  return (
    <>
      {lights.map((light) => {
        if (light.type === 'ceiling') {
          return (
            <group key={light.key} position={light.position}>
              <mesh rotation={[Math.PI / 2, 0, 0]} geometry={_ceilingDiscGeo} material={_housingMat} raycast={nullRaycast} />
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

        return (
          <group key={light.key} position={light.position}>
            <mesh position={[0, 0.3, 0]} geometry={_poleGeo} material={_poleMat} raycast={nullRaycast} />
            <mesh position={[0, 0.65, 0]} geometry={_shadeGeo} material={_shadeMat} raycast={nullRaycast} />
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
