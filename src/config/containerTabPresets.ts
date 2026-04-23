import type { ContainerArrangementId, VoxelFaces } from '@/types/container';
import {
  CONTAINER_ARRANGEMENT_SPECS,
  getContainerArrangementPreviewFaces,
} from '@/config/containerArrangements';

export interface ContainerLevelPreset {
  id: ContainerArrangementId;
  label: string;
  title: string;
  faces: VoxelFaces;
}

export const CONTAINER_LEVEL_PRESETS: ContainerLevelPreset[] = CONTAINER_ARRANGEMENT_SPECS.map((spec) => ({
  id: spec.id,
  label: spec.label,
  title: spec.title,
  faces: getContainerArrangementPreviewFaces(spec),
}));
