// Migration from old FaceFinish/LightPlacement to SceneObjects.
// Called during hydration when schemaVersion < 2.
import type { DoorConfig, FaceFinish } from '@/types/container';
import type { SceneObject, WallDirection } from '@/types/sceneObject';

type LegacyState = {
  schemaVersion?: number;
  sceneObjects?: unknown;
  containers?: unknown;
};

type MigratedState<T extends LegacyState> = T & {
  sceneObjects: Record<string, SceneObject>;
  schemaVersion: number;
};

type LegacyContainer = {
  lights?: unknown;
  voxelGrid?: unknown;
};

type LegacyLight = {
  voxelIndex: number;
  type: 'ceiling' | 'lamp';
};

type LegacyVoxel = {
  active?: boolean;
  doorConfig?: Partial<Record<string, DoorConfig>>;
  faceFinishes?: Partial<Record<string, FaceFinish>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isLegacyLight(value: unknown): value is LegacyLight {
  if (!isRecord(value)) return false;
  return typeof value.voxelIndex === 'number' && (value.type === 'ceiling' || value.type === 'lamp');
}

function isLegacyContainer(value: unknown): value is LegacyContainer {
  return isRecord(value);
}

function isLegacyVoxel(value: unknown): value is LegacyVoxel {
  return isRecord(value);
}

function isSceneObjectMap(value: unknown): value is Record<string, SceneObject> {
  return isRecord(value);
}

export function migrateToSceneObjects<T extends LegacyState>(state: T): MigratedState<T> {
  if (state.schemaVersion && state.schemaVersion >= 2) {
    return state as MigratedState<T>;
  }

  const sceneObjects: Record<string, SceneObject> = isSceneObjectMap(state.sceneObjects)
    ? { ...state.sceneObjects }
    : {};
  let nextId = 1;
  const genId = () => `migrated-${nextId++}`;

  const containers = isRecord(state.containers) ? state.containers : {};
  for (const [containerId, containerValue] of Object.entries(containers)) {
    if (!isLegacyContainer(containerValue)) continue;

    if (Array.isArray(containerValue.lights)) {
      for (const light of containerValue.lights) {
        if (!isLegacyLight(light)) continue;
        const id = genId();
        const formId = light.type === 'ceiling' ? 'light_flush_mount' : 'light_floor_lamp';
        sceneObjects[id] = {
          id,
          formId,
          skin: {},
          anchor: {
            containerId,
            voxelIndex: light.voxelIndex,
            type: light.type === 'ceiling' ? 'ceiling' : 'floor',
          },
        };
      }
    }

    if (!Array.isArray(containerValue.voxelGrid)) continue;
    for (let vi = 0; vi < containerValue.voxelGrid.length; vi++) {
      const voxel = containerValue.voxelGrid[vi];
      if (!isLegacyVoxel(voxel) || !voxel.active) continue;

      if (voxel.doorConfig) {
        for (const [face, config] of Object.entries(voxel.doorConfig)) {
          if (!config || face === 'top' || face === 'bottom') continue;
          const id = genId();
          sceneObjects[id] = {
            id,
            formId: config.type === 'slide' ? 'door_glass_slide' : 'door_single_swing',
            skin: {},
            anchor: {
              containerId,
              voxelIndex: vi,
              type: 'face',
              face: face as WallDirection,
              slot: 1,
            },
            state: {
              openState: config.state ?? 'closed',
              flipDirection: config.hingeEdge === 'right',
            },
          };
        }
      }

      if (!voxel.faceFinishes) continue;
      for (const [face, finish] of Object.entries(voxel.faceFinishes)) {
        if (!finish) continue;

        if (finish.doorStyle && !voxel.doorConfig?.[face]) {
          const id = genId();
          sceneObjects[id] = {
            id,
            formId: finish.doorStyle === 'slide' ? 'door_glass_slide' :
                    finish.doorStyle === 'barn' ? 'door_barn_slide' :
                    finish.doorStyle === 'french' ? 'door_french' : 'door_single_swing',
            skin: finish.frameColor ? { frame: finish.frameColor } : {},
            anchor: {
              containerId,
              voxelIndex: vi,
              type: 'face',
              face: face as WallDirection,
              slot: 1,
            },
          };
        }

        if (finish.light && face !== 'top' && face !== 'bottom') {
          const id = genId();
          sceneObjects[id] = {
            id,
            formId: 'light_wall_sconce',
            skin: {},
            anchor: {
              containerId,
              voxelIndex: vi,
              type: 'face',
              face: face as WallDirection,
              slot: 0,
            },
            state: finish.lightColor ? { colorTemp: finish.lightColor } : undefined,
          };
        }

        if (finish.electrical) {
          const id = genId();
          sceneObjects[id] = {
            id,
            formId: finish.electrical === 'switch' ? 'electrical_switch' :
                    finish.electrical === 'dimmer' ? 'electrical_dimmer' : 'electrical_outlet',
            skin: {},
            anchor: {
              containerId,
              voxelIndex: vi,
              type: 'face',
              face: face as WallDirection,
              slot: 2,
            },
          };
        }
      }
    }
  }

  return {
    ...state,
    sceneObjects,
    schemaVersion: 2,
  };
}
