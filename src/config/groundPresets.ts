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
  roughness: number;
  repeatX: number;
  repeatY: number;
  normalScale: number;
  envMapIntensity: number;
  displacementScale: number;
}

export const GROUND_PRESETS: Record<GroundPresetId, GroundPreset> = {
  grass: {
    id: "grass",
    label: "Grass",
    folder: "Ground_Grass",
    color: 0x3a6b22,
    roughness: 0.9,
    repeatX: 24,
    repeatY: 24,
    normalScale: 1.5,
    envMapIntensity: 0.15,
    displacementScale: 0.15,
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
