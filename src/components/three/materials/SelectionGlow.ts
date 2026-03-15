/**
 * FRESNEL GLOW SELECTION SHADER
 *
 * Replaces heavy CSS outlines with a subtle, pulsing edge glow.
 * Uses Fresnel effect (stronger at grazing angles) for professional look.
 */

import * as THREE from 'three';

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 glowColor;
  uniform float glowIntensity;
  uniform float time;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    // Fresnel term (stronger at grazing angles)
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);

    // Pulse animation (1.5s cycle: 2π/1.5 = 4.188 rad/s)
    float pulse = 0.7 + 0.3 * sin(time * 4.188);

    // Combine fresnel with pulse
    float alpha = fresnel * pulse * glowIntensity;

    gl_FragColor = vec4(glowColor, alpha);
  }
`;

export interface SelectionGlowMaterialParams {
  color?: THREE.Color | number;
  intensity?: number;
}

export function createSelectionGlowMaterial(
  params?: SelectionGlowMaterialParams
): THREE.ShaderMaterial {
  const color = params?.color instanceof THREE.Color
    ? params.color
    : new THREE.Color(params?.color ?? 0x1565c0); // --primary

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      glowColor: { value: color },
      glowIntensity: { value: params?.intensity ?? 0.8 },
      time: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide, // Render on backfaces for outer glow
    depthWrite: false,
  });
}

/**
 * Hook for updating the time uniform in animation loop
 */
export function useSelectionGlow(
  material: THREE.ShaderMaterial | null,
  isActive: boolean
) {
  // Time update happens in the component using useFrame
  // This is just a helper type export
}
