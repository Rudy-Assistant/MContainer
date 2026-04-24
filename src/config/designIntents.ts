import type {
  ContainerArrangementId,
  ContainerPosition,
  ContainerSize,
  FloorMaterialType,
} from '@/types/container';
import { CONTAINER_DIMENSIONS, ContainerSize as DefaultContainerSize } from '@/types/container';
import {
  getContainerArrangementSpec,
  type ContainerArrangementOutcome,
} from '@/config/containerArrangements';

export interface DesignIntentDoor {
  voxelIndex: number;
  face: 'n' | 's' | 'e' | 'w';
}

export interface DesignIntentStairs {
  voxelIndex: number;
  facing: 'n' | 's' | 'e' | 'w';
}

export interface SingleContainerDesignIntentSpec {
  kind: 'single_container';
  arrangementId: ContainerArrangementId;
  expectedOutcome?: ContainerArrangementOutcome;
  rooftopDeck?: boolean;
  floorMaterial?: FloorMaterialType;
  ceilingMaterial?: FloorMaterialType;
  door?: DesignIntentDoor;
  stairs?: DesignIntentStairs;
}

export type MultiContainerAdjacentSide = 'north' | 'south' | 'east' | 'west';

export type MultiContainerPlacement =
  | { type: 'origin'; position?: ContainerPosition }
  | { type: 'adjacent'; target: string; side: MultiContainerAdjacentSide; gap?: number }
  | { type: 'stack_on'; target: string };

export interface MultiContainerNodeSpec {
  id: string;
  size: ContainerSize;
  name?: string;
  placement: MultiContainerPlacement;
  intent?: SingleContainerDesignIntentSpec;
}

export interface MultiContainerDesignIntentSpec {
  kind: 'multi_container';
  containers: MultiContainerNodeSpec[];
}

export type DesignConceptComposition =
  | 'single_pavilion'
  | 'gallery_wings'
  | 'courtyard_compound'
  | 'stacked_tower';

export type DesignConceptEnvelope = 'steel' | 'glass';
export type DesignConceptCirculation = 'flat' | 'atrium' | 'vertical';
export type DesignConceptOutdoor = 'none' | 'terrace';

export interface ConceptDesignIntentSpec {
  kind: 'concept';
  composition: DesignConceptComposition;
  envelope?: DesignConceptEnvelope;
  circulation?: DesignConceptCirculation;
  outdoor?: DesignConceptOutdoor;
}

export type DesignIntentSpec =
  | SingleContainerDesignIntentSpec
  | MultiContainerDesignIntentSpec
  | ConceptDesignIntentSpec;

export type SingleContainerDesignIntentOperation =
  | { type: 'apply_arrangement'; arrangementId: ContainerArrangementId }
  | { type: 'set_floor_material'; material: FloorMaterialType }
  | { type: 'set_ceiling_material'; material: FloorMaterialType }
  | { type: 'add_door'; voxelIndex: number; face: 'n' | 's' | 'e' | 'w' }
  | { type: 'add_vertical_stairs'; voxelIndex: number; facing: 'n' | 's' | 'e' | 'w' }
  | { type: 'generate_rooftop_deck' };

export type MultiContainerDesignIntentOperation =
  | { type: 'create_container'; nodeId: string; size: ContainerSize; position: ContainerPosition; name?: string }
  | { type: 'stack_container'; nodeId: string; targetNodeId: string }
  | { type: 'apply_single_container_intent'; nodeId: string; intent: SingleContainerDesignIntentSpec };

export type DesignIntentOperation =
  | SingleContainerDesignIntentOperation
  | MultiContainerDesignIntentOperation;

interface ResolvedNodePlacement {
  id: string;
  size: ContainerSize;
  position: ContainerPosition;
  stackedOn?: string;
}

type PromptSingleContainerDesignIntentSchema = {
  kind: 'single_container';
  arrangementId?: ContainerArrangementId;
  expectedOutcome?: ContainerArrangementOutcome;
  rooftopDeck?: boolean;
  floorMaterial?: FloorMaterialType;
  ceilingMaterial?: FloorMaterialType;
  door?: DesignIntentDoor;
  stairs?: DesignIntentStairs;
};

