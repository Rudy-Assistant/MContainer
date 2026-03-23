// Migration from old FaceFinish/LightPlacement to SceneObjects
// Called during hydration when schemaVersion < 2
export function migrateToSceneObjects(state: any): any {
  if (state.schemaVersion && state.schemaVersion >= 2) return state;

  // For now, just set schemaVersion to 2 and init empty sceneObjects
  // Full migration (reading old DoorConfig, FaceFinish, LightPlacement)
  // deferred until old data format is actually encountered in production
  return {
    ...state,
    sceneObjects: state.sceneObjects ?? {},
    schemaVersion: 2,
  };
}
