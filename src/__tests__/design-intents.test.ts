import { beforeEach, describe, expect, it } from 'vitest';
import { compileDesignIntent, validateDesignIntent } from '@/config/designIntents';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

beforeEach(() => {
  useStore.setState(useStore.getInitialState(), true);
});

function addTestContainer(): string {
  const before = Object.keys(useStore.getState().containers);
  useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: 0 }, 0, true);
  const after = Object.keys(useStore.getState().containers);
  return after.find((id) => !before.includes(id))!;
}

describe('design intent validation', () => {
  it('rejects contradictory outcome expectations', () => {
    const errors = validateDesignIntent({
      kind: 'single_container',
      arrangementId: 'largest_glass',
      expectedOutcome: 'open_outdoor',
    });

    expect(errors[0]).toContain('largest_glass');
  });

  it('rejects collapsed arrangements with extra build operations', () => {
    const errors = validateDesignIntent({
      kind: 'single_container',
      arrangementId: 'retract_extensions',
      rooftopDeck: true,
      door: { voxelIndex: 0, face: 'n' },
    });

    expect(errors.join(' ')).toContain('Collapsed arrangements');
  });
});

describe('design intent compiler', () => {
  it('compiles a single-container intent into ordered store operations', () => {
    const operations = compileDesignIntent({
      kind: 'single_container',
      arrangementId: 'largest_glass',
      floorMaterial: 'wood:light',
      ceilingMaterial: 'steel',
      door: { voxelIndex: 27, face: 's' },
      stairs: { voxelIndex: 14, facing: 's' },
      rooftopDeck: true,
    });

    expect(operations.map((op) => op.type)).toEqual([
      'apply_arrangement',
      'set_floor_material',
      'set_ceiling_material',
      'generate_rooftop_deck',
      'add_door',
      'add_vertical_stairs',
    ]);
  });

  it('applies a valid intent through the store API', () => {
    const containerId = addTestContainer();

    useStore.getState().applyDesignIntent(containerId, {
      kind: 'single_container',
      arrangementId: 'largest_glass',
      floorMaterial: 'wood:light',
      door: { voxelIndex: 27, face: 's' },
    });

    const container = useStore.getState().containers[containerId];
    expect(container.appliedPreset).toBe('largest_glass');
    expect(container.floorMaterial).toBe('wood:light');
    expect(container.voxelGrid?.[27].faces.s).toBe('Door');
  });
});