type PromptMultiContainerPlacementSchema =
  | { type?: 'origin'; position?: Partial<ContainerPosition> }
  | { type: 'adjacent'; target: string; side: MultiContainerAdjacentSide; gap?: number }
  | { type: 'stack_on'; target: string };

export interface PromptMultiContainerNodeSchema {
  key: string;
  size?: ContainerSize;
  name?: string;
  placement?: PromptMultiContainerPlacementSchema;
  arrangementId?: ContainerArrangementId;
  expectedOutcome?: ContainerArrangementOutcome;
  rooftopDeck?: boolean;
  floorMaterial?: FloorMaterialType;
  ceilingMaterial?: FloorMaterialType;
  door?: DesignIntentDoor;
  stairs?: DesignIntentStairs;
}

type PromptMultiContainerDesignIntentSchema = {
  kind: 'multi_container';
  containers: PromptMultiContainerNodeSchema[];
};

export type PromptDesignIntentSchema =
  | PromptSingleContainerDesignIntentSchema
  | PromptMultiContainerDesignIntentSchema
  | {
      kind: 'concept';
      composition: DesignConceptComposition;
      envelope?: DesignConceptEnvelope;
      circulation?: DesignConceptCirculation;
      outdoor?: DesignConceptOutdoor;
    };

function conceptArrangementId(
  envelope: DesignConceptEnvelope,
  circulation: DesignConceptCirculation,
  outdoor: DesignConceptOutdoor,
): ContainerArrangementId {
  if (outdoor === 'terrace') {
    return envelope === 'glass' ? 'glass_terrace' : 'roof_terrace';
  }
  if (circulation === 'atrium' || circulation === 'vertical') {
    return envelope === 'glass' ? 'glass_atrium' : 'central_atrium';
  }
  return envelope === 'glass' ? 'largest_glass' : 'max_closed';
}

export function expandConceptDesignIntent(intent: ConceptDesignIntentSpec): DesignIntentSpec {
  const envelope = intent.envelope ?? 'steel';
  const circulation = intent.circulation ?? 'flat';
  const outdoor = intent.outdoor ?? 'none';
  const arrangementId = conceptArrangementId(envelope, circulation, outdoor);

  switch (intent.composition) {
    case 'single_pavilion':
      return {
        kind: 'single_container',
        arrangementId,
        expectedOutcome: 'enclosed',
        rooftopDeck: outdoor === 'terrace' && circulation === 'vertical',
      };
    case 'gallery_wings':
      return {
        kind: 'multi_container',
        containers: [
          {
            id: 'gallery',
            size: DefaultContainerSize.HighCube40,
            placement: { type: 'origin', position: { x: 0, y: 0, z: 0 } },
            intent: {
              kind: 'single_container',
              arrangementId: conceptArrangementId(envelope, 'atrium', outdoor),
              expectedOutcome: 'enclosed',
            },
          },
          {
            id: 'west_wing',
            size: DefaultContainerSize.HighCube40,
            placement: { type: 'adjacent', target: 'gallery', side: 'north' },
            intent: {
              kind: 'single_container',
              arrangementId: envelope === 'glass' ? 'largest_glass' : 'max_closed',
              expectedOutcome: 'enclosed',
            },
          },
          {
            id: 'east_wing',
            size: DefaultContainerSize.HighCube40,
            placement: { type: 'adjacent', target: 'gallery', side: 'south' },
            intent: {
              kind: 'single_container',
              arrangementId: envelope === 'glass' ? 'largest_glass' : 'max_closed',
              expectedOutcome: 'enclosed',
            },
          },
        ],
      };
    case 'courtyard_compound':
      return {
        kind: 'multi_container',
        containers: [
          {
            id: 'northwest',
            size: DefaultContainerSize.HighCube40,
            placement: { type: 'origin', position: { x: 0, y: 0, z: 0 } },
            intent: { kind: 'single_container', arrangementId, expectedOutcome: 'enclosed' },
          },
          {
            id: 'northeast',
            size: DefaultContainerSize.HighCube40,
            placement: { type: 'adjacent', target: 'northwest', side: 'east' },
            intent: { kind: 'single_container', arrangementId, expectedOutcome: 'enclosed' },
          },
          {
            id: 'southwest',
            size: DefaultContainerSize.HighCube40,
            placement: { type: 'adjacent', target: 'northwest', side: 'south', gap: CONTAINER_DIMENSIONS[DefaultContainerSize.HighCube40].width },
            intent: { kind: 'single_container', arrangementId, expectedOutcome: 'enclosed' },
          },
          {
            id: 'southeast',
            size: DefaultContainerSize.HighCube40,
            placement: { type: 'adjacent', target: 'southwest', side: 'east' },
            intent: { kind: 'single_container', arrangementId, expectedOutcome: 'enclosed' },
          },
        ],
      };
    case 'stacked_tower':
      return {
        kind: 'multi_container',
        containers: [
          {
            id: 'base',
            size: DefaultContainerSize.HighCube40,
            placement: { type: 'origin', position: { x: 0, y: 0, z: 0 } },
            intent: {
              kind: 'single_container',
              arrangementId: conceptArrangementId(envelope, 'atrium', 'none'),
              expectedOutcome: 'enclosed',
            },
          },
          {
            id: 'upper',
            size: DefaultContainerSize.HighCube40,
            placement: { type: 'stack_on', target: 'base' },
            intent: {
              kind: 'single_container',
              arrangementId,
              expectedOutcome: 'enclosed',
              stairs: { voxelIndex: 10, facing: 's' },
            },
          },
        ],
      };
  }
}

