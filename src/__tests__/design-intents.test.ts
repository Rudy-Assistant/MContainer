import { beforeEach, describe, expect, it } from 'vitest';
import {
  compileDesignIntent,
  parsePromptDesignIntentSchema,
  validateDesignIntent,
} from '@/config/designIntents';
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

  it('rejects multi-container overlaps on the same level', () => {
    const errors = validateDesignIntent({
      kind: 'multi_container',
      containers: [
        {
          id: 'a',
          size: ContainerSize.Standard40,
          placement: { type: 'origin', position: { x: 0, y: 0, z: 0 } },
        },
        {
          id: 'b',
          size: ContainerSize.Standard40,
          placement: { type: 'origin', position: { x: 0, y: 0, z: 0 } },
        },
      ],
    });

    expect(errors.join(' ')).toContain('overlaps');
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

  it('applies the atrium arrangement through the design-intent path', () => {
    const containerId = addTestContainer();

    useStore.getState().applyDesignIntent(containerId, {
      kind: 'single_container',
      arrangementId: 'central_atrium',
    });

    const container = useStore.getState().containers[containerId];
    expect(container.appliedPreset).toBe('central_atrium');
    expect(container.voxelGrid?.[43].faces.bottom).toBe('Open');
    expect(container.voxelGrid?.[43].faces.n).toBe('Railing_Cable');
  });

  it('compiles a multi-container intent into create/stack/apply operations', () => {
    const operations = compileDesignIntent({
      kind: 'multi_container',
      containers: [
        {
          id: 'base',
          size: ContainerSize.HighCube40,
          placement: { type: 'origin', position: { x: 0, y: 0, z: 0 } },
          intent: { kind: 'single_container', arrangementId: 'max_closed' },
        },
        {
          id: 'wing',
          size: ContainerSize.HighCube40,
          placement: { type: 'adjacent', target: 'base', side: 'east' },
          intent: { kind: 'single_container', arrangementId: 'largest_glass' },
        },
        {
          id: 'upper',
          size: ContainerSize.HighCube40,
          placement: { type: 'stack_on', target: 'base' },
          intent: { kind: 'single_container', arrangementId: 'max_closed', rooftopDeck: true },
        },
      ],
    });

    expect(operations.map((op) => op.type)).toEqual([
      'create_container',
      'apply_single_container_intent',
      'create_container',
      'apply_single_container_intent',
      'create_container',
      'stack_container',
      'apply_single_container_intent',
    ]);
  });

  it('compiles a high-level concept intent onto the existing arrangement path', () => {
    const operations = compileDesignIntent({
      kind: 'concept',
      composition: 'gallery_wings',
      envelope: 'glass',
      circulation: 'atrium',
      outdoor: 'terrace',
    });

    expect(operations.map((op) => op.type)).toContain('create_container');
    expect(operations.map((op) => op.type)).toContain('apply_single_container_intent');
  });

  it('applies a multi-container intent through the store API', () => {
    const ids = useStore.getState().applyMultiContainerDesignIntent({
      kind: 'multi_container',
      containers: [
        {
          id: 'base',
          name: 'Base',
          size: ContainerSize.HighCube40,
          placement: { type: 'origin', position: { x: 0, y: 0, z: 0 } },
          intent: { kind: 'single_container', arrangementId: 'max_closed' },
        },
        {
          id: 'wing',
          name: 'Wing',
          size: ContainerSize.HighCube40,
          placement: { type: 'adjacent', target: 'base', side: 'east' },
          intent: { kind: 'single_container', arrangementId: 'largest_glass' },
        },
        {
          id: 'upper',
          name: 'Upper',
          size: ContainerSize.HighCube40,
          placement: { type: 'stack_on', target: 'base' },
          intent: { kind: 'single_container', arrangementId: 'max_closed', rooftopDeck: true },
        },
      ],
    });

    expect(ids).toHaveLength(3);

    const containers = ids.map((id) => useStore.getState().containers[id]);
    const base = containers.find((container) => container.name === 'Base')!;
    const wing = containers.find((container) => container.name === 'Wing')!;
    const upper = containers.find((container) => container.name === 'Upper')!;

    expect(wing.position.x).toBeGreaterThan(base.position.x);
    expect(wing.position.y).toBe(base.position.y);
    expect(upper.stackedOn).toBe(base.id);
    expect(upper.position.x).toBe(base.position.x);
    expect(upper.position.z).toBe(base.position.z);
    expect(upper.position.y).toBeGreaterThan(base.position.y);
    expect(wing.appliedPreset).toBe('largest_glass');
  });
});

describe('prompt design schema parser', () => {
  it('parses a compact prompt-facing schema into a validated multi-container intent', () => {
    const intent = parsePromptDesignIntentSchema({
      kind: 'multi_container',
      containers: [
        {
          key: 'main',
          arrangementId: 'central_atrium',
        },
        {
          key: 'sunroom',
          arrangementId: 'largest_glass',
          placement: { type: 'adjacent', target: 'main', side: 'east' },
        },
      ],
    });

    expect(intent.kind).toBe('multi_container');
    if (intent.kind !== 'multi_container') return;
    expect(intent.containers[0].size).toBe(ContainerSize.HighCube40);
    expect(intent.containers[0].placement.type).toBe('origin');
    expect(intent.containers[1].intent?.arrangementId).toBe('largest_glass');
    expect(intent.containers[0].intent?.arrangementId).toBe('central_atrium');
    expect(validateDesignIntent(intent)).toEqual([]);
  });

  it('parses a concept-facing schema into a validated concept intent', () => {
    const intent = parsePromptDesignIntentSchema({
      kind: 'concept',
      composition: 'courtyard_compound',
      envelope: 'glass',
      circulation: 'atrium',
      outdoor: 'terrace',
    });

    expect(intent.kind).toBe('concept');
    expect(validateDesignIntent(intent)).toEqual([]);
    expect(compileDesignIntent(intent).some((op) => op.type === 'create_container')).toBe(true);
  });
});
