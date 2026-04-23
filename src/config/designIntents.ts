import type {
  ContainerArrangementId,
  FloorMaterialType,
} from '@/types/container';
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

export type DesignIntentSpec = SingleContainerDesignIntentSpec;

export type DesignIntentOperation =
  | { type: 'apply_arrangement'; arrangementId: ContainerArrangementId }
  | { type: 'set_floor_material'; material: FloorMaterialType }
  | { type: 'set_ceiling_material'; material: FloorMaterialType }
  | { type: 'add_door'; voxelIndex: number; face: 'n' | 's' | 'e' | 'w' }
  | { type: 'add_vertical_stairs'; voxelIndex: number; facing: 'n' | 's' | 'e' | 'w' }
  | { type: 'generate_rooftop_deck' };

export function validateDesignIntent(intent: DesignIntentSpec): string[] {
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

export function compileDesignIntent(intent: DesignIntentSpec): DesignIntentOperation[] {
  const errors = validateDesignIntent(intent);
  if (errors.length > 0) {
    throw new Error(`Invalid design intent: ${errors.join(' ')}`);
  }

  const operations: DesignIntentOperation[] = [
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