function resolveAdjacentPosition(
  target: ResolvedNodePlacement,
  size: ContainerSize,
  side: MultiContainerAdjacentSide,
  gap = 0,
): ContainerPosition {
  const targetDims = CONTAINER_DIMENSIONS[target.size];
  const dims = CONTAINER_DIMENSIONS[size];
  const xOffset = (targetDims.length + dims.length) / 2 + gap;
  const zOffset = (targetDims.width + dims.width) / 2 + gap;

  switch (side) {
    case 'east':
      return { x: target.position.x + xOffset, y: target.position.y, z: target.position.z };
    case 'west':
      return { x: target.position.x - xOffset, y: target.position.y, z: target.position.z };
    case 'north':
      return { x: target.position.x, y: target.position.y, z: target.position.z - zOffset };
    case 'south':
      return { x: target.position.x, y: target.position.y, z: target.position.z + zOffset };
  }
}

function resolveMultiContainerPlacements(
  intent: MultiContainerDesignIntentSpec,
): ResolvedNodePlacement[] {
  const resolved = new Map<string, ResolvedNodePlacement>();
  const placements: ResolvedNodePlacement[] = [];

  for (const node of intent.containers) {
    let position: ContainerPosition;
    let stackedOn: string | undefined;

    switch (node.placement.type) {
      case 'origin':
        position = {
          x: node.placement.position?.x ?? 0,
          y: node.placement.position?.y ?? 0,
          z: node.placement.position?.z ?? 0,
        };
        break;
      case 'adjacent': {
        const target = resolved.get(node.placement.target);
        if (!target) {
          throw new Error(`Cannot resolve adjacent placement for "${node.id}" before "${node.placement.target}".`);
        }
        position = resolveAdjacentPosition(target, node.size, node.placement.side, node.placement.gap ?? 0);
        break;
      }
      case 'stack_on': {
        const target = resolved.get(node.placement.target);
        if (!target) {
          throw new Error(`Cannot resolve stack placement for "${node.id}" before "${node.placement.target}".`);
        }
        position = { ...target.position };
        stackedOn = target.id;
        break;
      }
    }

    const resolvedNode = { id: node.id, size: node.size, position, stackedOn };
    resolved.set(node.id, resolvedNode);
    placements.push(resolvedNode);
  }

  return placements;
}

function footprintsOverlap(
  a: ResolvedNodePlacement,
  b: ResolvedNodePlacement,
  tolerance = 0.05,
): boolean {
  const aDims = CONTAINER_DIMENSIONS[a.size];
  const bDims = CONTAINER_DIMENSIONS[b.size];
  const aHalfX = aDims.length / 2 - tolerance;
  const aHalfZ = aDims.width / 2 - tolerance;
  const bHalfX = bDims.length / 2 - tolerance;
  const bHalfZ = bDims.width / 2 - tolerance;

  return (
    a.position.x - aHalfX < b.position.x + bHalfX &&
    a.position.x + aHalfX > b.position.x - bHalfX &&
    a.position.z - aHalfZ < b.position.z + bHalfZ &&
    a.position.z + aHalfZ > b.position.z - bHalfZ
  );
}

