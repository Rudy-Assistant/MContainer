// src/config/blockPresets.ts
import type { VoxelFaces } from '@/types/container';
import {
  X, Footprints, ArrowUpFromDot, Layers,
  Fence, AppWindow, ChevronsUpDown, Origami,
} from 'lucide-react';

export type BlockPresetId = 'void' | 'floor' | 'ceiling' | 'floor_ceil' | 'railing' | 'window' | 'half_fold' | 'gull_wing';

export interface BlockPreset {
  id: BlockPresetId;
  label: string;
  icon: typeof X;
  faces: VoxelFaces;
  active: boolean;
  accent: string;
}

export const BLOCK_PRESETS: BlockPreset[] = [
  { id: 'void', label: 'Void', icon: X, active: false, accent: '#94a3b8',
    faces: { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' } },
  { id: 'floor', label: 'Floor', icon: Footprints, active: true, accent: '#94a3b8',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Open', s: 'Open', e: 'Open', w: 'Open' } },
  { id: 'ceiling', label: 'Ceiling', icon: ArrowUpFromDot, active: true, accent: '#94a3b8',
    faces: { top: 'Solid_Steel', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' } },
  { id: 'floor_ceil', label: 'Floor+Ceil', icon: Layers, active: true, accent: '#94a3b8',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Open', s: 'Open', e: 'Open', w: 'Open' } },
  { id: 'railing', label: 'Railing', icon: Fence, active: true, accent: '#64748b',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Railing_Cable', e: 'Railing_Cable', w: 'Railing_Cable' } },
  { id: 'window', label: 'Window', icon: AppWindow, active: true, accent: '#2563eb',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Glass_Pane', s: 'Glass_Pane', e: 'Glass_Pane', w: 'Glass_Pane' } },
  { id: 'half_fold', label: 'Half-Fold', icon: Origami, active: true, accent: '#9333ea',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Half_Fold', s: 'Half_Fold', e: 'Solid_Steel', w: 'Solid_Steel' } },
  { id: 'gull_wing', label: 'Gull-Wing', icon: ChevronsUpDown, active: true, accent: '#7c3aed',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Gull_Wing', s: 'Gull_Wing', e: 'Solid_Steel', w: 'Solid_Steel' } },
];

/** Sealed cube config used by Reset action */
export const SEALED_CONFIG: BlockPreset = {
  id: 'floor_ceil' as BlockPresetId, label: 'Sealed', icon: Layers, active: true, accent: '#64748b',
  faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
};

export function getPresetById(id: BlockPresetId): BlockPreset | undefined {
  return BLOCK_PRESETS.find(p => p.id === id);
}
