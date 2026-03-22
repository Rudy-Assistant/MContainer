import type { SurfaceType } from "@/types/container";

/** Short (3-5 char) labels for compact UI buttons */
export const SURFACE_SHORT_LABELS: Record<string, string> = {
  Open: "Open", Solid_Steel: "Steel", Glass_Pane: "Glass",
  Railing_Glass: "Rail", Railing_Cable: "Cable", Deck_Wood: "Wood",
  Concrete: "Conc", Door: "Door", Window_Standard: "Win",
  Stairs: "Stair", Half_Fold: "½Fold", Gull_Wing: "Gull",
  Window_Sill: "Sill", Window_Clerestory: "Clr", Window_Half: "½Win",
  Stairs_Down: "StDn", Wood_Hinoki: "Hnki", Floor_Tatami: "Tata",
  Wall_Washi: "Washi", Glass_Shoji: "Shoji",
};

export interface QuickMaterial {
  type: SurfaceType;
  label: string;
  color: string;
}

/** Common quick-access materials for UI pickers */
export const QUICK_MATERIALS: QuickMaterial[] = [
  { type: "Solid_Steel",     label: "Steel",   color: "#78909c" },
  { type: "Glass_Pane",      label: "Glass",   color: "#60a5fa" },
  { type: "Window_Standard", label: "Window",  color: "#7dd3fc" },
  { type: "Deck_Wood",       label: "Wood",    color: "#8d6e63" },
  { type: "Railing_Glass",   label: "Railing", color: "#93c5fd" },
  { type: "Open",            label: "Open",    color: "#e2e8f0" },
];

/** Color mapping for each surface type — used by grid cells, face buttons, etc. */
export const SURFACE_COLORS: Record<SurfaceType, string> = {
  Open:           "transparent",
  Solid_Steel:    "#78909c",
  Glass_Pane:     "#60a5fa",
  Railing_Glass:  "#93c5fd",
  Railing_Cable:  "#607d8b",
  Deck_Wood:      "#8d6e63",
  Concrete:       "#9e9e9e",
  Half_Fold:      "#ab47bc",
  Gull_Wing:      "#7e57c2",
  Door:           "#607d8b",
  Stairs:         "#5d4037",
  Stairs_Down:    "#3e2723",
  Wood_Hinoki:    "#f5e6c8",
  Floor_Tatami:   "#c8d5a0",
  Wall_Washi:     "#f8f4ec",
  Glass_Shoji:    "#fafafa",
  Window_Standard: "#7dd3fc",
  Window_Sill:     "#93c5fd",
  Window_Clerestory: "#bfdbfe",
  Window_Half:     "#a5f3fc",
};
