'use client';

/**
 * categoryIcons.tsx — Visual layer for surface category cards.
 *
 * surfaceCategories.ts is plain data (no JSX), so this file keeps the
 * Lucide / custom-SVG icons out of that config and centralises them here.
 * CategoryRow looks up by category id; if none is found, it falls back to
 * the emoji string in the data config (legacy behaviour).
 */

import type { ReactNode } from 'react';
import {
  Square,
  Sun,
  CircleSlash,
  DoorOpen,
  RectangleHorizontal,
  Trees,
  Hammer,
  Layers,
  ScrollText,
  Wind,
  Bird,
  ChevronRight,
} from 'lucide-react';

const ICON_PROPS = { size: 28, strokeWidth: 1.6 } as const;

/** Map category id → React node. Top-level Type-tab categories
 *  (`solid` / `skylight` / `open` for ceiling, etc.) live here. */
export const CATEGORY_ICONS: Record<string, ReactNode> = {
  // Ceiling tab
  solid: <Square {...ICON_PROPS} fill="currentColor" />,
  skylight: <Sun {...ICON_PROPS} />,
  open: <CircleSlash {...ICON_PROPS} />,

  // Wall tab
  wall: <RectangleHorizontal {...ICON_PROPS} />,
  door: <DoorOpen {...ICON_PROPS} />,
  window: <Square {...ICON_PROPS} />,

  // Floor tab
  floor: <Layers {...ICON_PROPS} />,

  // Variants — used in nested variant grid
  steel: <Square {...ICON_PROPS} fill="currentColor" />,
  wood: <Trees {...ICON_PROPS} />,
  concrete: <Hammer {...ICON_PROPS} />,
  washi: <ScrollText {...ICON_PROPS} />,
  shoji: <Square {...ICON_PROPS} strokeWidth={1.2} fillOpacity={0.15} />,
  glass: <Square {...ICON_PROPS} strokeWidth={1.2} fillOpacity={0.05} />,
  half_fold: <ChevronRight {...ICON_PROPS} />,
  gull_wing: <Bird {...ICON_PROPS} />,
  standard: <Square {...ICON_PROPS} />,
  half: <RectangleHorizontal {...ICON_PROPS} />,
  sill: <RectangleHorizontal {...ICON_PROPS} />,
  clerestory: <Wind {...ICON_PROPS} />,
};

/** Look up a Lucide / SVG icon for a category id. Returns null if no match
 *  — caller should fall back to its data-driven emoji string. */
export function getCategoryIcon(id: string): ReactNode | null {
  return CATEGORY_ICONS[id] ?? null;
}
