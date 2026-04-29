/**
 * themes.ts — Global Theme Engine
 *
 * Each theme provides a complete visual identity:
 *   Industrial (Default): Weathered grey corrugated steel, plywood, clear glass, black frames
 *   Japanese Modern:       Charred Yakisugi wood, Hinoki (light) floor, frosted glass, dark bronze
 *   Desert Modern:         Sand stucco, polished concrete floor, frameless glass, white aluminium
 *   Scandinavian:          Whitewashed pine, light oak floor, large clear glass, soft white frames
 *   Brutalist:              Raw board-formed concrete, dark stained oak, smoked glass, blackened steel
 *   Coastal:                Weathered teak siding, sea-glass turquoise, whitewashed deck, salt-bleached frames
 */

// ── Theme IDs ──────────────────────────────────────────────

export type ThemeId =
  | 'industrial'
  | 'japanese'
  | 'desert'
  | 'scandinavian'
  | 'brutalist'
  | 'coastal'
  | 'ryokan'
  | 'loft'
  | 'midcentury';

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

/** Per-theme texture folder names (under /assets/materials/) */
export interface ThemeTextureSet {
  /** Folder name under /assets/materials/ for exterior wall textures */
  exterior_wall_folder: string;
  /** Folder name under /assets/materials/ for interior wall textures */
  interior_wall_folder: string;
  /** Folder name under /assets/materials/ for floor textures */
  floor_folder: string;
  /** Folder name under /assets/materials/ for ceiling textures */
  ceiling_folder: string;
}

export interface ThemeConfig {
  id: ThemeId;
  label: string;
  materials: ThemeMaterialConfig;
  textures: ThemeTextureSet;
  /** Ground preset applied when this theme is selected */
  groundPreset: 'grass' | 'concrete' | 'gravel' | 'dirt';
}

// ── Theme Definitions ──────────────────────────────────────

