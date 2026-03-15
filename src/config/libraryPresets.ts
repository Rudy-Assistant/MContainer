/**
 * libraryPresets.ts — Master library of read-only block presets
 *
 * Grouped by purpose: Spatial (gold), Styles (blue), Structural (grey).
 * Each preset defines a VoxelFaces configuration that can be stamped
 * onto any voxel or dragged to the custom hotbar.
 *
 * Phase 2: "Rooms" section purged (no interior furniture yet).
 * Replaced with structural macro-shapes for spatial building.
 */

import type { VoxelFaces } from "@/types/container";

export interface LibraryPreset {
  id: string;
  label: string;
  faces: VoxelFaces;
  section: "Spatial" | "Styles" | "Structural";
  accent: string;
}

export const LIBRARY_PRESETS: LibraryPreset[] = [
  // ── Spatial Macros (Gold) — Pure structural shapes ───────────
  {
    id: "preset_wraparound_porch",
    label: "Wraparound Porch",
    section: "Spatial",
    accent: "#f59e0b",
    faces: { top: "Open", bottom: "Deck_Wood", n: "Railing_Cable", s: "Railing_Cable", e: "Railing_Cable", w: "Railing_Cable" },
  },
  {
    id: "preset_covered_deck",
    label: "Covered Deck",
    section: "Spatial",
    accent: "#f59e0b",
    faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Railing_Cable", s: "Railing_Cable", e: "Railing_Cable", w: "Railing_Cable" },
  },
  {
    id: "preset_glass_extension",
    label: "Glass Extension",
    section: "Spatial",
    accent: "#f59e0b",
    faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Glass_Pane", s: "Glass_Pane", e: "Glass_Pane", w: "Glass_Pane" },
  },
  {
    id: "preset_solid_extension",
    label: "Solid Extension",
    section: "Spatial",
    accent: "#f59e0b",
    faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Solid_Steel", s: "Solid_Steel", e: "Solid_Steel", w: "Solid_Steel" },
  },

  // ── Styles (Blue) ─────────────────────────────────────────────
  {
    id: "preset_full_glass",
    label: "Full Glass",
    section: "Styles",
    accent: "#3b82f6",
    faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Glass_Pane", s: "Glass_Pane", e: "Glass_Pane", w: "Glass_Pane" },
  },
  {
    id: "preset_hallway",
    label: "Hallway",
    section: "Styles",
    accent: "#3b82f6",
    faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Solid_Steel", s: "Solid_Steel", e: "Open", w: "Open" },
  },
  {
    id: "preset_balcony",
    label: "Balcony",
    section: "Styles",
    accent: "#3b82f6",
    faces: { top: "Open", bottom: "Deck_Wood", n: "Railing_Cable", s: "Railing_Cable", e: "Railing_Cable", w: "Railing_Cable" },
  },
  {
    id: "preset_skylight",
    label: "Skylight",
    section: "Styles",
    accent: "#3b82f6",
    faces: { top: "Glass_Pane", bottom: "Deck_Wood", n: "Solid_Steel", s: "Solid_Steel", e: "Solid_Steel", w: "Solid_Steel" },
  },

  // ── Structural (Grey) ────────────────────────────────────────
  {
    id: "preset_sealed",
    label: "Sealed Box",
    section: "Structural",
    accent: "#6b7280",
    faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Solid_Steel", s: "Solid_Steel", e: "Solid_Steel", w: "Solid_Steel" },
  },
  {
    id: "preset_floor_only",
    label: "Floor Only",
    section: "Structural",
    accent: "#6b7280",
    faces: { top: "Open", bottom: "Deck_Wood", n: "Open", s: "Open", e: "Open", w: "Open" },
  },
  {
    id: "preset_ceiling_only",
    label: "Ceiling Only",
    section: "Structural",
    accent: "#6b7280",
    faces: { top: "Solid_Steel", bottom: "Open", n: "Open", s: "Open", e: "Open", w: "Open" },
  },
  {
    id: "preset_void",
    label: "Void",
    section: "Structural",
    accent: "#6b7280",
    faces: { top: "Open", bottom: "Open", n: "Open", s: "Open", e: "Open", w: "Open" },
  },
];

/** Group presets by section for rendering */
export const PRESET_SECTIONS = ["Spatial", "Styles", "Structural"] as const;
