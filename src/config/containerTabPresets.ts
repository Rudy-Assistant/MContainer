import type { ContainerArrangementId, VoxelFaces } from '@/types/container';
import {
  CONTAINER_ARRANGEMENT_SPECS,
  getContainerArrangementPreviewFaces,
} from '@/config/containerArrangements';

export type ContainerLevelPresetCategory = 'Enclosed' | 'Atrium' | 'Terrace' | 'Outdoor' | 'Reset';

export interface ContainerLevelPreset {
  id: ContainerArrangementId;
  label: string;
  title: string;
  hint: string;
  faces: VoxelFaces;
  category: ContainerLevelPresetCategory;
  tags: string[];
}

function presetCategory(spec: (typeof CONTAINER_ARRANGEMENT_SPECS)[number]): ContainerLevelPresetCategory {
  if (spec.kind === 'retract') return 'Reset';
  if (spec.voidRows?.length && spec.voidCols?.length) return 'Atrium';
  if (spec.upperLevelMode === 'extensions_only') return 'Terrace';
  if (spec.outcome === 'covered_outdoor' || spec.outcome === 'open_outdoor') return 'Outdoor';
  return 'Enclosed';
}

export const CONTAINER_LEVEL_PRESETS: ContainerLevelPreset[] = CONTAINER_ARRANGEMENT_SPECS.map((spec) => ({
  id: spec.id,
  label: spec.label,
  title: spec.title,
  hint: spec.hint,
  faces: getContainerArrangementPreviewFaces(spec),
  category: presetCategory(spec),
  tags: spec.tags ?? [],
}));