export const THEMES: Record<ThemeId, ThemeConfig> = {
  industrial: {
    id: 'industrial',
    label: 'Industrial',
    groundPreset: 'grass',
    materials: {
      steel:      { color: 0x8a9aa8, metalness: 0.50, roughness: 0.55, useCorrugation: true },
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
      exterior_wall_folder: 'Corrugated_Steel',
      interior_wall_folder: 'Concrete',
      floor_folder: 'Deck_Wood',
      ceiling_folder: 'Corrugated_Steel',
    },
  },

  japanese: {
    id: 'japanese',
    label: 'Japanese Modern',
    groundPreset: 'gravel',
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
      exterior_wall_folder: 'Japanese_Cedar',
      interior_wall_folder: 'Shoji_Paper',
      floor_folder: 'Bamboo',
      ceiling_folder: 'Japanese_Cedar',
    },
  },

  desert: {
    id: 'desert',
    label: 'Desert Modern',
    groundPreset: 'dirt',
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
      exterior_wall_folder: 'Stucco',
      interior_wall_folder: 'Plaster',
      floor_folder: 'Terracotta',
      ceiling_folder: 'Bleached_Wood',
    },
  },

  scandinavian: {
    id: 'scandinavian',
    label: 'Scandinavian',
    groundPreset: 'grass',
    materials: {
      // Whitewashed pine vertical board cladding — bright, slightly chalky.
      steel:      { color: 0xeae3d6, metalness: 0.05, roughness: 0.70, useCorrugation: false },
      steelInner: { color: 0xfaf6ee, metalness: 0.0,  roughness: 0.65 },
      // Large clear glass with very low roughness — IKEA showroom feel.
      glass:      { color: 0xf4faff, roughness: 0.04, transmission: 1, ior: 1.5 },
      // Soft white aluminium frames — subtle, almost-flat.
      frame:      { color: 0xd8d4cc, metalness: 0.40, roughness: 0.30 },
      // Pale European oak boards.
      wood:       { color: 0xd9b98a, metalness: 0.0,  roughness: 0.55 },
      woodGroove: { color: 0xb59770 },
      rail:       { color: 0xd8d4cc, metalness: 0.40, roughness: 0.30 },
      railGlass:  { color: 0xeaf4ff, transmission: 0.92, opacity: 0.55 },
      concrete:   { color: 0xc8c4bc, metalness: 0.0,  roughness: 0.80 },
    },
    textures: {
      exterior_wall_folder: 'Whitewashed_Pine',
      interior_wall_folder: 'White_Plaster',
      floor_folder: 'European_Oak',
      ceiling_folder: 'Whitewashed_Pine',
    },
  },

  brutalist: {
    id: 'brutalist',
    label: 'Brutalist',
    groundPreset: 'concrete',
    materials: {
      // Raw board-formed concrete — heavy, unfinished, with vertical board lines.
      steel:      { color: 0x787878, metalness: 0.10, roughness: 0.95, useCorrugation: false },
      steelInner: { color: 0x6a6a6a, metalness: 0.05, roughness: 0.92 },
      // Smoked dark glass — moody, low transmission.
      glass:      { color: 0x2a3038, roughness: 0.08, transmission: 0.55, ior: 1.5, opacity: 0.85 },
      // Blackened structural steel frames.
      frame:      { color: 0x232323, metalness: 0.85, roughness: 0.30 },
      // Dark-stained oak floor.
      wood:       { color: 0x3a2820, metalness: 0.0,  roughness: 0.65 },
      woodGroove: { color: 0x1f1410 },
      rail:       { color: 0x232323, metalness: 0.85, roughness: 0.30 },
      railGlass:  { color: 0x3a3e44, transmission: 0.45, opacity: 0.70 },
      concrete:   { color: 0x707070, metalness: 0.0,  roughness: 0.95 },
    },
    textures: {
      exterior_wall_folder: 'Board_Formed_Concrete',
      interior_wall_folder: 'Polished_Concrete',
      floor_folder: 'Dark_Oak',
      ceiling_folder: 'Polished_Concrete',
    },
  },

  coastal: {
    id: 'coastal',
    label: 'Coastal',
    groundPreset: 'gravel',
    materials: {
      // Salt-bleached weathered teak siding.
      steel:      { color: 0xc8b39a, metalness: 0.02, roughness: 0.78, useCorrugation: false },
      steelInner: { color: 0xefe6da, metalness: 0.0,  roughness: 0.55 },
      // Sea-glass turquoise — subtle tint, high transmission.
      glass:      { color: 0xc8e6e2, roughness: 0.05, transmission: 0.95, ior: 1.5, opacity: 0.85 },
      // Salt-bleached aluminium frames.
      frame:      { color: 0xb8b0a4, metalness: 0.55, roughness: 0.30 },
      // Whitewashed deck plank.
      wood:       { color: 0xeadccc, metalness: 0.0,  roughness: 0.60 },
      woodGroove: { color: 0xc6b39c },
      rail:       { color: 0xb8b0a4, metalness: 0.55, roughness: 0.30 },
      railGlass:  { color: 0xd8efea, transmission: 0.85, opacity: 0.55 },
      concrete:   { color: 0xd4cdbf, metalness: 0.0,  roughness: 0.80 },
    },
    textures: {
      exterior_wall_folder: 'Weathered_Teak',
      interior_wall_folder: 'White_Plaster',
      floor_folder: 'Whitewashed_Deck',
      ceiling_folder: 'Weathered_Teak',
    },
  },

  ryokan: {
    id: 'ryokan',
    label: 'Ryokan',
    groundPreset: 'gravel',
    materials: {
      // Tea-house cypress — even paler than Hinoki, almost ivory.
      steel:      { color: 0xe8d9b5, metalness: 0.02, roughness: 0.65, useCorrugation: false },
      steelInner: { color: 0xf2e6c7, metalness: 0.0, roughness: 0.55 },
      // Translucent washi paper — high diffusion, low transmission.
      glass:      { color: 0xfffbe9, roughness: 0.55, transmission: 0.55, ior: 1.5, opacity: 0.5 },
      // Sumi black lacquer trim.
      frame:      { color: 0x1a1612, metalness: 0.30, roughness: 0.40 },
      // Tatami straw — warm gold-green tone.
      wood:       { color: 0xc9b070, metalness: 0.0, roughness: 0.75 },
      woodGroove: { color: 0x8e7a4a },
      rail:       { color: 0x1a1612, metalness: 0.30, roughness: 0.40 },
      railGlass:  { color: 0xf6efd8, transmission: 0.40, opacity: 0.45 },
      concrete:   { color: 0xa49680, metalness: 0.0, roughness: 0.85 },
    },
    textures: {
      exterior_wall_folder: 'Japanese_Cedar',
      interior_wall_folder: 'Shoji_Paper',
      floor_folder: 'Bamboo',
      ceiling_folder: 'Japanese_Cedar',
    },
  },

  loft: {
    id: 'loft',
    label: 'NYC Loft',
    groundPreset: 'concrete',
    materials: {
      // Exposed weathered red brick — warm, varied.
      steel:      { color: 0x8a4a3a, metalness: 0.05, roughness: 0.85, useCorrugation: false },
      steelInner: { color: 0x9c5a48, metalness: 0.05, roughness: 0.80 },
      // Industrial wire glass — slight green tint.
      glass:      { color: 0xe0eee2, roughness: 0.10, transmission: 0.90, ior: 1.5, opacity: 0.92 },
      // Black structural steel — Chicago-school window mullions.
      frame:      { color: 0x18181a, metalness: 0.95, roughness: 0.20 },
      // Reclaimed oak with deep grain.
      wood:       { color: 0x6c4a2a, metalness: 0.0, roughness: 0.55 },
      woodGroove: { color: 0x3c280f },
      rail:       { color: 0x18181a, metalness: 0.95, roughness: 0.20 },
      railGlass:  { color: 0xe8f0ea, transmission: 0.85, opacity: 0.55 },
      concrete:   { color: 0x8a8580, metalness: 0.0, roughness: 0.78 },
    },
    textures: {
      exterior_wall_folder: 'Corrugated_Steel',
      interior_wall_folder: 'Concrete',
      floor_folder: 'Dark_Oak',
      ceiling_folder: 'Corrugated_Steel',
    },
  },

  midcentury: {
    id: 'midcentury',
    label: 'Mid-Century',
    groundPreset: 'grass',
    materials: {
      // Tongue-and-groove redwood siding — Eichler / Eames warmth.
      steel:      { color: 0xb8743c, metalness: 0.02, roughness: 0.55, useCorrugation: false },
      steelInner: { color: 0xf0e8d8, metalness: 0.0, roughness: 0.55 },
      // Floor-to-ceiling clear glass — California modernism.
      glass:      { color: 0xf0f8ff, roughness: 0.03, transmission: 1, ior: 1.5 },
      // Polished brass mullions + door pulls.
      frame:      { color: 0xb88838, metalness: 0.85, roughness: 0.25 },
      // Walnut hardwood — figured grain.
      wood:       { color: 0x6e3f24, metalness: 0.0, roughness: 0.45 },
      woodGroove: { color: 0x4a2a18 },
      rail:       { color: 0xb88838, metalness: 0.85, roughness: 0.25 },
      railGlass:  { color: 0xf6fbff, transmission: 0.92, opacity: 0.55 },
      concrete:   { color: 0xbab2a4, metalness: 0.0, roughness: 0.75 },
    },
    textures: {
      exterior_wall_folder: 'Whitewashed_Pine',
      interior_wall_folder: 'White_Plaster',
      floor_folder: 'European_Oak',
      ceiling_folder: 'Whitewashed_Pine',
    },
  },
};

export const THEME_IDS: ThemeId[] = [
  'industrial',
  'japanese',
  'desert',
  'scandinavian',
  'brutalist',
  'coastal',
  'ryokan',
  'loft',
  'midcentury',
];

import type { StyleId } from '@/types/sceneObject';

// New themes reuse the closest existing scene-object style for now —
// scene-object styling is a separate axis tracked in src/types/sceneObject.ts.
// Reusing keeps avatar/object reps consistent without forcing new style art.
export const THEME_TO_STYLE_MAP: Record<ThemeId, StyleId> = {
  industrial:    'industrial',
  japanese:      'japanese',
  desert:        'desert_brutalist',
  scandinavian:  'industrial',       // closest neutral light style
  brutalist:     'desert_brutalist', // shares the brutalist visual lineage
  coastal:       'industrial',       // light frames + glass — closest in current style set
  ryokan:        'japanese',         // refined Japanese tea-house variant
  loft:          'industrial',       // brick + steel sibling of industrial
  midcentury:    'industrial',       // warm-wood sibling of industrial
};

export const STYLE_TO_THEME_MAP: Partial<Record<StyleId, ThemeId>> = {
  industrial: 'industrial',
  japanese: 'japanese',
  desert_brutalist: 'desert',
};
