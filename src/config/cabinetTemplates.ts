/**
 * cabinetTemplates.ts — Catalog of cabinet templates.
 *
 * Each template declares a body region + an array of `parts` (doors and/or
 * drawers) with their region-of-interest in normalized coordinates. Renderer
 * uses the parts list to lay out animated swing groups (doors) and slide
 * groups (drawers).
 *
 * Region coordinates are normalized to the body box:
 *   x ∈ [-0.5, +0.5] across width
 *   y ∈ [-0.5, +0.5] across height
 *   w, h ∈ (0, 1] = fraction of body width / height
 *
 * Pure data, no React, no Three.js.
 */

import type { CabinetryAnchor } from '@/types/container';
import type { CabinetrySkinId } from '@/config/cabinetrySkins';

export type CabinetTemplateId =
  | 'wall_2door'
  | 'wall_1door'
  | 'base_2door'
  | 'base_door_drawer'
  | 'base_4drawer'
  | 'tall_pantry'
  | 'dresser_3drawer'
  | 'dresser_6drawer'
  | 'bathroom_vanity'
  | 'glass_display_2door';

/** Hinge edge for a cabinet door part. */
export type DoorHingeEdge = 'left' | 'right';

export interface CabinetPart {
  kind: 'door' | 'drawer';
  /** Normalized region inside the body box. Centered around its (x, y). */
  region: { x: number; y: number; w: number; h: number };
  /** Door-only: which edge hinges. Drawers translate forward regardless. */
  hingeEdge?: DoorHingeEdge;
  /** Optional glaze flag — door part renders as transparent glass instead of
   *  a solid panel (used by glass_display_2door). */
  glazed?: boolean;
}

export interface CabinetTemplate {
  id: CabinetTemplateId;
  label: string;
  hint: string;
  /** Body coverage on the wall face. Normalized fraction (0..1). */
  bodyWidth: number;   // fraction of voxel face width
  bodyHeight: number;  // fraction of voxel face height
  /** Default vertical anchor on the wall face. */
  defaultAnchor: CabinetryAnchor;
  parts: CabinetPart[];
  recommendedSkins: CabinetrySkinId[];
  /** Whether this template can host a counter top slab on its body. True
   *  for base cabinets and vanities; false for wall cabinets, pantries,
   *  glass display, dressers (their tops are the cabinet body's own top). */
  supportsCounterTop?: boolean;
  /** Estimated installed cost in USD (mid-range cabinetry). Mirrored skins
   *  add +30%; counter top adds its own line item. */
  costUSD: number;
}

