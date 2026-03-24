import type { VoxelFaces } from '@/types/container';

export interface ContainerLevelPreset {
  id: string;
  label: string;
  faces: VoxelFaces;
}

export const CONTAINER_LEVEL_PRESETS: ContainerLevelPreset[] = [
  {
    id: 'all_deck',
    label: 'All Deck',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Railing_Cable', e: 'Railing_Cable', w: 'Railing_Cable' },
  },
  {
    id: 'interior',
    label: 'Interior',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 'n_deck',
    label: 'N Deck',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 's_deck',
    label: 'S Deck',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Railing_Cable', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 'retract',
    label: 'Retract',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Half_Fold', s: 'Half_Fold', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
];
