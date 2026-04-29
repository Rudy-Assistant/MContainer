import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize, VOXEL_COLS, VOXEL_LEVELS, VOXEL_ROWS } from '@/types/container';

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

  it('roof_deck_combo applies rooftop deck material to top-level body voxel top faces', () => {
    useStore.getState().applyWizardPreset(containerId, 'roof_deck_combo');
    const grid = useStore.getState().containers[containerId]!.voxelGrid!;
    // Rooftop deck lives on the TOP internal level, so body voxel at top-level row=1,col=1 (idx=41 for VOXEL_LEVELS=2) gets Deck_Wood on its top face.
    const topLevelBase = (VOXEL_LEVELS - 1) * VOXEL_ROWS * VOXEL_COLS;
    expect(grid[topLevelBase + 1 * VOXEL_COLS + 1]!.faces.top).toBe('Deck_Wood');
    // Floor-level voxel must NOT have been touched
    expect(grid[9]!.faces.top).not.toBe('Deck_Wood');
  });

  it('atrium_home applies the atrium arrangement through the wizard path', () => {
    useStore.getState().applyWizardPreset(containerId, 'atrium_home');
    const container = useStore.getState().containers[containerId]!;
    const grid = container.voxelGrid!;

    expect(container.appliedPreset).toBe('atrium_home');
    expect(grid[11]!.faces.top).toBe('Open');
    expect(grid[43]!.faces.bottom).toBe('Open');
    expect(grid[43]!.faces.n).toBe('Railing_Cable');
  });

  it('a single Ctrl+Z undoes the entire designIntent wizard application', () => {
    // Snapshot pre-wizard state so we can compare the post-undo state to it.
    const before = useStore.getState().containers[containerId]!;
    const beforeFaces = before.voxelGrid!.map((v) => ({ ...v.faces }));

    useStore.getState().applyWizardPreset(containerId, 'full_glass_home');
    const afterWizard = useStore.getState().containers[containerId]!;
    expect(afterWizard.appliedPreset).toBe('full_glass_home');
    // Sanity-check the wizard actually mutated the grid
    expect(afterWizard.voxelGrid![27]!.faces.s).toBe('Door');

    useStore.temporal.getState().undo();
    const afterUndo = useStore.getState().containers[containerId]!;

    // Undo must wipe appliedPreset AND revert every face the wizard touched.
    expect(afterUndo.appliedPreset).toBeUndefined();
    afterUndo.voxelGrid!.forEach((v, i) => {
      expect(v.faces).toEqual(beforeFaces[i]);
    });
  });
});