function validateSingleContainerIntent(intent: SingleContainerDesignIntentSpec): string[] {
  const errors: string[] = [];
  const arrangement = getContainerArrangementSpec(intent.arrangementId);

  if (intent.expectedOutcome && arrangement.outcome !== intent.expectedOutcome) {
    errors.push(
      `Arrangement "${intent.arrangementId}" yields "${arrangement.outcome}", not "${intent.expectedOutcome}".`,
    );
  }

  if (arrangement.outcome === 'collapsed') {
    if (intent.rooftopDeck) errors.push('Collapsed arrangements cannot add a rooftop deck.');
    if (intent.floorMaterial) errors.push('Collapsed arrangements cannot assign floor materials.');
    if (intent.ceilingMaterial) errors.push('Collapsed arrangements cannot assign ceiling materials.');
    if (intent.door) errors.push('Collapsed arrangements cannot place a door.');
    if (intent.stairs) errors.push('Collapsed arrangements cannot place stairs.');
  }

  if (arrangement.outcome === 'open_outdoor' && intent.ceilingMaterial) {
    errors.push('Open-air arrangements cannot assign a ceiling material because they have no roof.');
  }

  if (intent.door && intent.door.voxelIndex < 0) {
    errors.push('Door voxel index must be non-negative.');
  }

  if (intent.stairs && intent.stairs.voxelIndex < 0) {
    errors.push('Stair voxel index must be non-negative.');
  }

  return errors;
}

function validateMultiContainerIntent(intent: MultiContainerDesignIntentSpec): string[] {
  const errors: string[] = [];

  if (intent.containers.length === 0) {
    errors.push('Multi-container intents must include at least one container.');
    return errors;
  }

  const seenIds = new Set<string>();
  for (const [index, node] of intent.containers.entries()) {
    if (!node.id.trim()) {
      errors.push(`Container node ${index + 1} is missing an id.`);
    }
    if (seenIds.has(node.id)) {
      errors.push(`Duplicate container node id "${node.id}".`);
    }
    seenIds.add(node.id);

    if (node.placement.type !== 'origin') {
      const target = node.placement.target;
      if (!intent.containers.slice(0, index).some((candidate) => candidate.id === target)) {
        errors.push(`Container "${node.id}" references "${target}" before it is defined.`);
      }
    }

    if (node.intent) {
      for (const error of validateSingleContainerIntent(node.intent)) {
        errors.push(`Container "${node.id}": ${error}`);
      }
    }
  }

  if (errors.length > 0) {
    return errors;
  }

  const placements = resolveMultiContainerPlacements(intent);
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i];
      const b = placements[j];
      if (a.stackedOn === b.id || b.stackedOn === a.id) continue;
      if (a.position.y !== b.position.y) continue;
      if (footprintsOverlap(a, b)) {
        errors.push(`Container "${a.id}" overlaps "${b.id}" in plan.`);
      }
    }
  }

  return errors;
}

export function validateDesignIntent(intent: DesignIntentSpec): string[] {
  if (intent.kind === 'concept') {
    return validateDesignIntent(expandConceptDesignIntent(intent));
  }
  if (intent.kind === 'single_container') {
    return validateSingleContainerIntent(intent);
  }
  return validateMultiContainerIntent(intent);
}

export function compileSingleContainerDesignIntent(
  intent: SingleContainerDesignIntentSpec,
): SingleContainerDesignIntentOperation[] {
  const errors = validateSingleContainerIntent(intent);
  if (errors.length > 0) {
    throw new Error(`Invalid design intent: ${errors.join(' ')}`);
  }

  const operations: SingleContainerDesignIntentOperation[] = [
    { type: 'apply_arrangement', arrangementId: intent.arrangementId },
  ];

  if (intent.floorMaterial) {
    operations.push({ type: 'set_floor_material', material: intent.floorMaterial });
  }

  if (intent.ceilingMaterial) {
    operations.push({ type: 'set_ceiling_material', material: intent.ceilingMaterial });
  }

  if (intent.rooftopDeck) {
    operations.push({ type: 'generate_rooftop_deck' });
  }

  if (intent.door) {
    operations.push({
      type: 'add_door',
      voxelIndex: intent.door.voxelIndex,
      face: intent.door.face,
    });
  }

  if (intent.stairs) {
    operations.push({
      type: 'add_vertical_stairs',
      voxelIndex: intent.stairs.voxelIndex,
      facing: intent.stairs.facing,
    });
  }

  return operations;
}

