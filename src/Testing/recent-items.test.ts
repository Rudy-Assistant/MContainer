import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';

describe('recentItems', () => {
  beforeEach(() => {
    const initial = useStore.getInitialState();
    useStore.setState(initial, true);
  });

  it('starts empty', () => {
    expect(useStore.getState().recentItems).toEqual([]);
  });

  it('addRecentItem adds to front', () => {
    useStore.getState().addRecentItem({ type: 'wallType', value: 'Solid_Steel', label: 'Solid Wall' });
    expect(useStore.getState().recentItems[0].value).toBe('Solid_Steel');
  });

  it('addRecentItem dedupes (moves existing to front)', () => {
    const s = useStore.getState;
    s().addRecentItem({ type: 'wallType', value: 'Solid_Steel', label: 'Solid Wall' });
    s().addRecentItem({ type: 'wallType', value: 'Glass_Pane', label: 'Glass' });
    s().addRecentItem({ type: 'wallType', value: 'Solid_Steel', label: 'Solid Wall' });
    expect(s().recentItems.length).toBe(2);
    expect(s().recentItems[0].value).toBe('Solid_Steel');
  });

  it('caps at 8 items', () => {
    for (let i = 0; i < 12; i++) {
      useStore.getState().addRecentItem({ type: 'wallType', value: `item_${i}`, label: `Item ${i}` });
    }
    expect(useStore.getState().recentItems.length).toBe(8);
  });
});

describe('collapsible sidebar state', () => {
  beforeEach(() => {
    const initial = useStore.getInitialState();
    useStore.setState(initial, true);
  });

  it('previewCollapsed defaults to true (collapsed)', () => {
    expect(useStore.getState().previewCollapsed).toBe(true);
  });

  it('gridCollapsed defaults to true (collapsed)', () => {
    expect(useStore.getState().gridCollapsed).toBe(true);
  });

  it('setPreviewCollapsed toggles', () => {
    useStore.getState().setPreviewCollapsed(true);
    expect(useStore.getState().previewCollapsed).toBe(true);
  });

  it('setGridCollapsed toggles', () => {
    useStore.getState().setGridCollapsed(true);
    expect(useStore.getState().gridCollapsed).toBe(true);
  });
});
