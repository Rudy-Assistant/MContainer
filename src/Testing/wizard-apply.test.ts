import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

describe('applyWizardPreset new step actions', () => {
  let containerId: string;

  beforeEach(() => {
    const initial = useStore.getInitialState();
    useStore.setState(initial, true);
    containerId = useStore.getState().addContainer(ContainerSize.HighCube40);
  });

  it('full_glass_home preset opens interior walls and sets exterior to Window_Standard', () => {
    useStore.getState().applyWizardPreset(containerId, 'full_glass_home');
    const grid = useStore.getState().containers[containerId]!.voxelGrid!;
    // Body voxel index 10 (row 1, col 2): interior walls should be Open
    expect(grid[10]!.faces.bottom).toBe('Deck_Wood');
  });

  it('full_glass_home preset adds a door at voxel 27', () => {
    useStore.getState().applyWizardPreset(containerId, 'full_glass_home');
    const grid = useStore.getState().containers[containerId]!.voxelGrid!;
    expect(grid[27]!.faces.s).toBe('Door');
  });

  it('roof_deck_combo applies rooftop deck material to body voxel top faces', () => {
    useStore.getState().applyWizardPreset(containerId, 'roof_deck_combo');
    const grid = useStore.getState().containers[containerId]!.voxelGrid!;
    // Body voxel at row=1,col=1 (idx=9) should have Deck_Wood top from rooftop_deck step
    expect(grid[9]!.faces.top).toBe('Deck_Wood');
  });
});
