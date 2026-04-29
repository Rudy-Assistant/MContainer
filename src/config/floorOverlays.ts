/**
 * floorOverlays.ts — Floor & ceiling overlay catalog.
 *
 * Floor overlays: rugs, runners, area mats. They sit ON TOP of the existing
 * floor surface (deck wood, tatami, concrete, etc.) — same overlay model
 * as wall shelves/cabinets.
 *
 * Ceiling overlays: ceiling fans, pendant lights, recessed light layouts,
 * exposed beams.
 */

export type FloorOverlayId =
  | 'rug_persian'
  | 'rug_jute'
  | 'rug_wool_grey'
  | 'rug_wool_navy'
  | 'rug_runner'
  | 'rug_kilim'
  | 'rug_sheepskin';

export type CeilingOverlayId =
  | 'fan_modern'
  | 'fan_industrial'
  | 'pendant_single'
  | 'pendant_cluster_3'
  | 'recessed_grid_4'
  | 'recessed_grid_6'
  | 'beam_single'
  | 'beam_run_3';

export interface FloorOverlay {
  id: FloorOverlayId;
  label: string;
  hint: string;
  /** Rug body footprint in voxel-fraction (0..1) — area covered, centered. */
  bodyWidth: number;
  bodyDepth: number;
  /** Primary + accent colors used by the renderer + picker swatch. */
  primaryColor: string;
  accentColor: string;
  /** Cost in USD per voxel-face placement. */
  costUSD: number;
}

export interface CeilingOverlay {
  id: CeilingOverlayId;
  label: string;
  hint: string;
  /** Type drives renderer geometry: fan = central rotating blade, pendant =
   *  hanging fixture, recessed = grid of small disks, beam = horizontal box. */
  kind: 'fan' | 'pendant' | 'recessed' | 'beam';
  /** Visible color of the fixture body (renderer fallback). */
  bodyColor: string;
  /** Whether the fixture is illuminated (drives emissive material). */
  illuminated?: boolean;
  /** Cost in USD per fixture placement. */
  costUSD: number;
}

import { byId } from './_byId';

export const FLOOR_OVERLAYS: FloorOverlay[] = [
  { id: 'rug_persian',    label: 'Persian Rug',     hint: 'Patterned vintage rug — saturated reds + golds.', bodyWidth: 0.85, bodyDepth: 0.85, primaryColor: '#8b2331', accentColor: '#d4a14a', costUSD: 480 },
  { id: 'rug_jute',       label: 'Jute Rug',        hint: 'Natural fiber — neutral and durable.',           bodyWidth: 0.85, bodyDepth: 0.85, primaryColor: '#bfa572', accentColor: '#8a7244', costUSD: 280 },
  { id: 'rug_wool_grey',  label: 'Grey Wool',       hint: 'Solid grey wool — modern minimal.',              bodyWidth: 0.85, bodyDepth: 0.85, primaryColor: '#6c727a', accentColor: '#8a909a', costUSD: 350 },
  { id: 'rug_wool_navy',  label: 'Navy Wool',       hint: 'Deep navy with subtle weave texture.',           bodyWidth: 0.85, bodyDepth: 0.85, primaryColor: '#1f2d3f', accentColor: '#3a4a60', costUSD: 380 },
  { id: 'rug_runner',     label: 'Hallway Runner',  hint: 'Narrow runner — corridors and entries.',         bodyWidth: 0.45, bodyDepth: 0.95, primaryColor: '#6e3a3f', accentColor: '#bfa572', costUSD: 220 },
  { id: 'rug_kilim',      label: 'Kilim',           hint: 'Flat-weave geometric — Turkish / Persian.',      bodyWidth: 0.85, bodyDepth: 0.85, primaryColor: '#a64a2a', accentColor: '#262220', costUSD: 320 },
  { id: 'rug_sheepskin',  label: 'Sheepskin',       hint: 'Soft white shag accent — bedside or chair.',     bodyWidth: 0.4,  bodyDepth: 0.4,  primaryColor: '#f5f0e1', accentColor: '#dcd4c0', costUSD: 180 },
];

export const CEILING_OVERLAYS: CeilingOverlay[] = [
  { id: 'fan_modern',       label: 'Modern Ceiling Fan',  hint: 'Sleek 3-blade ceiling fan with integrated light.',  kind: 'fan',      bodyColor: '#f0f0ec', illuminated: true,  costUSD: 320 },
  { id: 'fan_industrial',   label: 'Industrial Fan',      hint: 'Black metal industrial-style ceiling fan.',         kind: 'fan',      bodyColor: '#1a1a1c', illuminated: true,  costUSD: 380 },
  { id: 'pendant_single',   label: 'Pendant Light',       hint: 'Single hanging pendant — over island or table.',    kind: 'pendant',  bodyColor: '#cba135', illuminated: true,  costUSD: 220 },
  { id: 'pendant_cluster_3',label: 'Pendant Cluster (3)', hint: 'Three pendant lights at staggered heights.',        kind: 'pendant',  bodyColor: '#cba135', illuminated: true,  costUSD: 540 },
  { id: 'recessed_grid_4',  label: 'Recessed × 4',        hint: '4 recessed downlights in a 2×2 grid.',              kind: 'recessed', bodyColor: '#fafaf9', illuminated: true,  costUSD: 280 },
  { id: 'recessed_grid_6',  label: 'Recessed × 6',        hint: '6 recessed downlights in a 3×2 grid.',              kind: 'recessed', bodyColor: '#fafaf9', illuminated: true,  costUSD: 420 },
  { id: 'beam_single',      label: 'Exposed Beam',        hint: 'Single decorative ceiling beam.',                   kind: 'beam',     bodyColor: '#3a2620',                     costUSD: 240 },
  { id: 'beam_run_3',       label: '3-Beam Run',          hint: 'Three parallel beams — open-rafter look.',          kind: 'beam',     bodyColor: '#3a2620',                     costUSD: 620 },
];

export const DEFAULT_FLOOR_OVERLAY: FloorOverlayId = 'rug_wool_grey';
export const DEFAULT_CEILING_OVERLAY: CeilingOverlayId = 'pendant_single';

export function getFloorOverlay(id: FloorOverlayId): FloorOverlay {
  return byId(FLOOR_OVERLAYS, id);
}
export function getCeilingOverlay(id: CeilingOverlayId): CeilingOverlay {
  return byId(CEILING_OVERLAYS, id);
}
