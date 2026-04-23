import type { ContainerArrangementId, VoxelFaces } from '@/types/container';

export interface ContainerLevelPreset {
  id: ContainerArrangementId;
  label: string;
  title: string;
  faces: VoxelFaces;
}

export const CONTAINER_LEVEL_PRESETS: ContainerLevelPreset[] = [
  {
    id: 'extend_shell',
    label: 'Shell',
    title: 'Extend shell',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 'max_closed',
    label: 'Max Box',
    title: 'Maximum closed interior',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 'largest_glass',
    label: 'Glass Box',
    title: 'Largest glass interior',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Glass_Pane', s: 'Glass_Pane', e: 'Glass_Pane', w: 'Glass_Pane' },
  },
  {
    id: 'wraparound_deck',
    label: 'Deck',
    title: 'Covered wraparound deck',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Railing_Cable', e: 'Railing_Cable', w: 'Railing_Cable' },
  },
  {
    id: 'wraparound_patio',
    label: 'Patio',
    title: 'Open wraparound patio',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Railing_Cable', e: 'Railing_Cable', w: 'Railing_Cable' },
  },
  {
    id: 'retract_extensions',
    label: 'Retract',
    title: 'Retract extensions',
    faces: { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' },
  },
];