export function compileMultiContainerDesignIntent(
  intent: MultiContainerDesignIntentSpec,
): MultiContainerDesignIntentOperation[] {
  const errors = validateMultiContainerIntent(intent);
  if (errors.length > 0) {
    throw new Error(`Invalid multi-container design intent: ${errors.join(' ')}`);
  }

  const placements = resolveMultiContainerPlacements(intent);
  const operations: MultiContainerDesignIntentOperation[] = [];

  for (const node of intent.containers) {
    const placement = placements.find((candidate) => candidate.id === node.id)!;
    operations.push({
      type: 'create_container',
      nodeId: node.id,
      size: node.size,
      position: placement.position,
      name: node.name,
    });

    if (placement.stackedOn) {
      operations.push({
        type: 'stack_container',
        nodeId: node.id,
        targetNodeId: placement.stackedOn,
      });
    }

    if (node.intent) {
      operations.push({
        type: 'apply_single_container_intent',
        nodeId: node.id,
        intent: node.intent,
      });
    }
  }

  return operations;
}

export function compileDesignIntent(intent: DesignIntentSpec): DesignIntentOperation[] {
  if (intent.kind === 'concept') {
    return compileDesignIntent(expandConceptDesignIntent(intent));
  }
  if (intent.kind === 'single_container') {
    return compileSingleContainerDesignIntent(intent);
  }
  return compileMultiContainerDesignIntent(intent);
}

export function parsePromptDesignIntentSchema(schema: PromptDesignIntentSchema): DesignIntentSpec {
  if (schema.kind === 'concept') {
    return {
      kind: 'concept',
      composition: schema.composition,
      envelope: schema.envelope,
      circulation: schema.circulation,
      outdoor: schema.outdoor,
    };
  }
  if (schema.kind === 'single_container') {
    return {
      kind: 'single_container',
      arrangementId: schema.arrangementId ?? 'max_closed',
      expectedOutcome: schema.expectedOutcome,
      rooftopDeck: schema.rooftopDeck,
      floorMaterial: schema.floorMaterial,
      ceilingMaterial: schema.ceilingMaterial,
      door: schema.door,
      stairs: schema.stairs,
    };
  }

  return {
    kind: 'multi_container',
    containers: schema.containers.map((container, index) => {
      const placement = container.placement ?? (
        index === 0
          ? { type: 'origin', position: { x: 0, y: 0, z: 0 } }
          : {
              type: 'adjacent',
              target: schema.containers[index - 1].key,
              side: 'east',
              gap: 0,
            }
      );

      let resolvedPlacement: MultiContainerPlacement;
      if (!placement.type || placement.type === 'origin') {
        resolvedPlacement = {
          type: 'origin',
          position: {
            x: placement.position?.x ?? 0,
            y: placement.position?.y ?? 0,
            z: placement.position?.z ?? 0,
          },
        };
      } else if (placement.type === 'adjacent') {
        resolvedPlacement = placement;
      } else if (placement.type === 'stack_on') {
        resolvedPlacement = {
          type: 'stack_on',
          target: placement.target,
        };
      } else {
        resolvedPlacement = {
          type: 'origin',
          position: { x: 0, y: 0, z: 0 },
        };
      }

      return {
        id: container.key,
        size: container.size ?? DefaultContainerSize.HighCube40,
        name: container.name,
        placement: resolvedPlacement,
        intent: {
          kind: 'single_container',
          arrangementId: container.arrangementId ?? 'max_closed',
          expectedOutcome: container.expectedOutcome,
          rooftopDeck: container.rooftopDeck,
          floorMaterial: container.floorMaterial,
          ceilingMaterial: container.ceilingMaterial,
          door: container.door,
          stairs: container.stairs,
        },
      };
    }),
  };
}
