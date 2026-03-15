/**
 * themes.ts — Global Theme Engine
 *
 * Each theme provides a complete visual identity:
 *   Industrial (Default): Weathered grey corrugated steel, plywood, clear glass, black frames
 *   Japanese Modern:       Charred Yakisugi wood, Hinoki (light) floor, frosted glass, dark bronze
 *   Desert Modern:         Sand stucco, polished concrete floor, frameless glass, white aluminium
 */

// ── Theme IDs ──────────────────────────────────────────────

export type ThemeId = 'industrial' | 'japanese' | 'desert';

// ── Material Config per Theme ──────────────────────────────

export interface ThemeMaterialConfig {
  steel:      { color: number; metalness: number; roughness: number; useCorrugation: boolean };
  steelInner: { color: number; metalness: number; roughness: number };
  glass:      { color: number; roughness: number; transmission: number; ior: number; opacity?: number };
  frame:      { color: number; metalness: number; roughness: number };
  wood:       { color: number; metalness: number; roughness: number };
  woodGroove: { color: number };
  rail:       { color: number; metalness: number; roughness: number };
  railGlass:  { color: number; transmission: number; opacity: number };
  concrete:   { color: number; metalness: number; roughness: number };
}

/** Per-theme texture directory paths (contain color.jpg, normal.jpg, roughness.jpg) */
export interface ThemeTextureSet {
  exterior_wall: string | null;  // null = no texture, use flat color
  interior_wall: string | null;
  floor: string | null;
  ceiling: string | null;
  frame: null;                   // Frames always use flat color
}

export interface ThemeConfig {
  id: ThemeId;
  label: string;
  materials: ThemeMaterialConfig;
  textures: ThemeTextureSet;
}

// ── Theme Definitions ──────────────────────────────────────

export const THEMES: Record<ThemeId, ThemeConfig> = {
  industrial: {
    id: 'industrial',
    label: 'Industrial',
    materials: {
      steel:      { color: 0x607080, metalness: 0.72, roughness: 0.38, useCorrugation: true },
      steelInner: { color: 0xb8845a, metalness: 0.05, roughness: 0.78 },
      glass:      { color: 0xe0f2fe, roughness: 0.05, transmission: 1, ior: 1.5 },
      frame:      { color: 0x4a5a6a, metalness: 0.90, roughness: 0.15 },
      wood:       { color: 0x9c6b30, metalness: 0.0, roughness: 0.70 },
      woodGroove: { color: 0x5d4037 },
      rail:       { color: 0x4a5a6a, metalness: 0.90, roughness: 0.20 },
      railGlass:  { color: 0xb3e5fc, transmission: 0.85, opacity: 0.55 },
      concrete:   { color: 0x999999, metalness: 0.0, roughness: 0.85 },
    },
    textures: {
      exterior_wall: '/assets/materials/Corrugated_Steel/',
      interior_wall: '/assets/materials/Concrete/',
      floor: '/assets/materials/Deck_Wood/',
      ceiling: '/assets/materials/Corrugated_Steel/',
      frame: null,
    },
  },

  japanese: {
    id: 'japanese',
    label: 'Japanese Modern',
    materials: {
      // Charred Yakisugi vertical slats — dark, matte, no corrugation
      steel:      { color: 0x8c9090, metalness: 0.55, roughness: 0.50, useCorrugation: false },
      steelInner: { color: 0xd4b896, metalness: 0.0, roughness: 0.60 },
      // Frosted glass — lower transmission, slight roughness
      glass:      { color: 0xf0f4f8, roughness: 0.40, transmission: 0.75, ior: 1.5, opacity: 0.6 },
      // Dark bronze frames
      frame:      { color: 0x707878, metalness: 0.70, roughness: 0.25 },
      // Hinoki (Japanese cypress) — pale, warm, satin finish
      wood:       { color: 0xd4b896, metalness: 0.0, roughness: 0.55 },
      woodGroove: { color: 0xb8956a },
      rail:       { color: 0x707878, metalness: 0.70, roughness: 0.25 },
      railGlass:  { color: 0xe0e8f0, transmission: 0.60, opacity: 0.40 },
      concrete:   { color: 0x888888, metalness: 0.0, roughness: 0.80 },
    },
    textures: {
      exterior_wall: '/assets/materials/Japanese_Cedar/',
      interior_wall: '/assets/materials/Shoji_Paper/',
      floor: '/assets/materials/Bamboo/',
      ceiling: '/assets/materials/Japanese_Cedar/',
      frame: null,
    },
  },

  desert: {
    id: 'desert',
    label: 'Desert Modern',
    materials: {
      // Smooth sand stucco — matte, zero metalness, no corrugation
      steel:      { color: 0xb0a898, metalness: 0.45, roughness: 0.55, useCorrugation: false },
      steelInner: { color: 0xc8b898, metalness: 0.0, roughness: 0.90 },
      // Frameless clear glass
      glass:      { color: 0xf8fcff, roughness: 0.02, transmission: 1, ior: 1.5 },
      // White aluminium details
      frame:      { color: 0x9a9080, metalness: 0.60, roughness: 0.20 },
      // Polished concrete floor — grey, slightly glossy
      wood:       { color: 0xa0a0a0, metalness: 0.05, roughness: 0.25 },
      woodGroove: { color: 0x888888 },
      rail:       { color: 0x9a9080, metalness: 0.60, roughness: 0.20 },
      railGlass:  { color: 0xf0f8ff, transmission: 0.90, opacity: 0.50 },
      concrete:   { color: 0xb0a090, metalness: 0.0, roughness: 0.80 },
    },
    textures: {
      exterior_wall: '/assets/materials/Stucco/',
      interior_wall: '/assets/materials/Plaster/',
      floor: '/assets/materials/Terracotta/',
      ceiling: '/assets/materials/Bleached_Wood/',
      frame: null,
    },
  },
};

export const THEME_IDS: ThemeId[] = ['industrial', 'japanese', 'desert'];
