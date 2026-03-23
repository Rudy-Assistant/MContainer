import { useStore } from '@/store/useStore';
import type { FaceFinish } from '@/types/container';
import type { FaceKey } from '@/hooks/useSelectionTarget';

/** Shared hook for applying finish patches to one or more voxels */
export function useApplyFinish(containerId: string, indices: number[], face: FaceKey) {
  const setFaceFinish = useStore((s) => s.setFaceFinish);
  return (patch: Partial<FaceFinish>) => {
    for (const idx of indices) setFaceFinish(containerId, idx, face, patch);
  };
}
