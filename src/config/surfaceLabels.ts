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
