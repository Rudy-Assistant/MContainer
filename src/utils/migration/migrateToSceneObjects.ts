// Migration from old FaceFinish/LightPlacement to SceneObjects
// Called during hydration when schemaVersion < 2
import type { SceneObject, ObjectAnchor, WallDirection } from '@/types/sceneObject';

export function migrateToSceneObjects(state: any): any {
  if (state.schemaVersion && state.schemaVersion >= 2) return state;

  const sceneObjects: Record<string, SceneObject> = state.sceneObjects ?? {};
  let nextId = 1;
  const genId = () => `migrated-${nextId++}`;

  const containers = state.containers ?? {};
  for (const [containerId, container] of Object.entries(containers)) {
    const c = container as any;

    // 1. Migrate LightPlacement[] → SceneObjects
    if (c.lights && Array.isArray(c.lights)) {
      for (const light of c.lights) {
        const id = genId();
        const formId = light.type === 'ceiling' ? 'light_flush_mount' : 'light_floor_lamp';
        const anchorType = light.type === 'ceiling' ? 'ceiling' : 'floor';
        sceneObjects[id] = {
          id,
          formId,
          skin: {},
          anchor: {
            containerId,
            voxelIndex: light.voxelIndex,
            type: anchorType,
          },
        };
      }
    }

    // 2. Migrate per-voxel DoorConfig and FaceFinish → SceneObjects
    if (c.voxelGrid && Array.isArray(c.voxelGrid)) {
      for (let vi = 0; vi < c.voxelGrid.length; vi++) {
        const voxel = c.voxelGrid[vi];
        if (!voxel || !voxel.active) continue;

        // DoorConfig migration
        if (voxel.doorConfig) {
          for (const [face, config] of Object.entries(voxel.doorConfig)) {
            if (!config || face === 'top' || face === 'bottom') continue;
            const dc = config as any;
            const id = genId();
            const formId = dc.type === 'slide' ? 'door_glass_slide' : 'door_single_swing';
            sceneObjects[id] = {
              id,
              formId,
              skin: {},
              anchor: {
                containerId,
                voxelIndex: vi,
                type: 'face',
                face: face as WallDirection,
                slot: 1,
              },
              state: {
                openState: dc.state ?? 'closed',
                flipDirection: dc.hingeEdge === 'right',
              },
            };
          }
        }

        // FaceFinish migration (doors, lights, electrical marked on faces)
        if (voxel.faceFinishes) {
          for (const [face, finish] of Object.entries(voxel.faceFinishes)) {
            if (!finish) continue;
            const ff = finish as any;

            // doorStyle → door SceneObject (if not already migrated via doorConfig)
            if (ff.doorStyle && !voxel.doorConfig?.[face]) {
              const id = genId();
              sceneObjects[id] = {
                id,
                formId: ff.doorStyle === 'slide' ? 'door_glass_slide' :
                        ff.doorStyle === 'barn' ? 'door_barn_slide' :
                        ff.doorStyle === 'french' ? 'door_french' : 'door_single_swing',
                skin: ff.frameColor ? { frame: ff.frameColor } : {},
                anchor: {
                  containerId,
                  voxelIndex: vi,
                  type: 'face',
                  face: face as WallDirection,
                  slot: 1,
                },
              };
            }

            // light on face → wall sconce
            if (ff.light && face !== 'top' && face !== 'bottom') {
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
                state: ff.lightColor ? { colorTemp: ff.lightColor } : undefined,
              };
            }

            // electrical on face → outlet/switch/dimmer
            if (ff.electrical) {
              const id = genId();
              sceneObjects[id] = {
                id,
                formId: ff.electrical === 'switch' ? 'electrical_switch' :
                        ff.electrical === 'dimmer' ? 'electrical_dimmer' : 'electrical_outlet',
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
    }
  }

  return {
    ...state,
    sceneObjects,
    schemaVersion: 2,
  };
}
