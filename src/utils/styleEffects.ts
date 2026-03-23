import * as THREE from 'three';
import type { StyleEffect } from '@/types/sceneObject';

// Module-level color constants to avoid per-call allocations (Fix 6)
const EMBER_COLOR = new THREE.Color('#ff8c00');

/**
 * Apply style effects to a material. Mutates the material in-place.
 * Called once per material creation (not per frame).
 */
export function applyStyleEffects(
  material: THREE.MeshStandardMaterial,
  effects: StyleEffect[],
): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'patina_tint': {
        const tintColor = new THREE.Color(effect.color ?? '#b44a1a');
        material.color.lerp(tintColor, effect.intensity ?? 0.15);
        break;
      }
      case 'paper_glow': {
        material.emissive = new THREE.Color('#fffbe6');
        material.emissiveIntensity = effect.intensity ?? 0.3;
        material.transparent = true;
        material.opacity = 0.85;
        break;
      }
      case 'heat_shimmer': {
        material.emissive = new THREE.Color(effect.color ?? '#ff6b00');
        material.emissiveIntensity = effect.intensity ?? 0.2;
        break;
      }
      case 'reflection_tint': {
        material.envMapIntensity = 1.8;
        break;
      }
      case 'moss_glow': {
        material.emissive = new THREE.Color('#2d5a1e');
        material.emissiveIntensity = effect.intensity ?? 0.15;
        break;
      }
      case 'ember_warmth': {
        // Primary application is to light sources in LightSource component.
        // On materials, apply a warm tint as visual cue.
        material.emissive = new THREE.Color('#ff8c00');
        material.emissiveIntensity = effect.intensity ?? 0.1;
        break;
      }
      case 'gold_gleam': {
        material.roughness *= 0.6;
        material.metalness = Math.min(1, material.metalness * 1.2);
        break;
      }
      case 'frost_rim': {
        material.emissive = new THREE.Color(effect.color ?? '#a8d8ff');
        material.emissiveIntensity = effect.intensity ?? 0.1;
        break;
      }
      case 'clay_warmth': {
        material.color.lerp(new THREE.Color('#c4713b'), effect.intensity ?? 0.1);
        material.roughness = Math.min(1, material.roughness + 0.1);
        break;
      }
      case 'color_punch': {
        // Boost saturation via HSL shift
        const hsl = { h: 0, s: 0, l: 0 };
        material.color.getHSL(hsl);
        material.color.setHSL(
          hsl.h,
          Math.min(1, hsl.s + (effect.intensity ?? 0.15)),
          hsl.l,
        );
        break;
      }
      case 'matte_absorb': {
        material.envMapIntensity = 0.05;
        material.roughness = 0.95;
        break;
      }
      case 'layer_lines': {
        // Normal map with striations deferred — approximate with roughness bump
        material.roughness = Math.min(1, material.roughness + 0.15);
        break;
      }
      // Screen-space / scene-level effects — handled by PostProcessingStack
      // and DappleGobo components, not material-time mutations:
      // salt_frost  — HueSaturation desaturation + BrightnessContrast + Outline (layer 11)
      // soft_bloom  — Bloom luminanceThreshold lowered to 0.5
      // dappled_light — procedural gobo plane casting leaf-shaped shadows
      // edge_glow   — Outline with style color (layer 12)
      case 'salt_frost':
      case 'soft_bloom':
      case 'dappled_light':
      case 'edge_glow':
        break;
    }
  }
}

/**
 * Apply ember_warmth effect to a light's color and distance.
 * Returns adjusted { color, distance } or null if no ember_warmth effect found.
 */
export function applyEmberWarmth(
  effects: StyleEffect[],
  baseColor: THREE.Color,
  baseDistance: number,
): { color: THREE.Color; distance: number } | null {
  const ember = effects.find((e) => e.type === 'ember_warmth');
  if (!ember) return null;
  const warmColor = baseColor.clone().lerp(EMBER_COLOR, ember.intensity ?? 0.3);
  return { color: warmColor, distance: baseDistance * 1.3 };
}
