/**
 * Brainstorm-deferred "Hierarchical grouping" — minimal store contract.
 *
 * Containers can be grouped under labeled buckets (e.g., "North Wing",
 * "Roof Level"). A container belongs to at most one group; adding it to
 * a new group implicitly removes it from any previous group.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('Hierarchical grouping (brainstorm deferred — bulk-op foundation)', () => {
  beforeEach(() => resetStore());

  it('containerGroups defaults to empty', () => {
    expect(useStore.getState().containerGroups).toEqual({});
  });

  it('createGroup returns a new id and stores the label', () => {
    const id = useStore.getState().createGroup('North Wing');
    const g = useStore.getState().containerGroups[id];
    expect(g.label).toBe('North Wing');
    expect(g.containerIds).toEqual([]);
  });

  it('createGroup with initial members records them', () => {
    const id = useStore.getState().createGroup('North Wing', ['c1', 'c2']);
    expect(useStore.getState().containerGroups[id].containerIds).toEqual(['c1', 'c2']);
  });

  it('renameGroup updates the label without touching members', () => {
    const id = useStore.getState().createGroup('Wing A', ['c1']);
    useStore.getState().renameGroup(id, 'North Wing');
    const g = useStore.getState().containerGroups[id];
    expect(g.label).toBe('North Wing');
    expect(g.containerIds).toEqual(['c1']);
  });

  it('removeGroup deletes it entirely', () => {
    const id = useStore.getState().createGroup('X');
    useStore.getState().removeGroup(id);
    expect(useStore.getState().containerGroups[id]).toBeUndefined();
  });

  it('addToGroup adds a container if not already present', () => {
    const id = useStore.getState().createGroup('X');
    useStore.getState().addToGroup(id, 'c1');
    useStore.getState().addToGroup(id, 'c1'); // dedup
    expect(useStore.getState().containerGroups[id].containerIds).toEqual(['c1']);
  });

  it('addToGroup removes container from any prior group (one-group-at-a-time invariant)', () => {
    const a = useStore.getState().createGroup('A', ['c1']);
    const b = useStore.getState().createGroup('B');
    useStore.getState().addToGroup(b, 'c1');
    expect(useStore.getState().containerGroups[a].containerIds).toEqual([]);
    expect(useStore.getState().containerGroups[b].containerIds).toEqual(['c1']);
  });

  it('removeFromGroup removes only the named container', () => {
    const id = useStore.getState().createGroup('X', ['c1', 'c2', 'c3']);
    useStore.getState().removeFromGroup(id, 'c2');
    expect(useStore.getState().containerGroups[id].containerIds).toEqual(['c1', 'c3']);
  });

  it('groupLabelFor returns the group label for a member container', () => {
    useStore.getState().createGroup('North Wing', ['c1']);
    expect(useStore.getState().groupLabelFor('c1')).toBe('North Wing');
    expect(useStore.getState().groupLabelFor('c2')).toBeNull();
  });
});
