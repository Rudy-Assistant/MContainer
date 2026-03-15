'use client';

import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useStore } from '@/store/useStore';
import { CONTAINER_DIMENSIONS } from '@/types/container';
import { getFullFootprint } from '@/store/spatialEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

const BLADE_COUNT       = 80_000;
const BLADE_WIDTH       = 0.04;
const BLADE_HEIGHT_MIN  = 0.08;
const BLADE_HEIGHT_MAX  = 0.18;
const FIELD_RADIUS      = 60;
const CULL_DISTANCE     = 55;
const WIND_SPEED        = 0.4;
const WIND_STRENGTH     = 0.12;

// ─── Blade geometry (single blade: tapered plane with 3 segments) ─────────────

function createBladeGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(BLADE_WIDTH, 1, 1, 3);

  // Taper toward tip
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const taper = 1 - (y + 0.5) * 0.7;
    pos.setX(i, pos.getX(i) * Math.max(taper, 0.05));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ─── Blade shader material ────────────────────────────────────────────────────

function createBladeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime:         { value: 0 },
      uWindSpeed:    { value: WIND_SPEED },
      uWindStrength: { value: WIND_STRENGTH },
      uCullDistance:  { value: CULL_DISTANCE },
      uColorBase:    { value: new THREE.Color('#3a6b22') },
      uColorTip:     { value: new THREE.Color('#6aaa30') },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uWindSpeed;
      uniform float uWindStrength;

      varying float vHeight;
      varying float vDist;

      void main() {
        vec4 worldPos = instanceMatrix * vec4(position, 1.0);

        // Wind — quadratic influence so base stays planted
        vHeight = position.y + 0.5;
        float windInfluence = vHeight * vHeight;
        float windX = sin(uTime * uWindSpeed + worldPos.x * 0.3 + worldPos.z * 0.2) * uWindStrength;
        float windZ = cos(uTime * uWindSpeed * 0.7 + worldPos.z * 0.25) * uWindStrength * 0.6;
        worldPos.x += windX * windInfluence;
        worldPos.z += windZ * windInfluence;

        gl_Position = projectionMatrix * viewMatrix * worldPos;
        vDist = length(cameraPosition - worldPos.xyz);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3  uColorBase;
      uniform vec3  uColorTip;
      uniform float uCullDistance;

      varying float vHeight;
      varying float vDist;

      void main() {
        vec3 color = mix(uColorBase, uColorTip, vHeight);

        // Distance fade
        float fade = 1.0 - smoothstep(uCullDistance * 0.7, uCullDistance, vDist);
        if (fade < 0.01) discard;

        gl_FragColor = vec4(color, fade);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GrassField() {
  const groundPreset = useStore((s) => s.environment.groundPreset);
  const timeOfDay = useStore((s) => s.environment.timeOfDay);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);

  // Performance guard — reduce blades on low-memory devices
  const bladeCount = useMemo(() => {
    if (typeof navigator !== 'undefined') {
      const mem = (navigator as any).deviceMemory;
      if (mem && mem <= 2) return 15_000;
      if (mem && mem <= 4) return 30_000;
    }
    return BLADE_COUNT;
  }, []);

  const { geometry, material } = useMemo(() => {
    const geo = createBladeGeometry();
    const mat = createBladeMaterial();
    return { geometry: geo, material: mat };
  }, []);

  // Place blade instances randomly within FIELD_RADIUS, excluding container footprints
  const containers = useStore((s) => s.containers);
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Build exclusion zones from container positions (including extensions)
    const MARGIN = 1.0; // Extra margin to prevent tall blades from poking through edges
    const exclusions = Object.values(containers).map(c => {
      const foot = getFullFootprint(c as any);
      return {
        minX: foot.minX - MARGIN,
        maxX: foot.maxX + MARGIN,
        minZ: foot.minZ - MARGIN,
        maxZ: foot.maxZ + MARGIN,
      };
    });

    const dummy = new THREE.Object3D();
    let placed = 0;
    let attempts = 0;
    const maxAttempts = bladeCount * 3;

    while (placed < bladeCount && attempts < maxAttempts) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * FIELD_RADIUS;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Skip blades under containers (uses full footprint including extensions)
      const underContainer = exclusions.some(e =>
        x >= e.minX && x <= e.maxX && z >= e.minZ && z <= e.maxZ
      );
      if (underContainer) continue;

      dummy.position.set(x, 0, z);
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.3,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.2,
      );

      const h = BLADE_HEIGHT_MIN + Math.random() * (BLADE_HEIGHT_MAX - BLADE_HEIGHT_MIN);
      dummy.scale.set(1, h, 1);

      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }

    // Zero out any remaining unused instances
    if (placed < bladeCount) {
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      for (let i = placed; i < bladeCount; i++) {
        mesh.setMatrixAt(i, dummy.matrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  }, [bladeCount, containers]);

  // Wind color variation by time of day
  useEffect(() => {
    if (!material.uniforms) return;
    if (timeOfDay >= 17 && timeOfDay <= 20) {
      // Golden hour
      material.uniforms.uColorBase.value.set('#4a6820');
      material.uniforms.uColorTip.value.set('#7ab830');
    } else if (timeOfDay < 7 || timeOfDay > 20) {
      // Night/dawn
      material.uniforms.uColorBase.value.set('#2a4a18');
      material.uniforms.uColorTip.value.set('#3a6020');
    } else {
      // Midday
      material.uniforms.uColorBase.value.set('#3a6b22');
      material.uniforms.uColorTip.value.set('#6aaa30');
    }
  }, [timeOfDay, material]);

  // Animate wind
  useFrame((_, delta) => {
    timeRef.current += delta;
    material.uniforms.uTime.value = timeRef.current;
  });

  // Only render when grass preset is active
  if (groundPreset !== 'grass') return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, bladeCount]}
      castShadow={false}
      receiveShadow={false}
    />
  );
}