export const CABINET_TEMPLATES: CabinetTemplate[] = [
  {
    id: 'wall_2door',
    label: 'Wall Cabinet',
    hint: 'Upper kitchen cabinet with two outward-swinging doors.',
    bodyWidth: 0.7,
    bodyHeight: 0.32,
    defaultAnchor: 'top',
    parts: [
      { kind: 'door', region: { x: -0.25, y: 0, w: 0.5, h: 1 }, hingeEdge: 'left' },
      { kind: 'door', region: { x: +0.25, y: 0, w: 0.5, h: 1 }, hingeEdge: 'right' },
    ],
    recommendedSkins: ['shaker_white', 'oak_natural', 'shaker_navy'],
      costUSD: 480,
  },
  {
    id: 'wall_1door',
    label: 'Narrow Wall Cabinet',
    hint: 'Single-door upper cabinet for narrow runs.',
    bodyWidth: 0.35,
    bodyHeight: 0.32,
    defaultAnchor: 'top',
    parts: [
      { kind: 'door', region: { x: 0, y: 0, w: 1, h: 1 }, hingeEdge: 'right' },
    ],
    recommendedSkins: ['shaker_white', 'oak_natural', 'walnut_dark'],
      costUSD: 280,
  },
  {
    id: 'base_2door',
    label: 'Base Cabinet',
    hint: 'Lower kitchen cabinet under the counter.',
    bodyWidth: 0.7,
    bodyHeight: 0.34,
    defaultAnchor: 'bottom',
    parts: [
      { kind: 'door', region: { x: -0.25, y: 0, w: 0.5, h: 1 }, hingeEdge: 'left' },
      { kind: 'door', region: { x: +0.25, y: 0, w: 0.5, h: 1 }, hingeEdge: 'right' },
    ],
    recommendedSkins: ['shaker_white', 'oak_natural', 'walnut_dark'],
    supportsCounterTop: true,
      costUSD: 620,
  },
  {
    id: 'base_door_drawer',
    label: 'Base Drawer + Door',
    hint: 'Top drawer over a single lower door.',
    bodyWidth: 0.5,
    bodyHeight: 0.34,
    defaultAnchor: 'bottom',
    parts: [
      { kind: 'drawer', region: { x: 0, y: +0.38, w: 1, h: 0.22 } },
      { kind: 'door',   region: { x: 0, y: -0.12, w: 1, h: 0.74 }, hingeEdge: 'right' },
    ],
    recommendedSkins: ['shaker_white', 'oak_natural', 'shaker_navy'],
    supportsCounterTop: true,
      costUSD: 540,
  },
  {
    id: 'base_4drawer',
    label: '4-Drawer Base',
    hint: 'Stacked drawers — utility cabinet.',
    bodyWidth: 0.5,
    bodyHeight: 0.34,
    defaultAnchor: 'bottom',
    parts: [
      { kind: 'drawer', region: { x: 0, y: +0.375, w: 1, h: 0.22 } },
      { kind: 'drawer', region: { x: 0, y: +0.125, w: 1, h: 0.22 } },
      { kind: 'drawer', region: { x: 0, y: -0.125, w: 1, h: 0.22 } },
      { kind: 'drawer', region: { x: 0, y: -0.375, w: 1, h: 0.22 } },
    ],
    recommendedSkins: ['shaker_white', 'oak_natural', 'painted_black_modern'],
    supportsCounterTop: true,
      costUSD: 720,
  },
  {
    id: 'tall_pantry',
    label: 'Tall Pantry',
    hint: 'Floor-to-ceiling pantry with two doors.',
    bodyWidth: 0.6,
    bodyHeight: 0.92,
    defaultAnchor: 'mid',
    parts: [
      { kind: 'door', region: { x: -0.25, y: 0, w: 0.5, h: 1 }, hingeEdge: 'left' },
      { kind: 'door', region: { x: +0.25, y: 0, w: 0.5, h: 1 }, hingeEdge: 'right' },
    ],
    recommendedSkins: ['shaker_white', 'oak_natural', 'walnut_dark'],
      costUSD: 1450,
  },
  {
    id: 'dresser_3drawer',
    label: '3-Drawer Dresser',
    hint: 'Bedroom dresser with three full-width drawers.',
    bodyWidth: 0.7,
    bodyHeight: 0.4,
    defaultAnchor: 'bottom',
    parts: [
      { kind: 'drawer', region: { x: 0, y: +0.34, w: 1, h: 0.3 } },
      { kind: 'drawer', region: { x: 0, y: 0,     w: 1, h: 0.3 } },
      { kind: 'drawer', region: { x: 0, y: -0.34, w: 1, h: 0.3 } },
    ],
    recommendedSkins: ['oak_natural', 'walnut_dark', 'hinoki_natural'],
      costUSD: 580,
  },
  {
    id: 'dresser_6drawer',
    label: '6-Drawer Dresser',
    hint: 'Wider dresser — three columns, two rows.',
    bodyWidth: 0.85,
    bodyHeight: 0.4,
    defaultAnchor: 'mid',
    parts: [
      { kind: 'drawer', region: { x: -0.34, y: +0.25, w: 0.32, h: 0.45 } },
      { kind: 'drawer', region: { x: 0,     y: +0.25, w: 0.32, h: 0.45 } },
      { kind: 'drawer', region: { x: +0.34, y: +0.25, w: 0.32, h: 0.45 } },
      { kind: 'drawer', region: { x: -0.34, y: -0.25, w: 0.32, h: 0.45 } },
      { kind: 'drawer', region: { x: 0,     y: -0.25, w: 0.32, h: 0.45 } },
      { kind: 'drawer', region: { x: +0.34, y: -0.25, w: 0.32, h: 0.45 } },
    ],
    recommendedSkins: ['oak_natural', 'shaker_white', 'painted_black_modern'],
      costUSD: 880,
  },
  {
    id: 'bathroom_vanity',
    label: 'Bathroom Vanity',
    hint: 'Below-sink cabinet with two doors.',
    bodyWidth: 0.55,
    bodyHeight: 0.32,
    defaultAnchor: 'bottom',
    parts: [
      { kind: 'door', region: { x: -0.25, y: 0, w: 0.5, h: 1 }, hingeEdge: 'left' },
      { kind: 'door', region: { x: +0.25, y: 0, w: 0.5, h: 1 }, hingeEdge: 'right' },
    ],
    recommendedSkins: ['shaker_white', 'walnut_dark', 'mirror_silver'],
    supportsCounterTop: true,
      costUSD: 540,
  },
  {
    id: 'glass_display_2door',
    label: 'Glass Display',
    hint: 'Full-height display cabinet with two glass-front doors.',
    bodyWidth: 0.55,
    bodyHeight: 0.92,
    defaultAnchor: 'mid',
    parts: [
      { kind: 'door', region: { x: -0.25, y: 0, w: 0.5, h: 1 }, hingeEdge: 'left',  glazed: true },
      { kind: 'door', region: { x: +0.25, y: 0, w: 0.5, h: 1 }, hingeEdge: 'right', glazed: true },
    ],
    recommendedSkins: ['walnut_dark', 'oak_natural', 'painted_black_modern'],
      costUSD: 1200,
  },
];

export const DEFAULT_CABINET_TEMPLATE: CabinetTemplateId = 'wall_2door';

import { byId } from './_byId';
export function getCabinetTemplate(id: CabinetTemplateId): CabinetTemplate {
  return byId(CABINET_TEMPLATES, id);
}
