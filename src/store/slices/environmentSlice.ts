/**
 * environmentSlice.ts — Environment, View, Camera, and Theme state
 *
 * Extracted from useStore.ts. All state here is ephemeral or persist-only
 * (never undo-tracked). Consumer selectors unchanged — state merges into StoreState.
 */

import { ViewMode } from '@/types/container';
import type { ThemeId } from '@/config/themes';

// Use a lazy StoreState reference to avoid circular imports.
// The slice function receives set/get typed to the full store.
type Set = (partial: Record<string, unknown> | ((s: any) => Record<string, unknown>)) => void;
type Get = () => any;

export interface EnvironmentSlice {
  // Environment (persisted in `environment` object)
  environment: { timeOfDay: number; northOffset: number; groundPreset: string };
  setTimeOfDay: (time: number) => void;
  setNorthOffset: (degrees: number) => void;
  setGroundPreset: (preset: string) => void;

  // View mode (persisted)
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Theme (persisted via currentTheme)
  currentTheme: ThemeId;
  setTheme: (theme: ThemeId) => void;

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
}

export const createEnvironmentSlice = (set: Set, get: Get): EnvironmentSlice => ({
  // ── Initial State ──────────────────────────────────────
  environment: { timeOfDay: 15, northOffset: 0, groundPreset: 'grass' },
  viewMode: ViewMode.Realistic3D,
  currentTheme: 'industrial' as ThemeId,
  cameraAzimuth: Math.PI / 4,
  cameraElevation: Math.PI / 4,
  savedCamera3D: null,
  cameraRestoring: false,

  // ── Actions ────────────────────────────────────────────
  setTimeOfDay: (time) =>
    set((s: any) => ({
      environment: { ...s.environment, timeOfDay: Math.max(0, Math.min(24, time)) },
    })),

  setNorthOffset: (degrees) =>
    set((s: any) => ({
      environment: { ...s.environment, northOffset: ((degrees % 360) + 360) % 360 },
    })),

  setGroundPreset: (preset) =>
    set((s: any) => ({
      environment: { ...s.environment, groundPreset: preset },
    })),

  setViewMode: (mode) => {
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

  setTheme: (theme) => set({ currentTheme: theme }),

  setCameraAngles: (azimuth, elevation) => set({ cameraAzimuth: azimuth, cameraElevation: elevation }),
  saveCamera3D: (position, target) => set({ savedCamera3D: { position, target } }),
  setCameraRestoring: (v) => set({ cameraRestoring: v }),
});
