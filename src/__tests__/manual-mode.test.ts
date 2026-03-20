/**
 * Manual Mode Tests
 *
 * Tests for Smart/Manual design mode toggle and guard behavior.
 * Real store actions, real state assertions. No source scanning.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('Manual Mode Toggle', () => {
  beforeEach(() => resetStore());

  it('MM-1: designMode defaults to smart', () => {
    expect(useStore.getState().designMode).toBe('smart');
  });

  it('MM-2: setDesignMode switches to manual', () => {
    useStore.getState().setDesignMode('manual');
    expect(useStore.getState().designMode).toBe('manual');
  });

  it('MM-3: toggleDesignMode toggles between smart and manual', () => {
    useStore.getState().toggleDesignMode();
    expect(useStore.getState().designMode).toBe('manual');
    useStore.getState().toggleDesignMode();
    expect(useStore.getState().designMode).toBe('smart');
  });

  it('MM-4: warnings defaults to empty array', () => {
    expect(useStore.getState().warnings).toEqual([]);
  });

  it('MM-5: setWarnings replaces the warnings array', () => {
    const w = [{ id: 'test-1', category: 'safety' as const, severity: 'warning' as const, message: 'Test', containerId: 'c1', voxelIndices: [0] }];
    useStore.getState().setWarnings(w);
    expect(useStore.getState().warnings).toEqual(w);
  });

  it('MM-6: hoveredWarning defaults to null', () => {
    expect(useStore.getState().hoveredWarning).toBe(null);
  });

  it('MM-7: setHoveredWarning sets the hovered warning ID', () => {
    useStore.getState().setHoveredWarning('test-1');
    expect(useStore.getState().hoveredWarning).toBe('test-1');
  });
});
