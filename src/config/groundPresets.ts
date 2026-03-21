/**
 * groundPresets.ts — Ground Surface Presets
 *
 * Defines ground material presets with PBR parameters.
 * Each preset maps to a texture folder under public/assets/materials/.
 */

export type GroundPresetId = "grass" | "concrete" | "gravel" | "dirt";

export interface GroundPreset {
  id: GroundPresetId;
  label: string;
  /** Folder name under public/assets/materials/ */
  folder: string;
  /** Fallback solid color (hex) when textures unavailable */
  color: number;
  /** Optional tint multiplied with texture (default: 0xffffff = no tint) */
  tint?: number;
  roughness: number;
  repeatX: number;
  repeatY: number;
  normalScale: number;
  envMapIntensity: number;
  displacementScale: number;
  /** Optional real displacement texture filename (in folder) — overrides procedural */
  displacementFile?: string;
  /** Optional AO texture filename (in folder) */
  aoFile?: string;
  /** Override color texture filename (default: "color.jpg") */
  colorFile?: string;
  /** Override normal texture filename (default: "normal.jpg") */
  normalFile?: string;
  /** Override roughness texture filename (default: "roughness.jpg") */
  roughnessFile?: string;
}

export const GROUND_PRESETS: Record<GroundPresetId, GroundPreset> = {
  grass: {
    id: "grass",
    label: "Grass",
    folder: "Ground_Grass",
    color: 0x2d7a1e,            // Vivid green fallback (golf course tone)
    tint: 0x77dd77,             // Bright natural green tint — lush lawn
    roughness: 0.95,            // Very rough — grass is matte, not reflective
    repeatX: 80,                // Higher repeat = smaller grass blades = less visible tiling
    repeatY: 80,
    normalScale: 0.25,          // Subtle blade detail — real displacement handles depth
    envMapIntensity: 0.05,      // Minimal reflection — grass doesn't shine
    displacementScale: 0.015,   // Very gentle — real displacement texture has proper grass detail
    displacementFile: "Grass005_1K-JPG_Displacement.jpg",
    aoFile: "Grass005_1K-JPG_AmbientOcclusion.jpg",
    colorFile: "Grass005_1K-JPG_Color.jpg",
    normalFile: "Grass005_1K-JPG_NormalGL.jpg",
    roughnessFile: "Grass005_1K-JPG_Roughness.jpg",
  },
  concrete: {
    id: "concrete",
    label: "Concrete",
    folder: "Ground_Concrete",
    color: 0x8a8a88,
    roughness: 0.85,
    repeatX: 8,
    repeatY: 8,
    normalScale: 0.5,
    envMapIntensity: 0.4,
    displacementScale: 0.0,
  },
  gravel: {
    id: "gravel",
    label: "Gravel",
    folder: "Ground_Gravel",
    color: 0x7a7568,
    roughness: 0.92,
    repeatX: 10,
    repeatY: 10,
    normalScale: 0.6,
    envMapIntensity: 0.3,
    displacementScale: 0.05,
  },
  dirt: {
    id: "dirt",
    label: "Dirt",
    folder: "Ground_Dirt",
    color: 0x6b5b3e,
    roughness: 0.96,
    repeatX: 10,
    repeatY: 10,
    normalScale: 0.4,
    envMapIntensity: 0.3,
    displacementScale: 0.15,
  },
};

export const GROUND_PRESET_IDS: GroundPresetId[] = ["grass", "concrete", "gravel", "dirt"];
export const DEFAULT_GROUND_PRESET: GroundPresetId = "grass";
