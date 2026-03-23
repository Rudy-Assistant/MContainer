import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';
import { formRegistry } from '../config/formRegistry';

function resetStore() {
  useStore.setState({
    selectedObjectId: null,
    sceneObjects: {},
    activePlacementFormId: null,
    placementMode: false,
    sidebarCollapsed: false,
  });
}

describe('BottomPanel auto-sync logic', () => {
  beforeEach(resetStore);

  it('formRegistry has all expected categories', () => {
    const cats = new Set<string>();
    for (const [, f] of formRegistry) cats.add(f.category);
    expect(cats).toContain('door');
    expect(cats).toContain('window');
    expect(cats).toContain('light');
    expect(cats).toContain('electrical');
  });

  it('selecting an object yields the correct formId for category sync', () => {
    const doorFormId = 'door_single_swing';
    const objId = 'test-obj-1';
    useStore.setState({
      sceneObjects: {
        [objId]: {
          id: objId,
          formId: doorFormId,
          skin: {},
          anchor: { containerId: 'c1', voxelIndex: 9, type: 'face' as const, face: 'n' as const },
        },
      },
      selectedObjectId: objId,
    });

    const state = useStore.getState();
    const obj = state.sceneObjects[state.selectedObjectId!];
    expect(obj).toBeDefined();
    const form = formRegistry.get(obj!.formId);
    expect(form?.category).toBe('door');
  });

  it('sidebarCollapsed state is readable for positioning', () => {
    expect(useStore.getState().sidebarCollapsed).toBe(false);
    useStore.getState().toggleSidebar();
    expect(useStore.getState().sidebarCollapsed).toBe(true);
  });
});
