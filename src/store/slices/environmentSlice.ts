/**
 * environmentSlice.ts — Environment, View, Camera, and Theme state
 *
 * Extracted from useStore.ts. All state here is ephemeral or persist-only
 * (never undo-tracked). Consumer selectors unchanged — state merges into StoreState.
 */

import { ViewMode } from '@/types/container';
import { type ThemeId, THEMES, STYLE_TO_THEME_MAP, THEME_TO_STYLE_MAP } from '@/config/themes';
import { type QualityPresetId } from '@/config/qualityPresets';
import type { StyleId } from '@/types/sceneObject';
import type { SliceSet } from './types';

type EnvironmentRuntimeState = EnvironmentSlice & {
  selection: string[];
  hoveredEdge: unknown;
  overlappingEdges: unknown;
};

type Set = SliceSet<EnvironmentRuntimeState>;

export interface EnvironmentSlice {
  // Environment (persisted in `environment` object)
  environment: { timeOfDay: number; northOffset: number; groundPreset: string; siteContextEnabled: boolean; showMEP: boolean };
  setTimeOfDay: (time: number) => void;
  setNorthOffset: (degrees: number) => void;
  setGroundPreset: (preset: string) => void;
  setSiteContextEnabled: (enabled: boolean) => void;
  setShowMEP: (show: boolean) => void;

  // View mode (persisted)
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Theme (persisted via currentTheme)
  currentTheme: ThemeId;
  setTheme: (theme: ThemeId) => void;

  // Style (new unified system — persisted via activeStyle)
  activeStyle: StyleId;
  setActiveStyle: (style: StyleId) => void;

  // Camera orientation (ephemeral)
  cameraAzimuth: number;
  cameraElevation: number;
  setCameraAngles: (azimuth: number, elevation: number) => void;

  // Camera 3D state (ephemeral — survives view mode switches, not persisted)
  savedCamera3D: { position: [number, number, number]; target: [number, number, number] } | null;
  saveCamera3D: (position: [number, number, number], target: [number, number, number]) => void;

  // Camera restore flag (ephemeral)
  cameraRestoring: boolean;
  setCameraRestoring: (v: boolean) => void;

  // Quality preset (persisted)
  qualityPreset: QualityPresetId;
  setQualityPreset: (preset: QualityPresetId) => void;
}

export const createEnvironmentSlice = (set: Set): EnvironmentSlice => ({
  // ── Initial State ──────────────────────────────────────
  environment: { timeOfDay: 15, northOffset: 0, groundPreset: 'grass', siteContextEnabled: false, showMEP: false },
  viewMode: ViewMode.Realistic3D,
  currentTheme: 'industrial' as ThemeId,
  activeStyle: 'industrial' as StyleId,
  cameraAzimuth: Math.PI / 4,
  cameraElevation: Math.PI / 4,
  savedCamera3D: null,
  cameraRestoring: false,
  qualityPreset: 'medium' as QualityPresetId,

  // ── Actions ────────────────────────────────────────────
  setTimeOfDay: (time) =>
    set((s) => ({
      environment: { ...s.environment, timeOfDay: Math.max(0, Math.min(24, time)) },
    })),

  setNorthOffset: (degrees) =>
    set((s) => ({
      environment: { ...s.environment, northOffset: ((degrees % 360) + 360) % 360 },
    })),

  setGroundPreset: (preset) =>
    set((s) => ({
      environment: { ...s.environment, groundPreset: preset },
    })),

  setSiteContextEnabled: (enabled) =>
    set((s) => ({
      environment: { ...s.environment, siteContextEnabled: enabled },
    })),

  setShowMEP: (show) =>
    set((s) => ({ environment: { ...s.environment, showMEP: show } })),

  setViewMode: (mode) => {
    // Veil the camera/scene-graph swap with the soft scene-fade — without
    // it, switching 3D ↔ Blueprint ↔ Walkthrough reads as a jump-cut as
    // mounts/unmounts and camera teleports happen in one frame.
    const setStore = set as unknown as (partial: Record<string, unknown>) => void;
    setStore({ sceneFadeActive: true });
    if (typeof window !== 'undefined') {
      window.setTimeout(() => setStore({ sceneFadeActive: false }), 360);
    }
    if (mode === 'walkthrough') {
      set({
        viewMode: mode,
        selection: [],
        hoveredEdge: null,
        overlappingEdges: null,
      });
    } else {
      set({ viewMode: mode });
    }
  },

  setTheme: (theme) => {
    const themeConfig = THEMES[theme];
    if (!themeConfig) {
      console.warn(`[setTheme] Unknown theme "${theme}" — ignored. Valid: ${Object.keys(THEMES).join(', ')}`);
      return;
    }
    set((s) => ({
      currentTheme: theme,
      activeStyle: THEME_TO_STYLE_MAP[theme] ?? 'industrial',
      environment: { ...s.environment, groundPreset: themeConfig.groundPreset },
    }));
  },

  setActiveStyle: (style) => set((s) => {
    // Sync legacy currentTheme if a mapping exists
    const legacyTheme = STYLE_TO_THEME_MAP[style];
    // Update ground preset to match theme
    const themeId = legacyTheme ?? 'industrial';
    return {
      activeStyle: style,
      ...(legacyTheme ? { currentTheme: legacyTheme } : {}),
      environment: { ...s.environment, groundPreset: THEMES[themeId]?.groundPreset ?? 'grass' },
    };
  }),

  setCameraAngles: (azimuth, elevation) => set({ cameraAzimuth: azimuth, cameraElevation: elevation }),
  saveCamera3D: (position, target) => set({ savedCamera3D: { position, target } }),
  setCameraRestoring: (v) => set({ cameraRestoring: v }),
  setQualityPreset: (preset) => set({ qualityPreset: preset }),
});
