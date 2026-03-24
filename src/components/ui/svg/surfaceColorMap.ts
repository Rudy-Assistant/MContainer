import type { SurfaceType } from '@/types/container';

export const SURFACE_COLOR_MAP: Record<string, string> = {
  Open:               '#e2e8f0',
  Solid_Steel:        '#64748b',
  Glass_Pane:         '#93c5fd',
  Railing_Cable:      '#94a3b8',
  Railing_Glass:      '#7dd3fc',
  Deck_Wood:          '#8B6914',
  Concrete:           '#9ca3af',
  Gull_Wing:          '#78716c',
  Half_Fold:          '#78716c',
  Door:               '#475569',
  Stairs:             '#6b7280',
  Stairs_Down:        '#6b7280',
  Wood_Hinoki:        '#d4a574',
  Floor_Tatami:       '#84a66f',
  Wall_Washi:         '#faf5ef',
  Glass_Shoji:        '#e8e8e8',
  Window_Standard:    '#93c5fd',
  Window_Sill:        '#93c5fd',
  Window_Clerestory:  '#93c5fd',
  Window_Half:        '#93c5fd',
};

const FALLBACK = '#cbd5e1';

export function surfaceColor(type: SurfaceType): string {
  return SURFACE_COLOR_MAP[type] ?? FALLBACK;
}
