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
}

export const GROUND_PRESETS: Record<GroundPresetId, GroundPreset> = {
  grass: {
    id: "grass",
    label: "Grass",
    folder: "Ground_Grass",
    color: 0x2d7a1e,            // Vivid green fallback (golf course tone)
    tint: 0x88cc88,             // Light green tint — shifts texture toward lush lawn
    roughness: 0.92,
    repeatX: 40,                // Finer tiling — less visible repeat
    repeatY: 40,
    normalScale: 0.6,           // Subtle blade detail (was 1.5 — too harsh)
    envMapIntensity: 0.25,      // Slight sheen from sunlight
    displacementScale: 0.03,    // Nearly flat (was 0.15 — created bumpy terrain)
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
