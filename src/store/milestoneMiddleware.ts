/**
 * Milestone middleware — auto-detects user progress and sets milestones.
 * Subscribes to useStore and fires setMilestone on relevant state transitions.
 */
import { type StoreApi } from 'zustand';

export function initMilestoneTracking(store: StoreApi<any>) {
  let prevContainerCount = 0;

  store.subscribe((state: any, prevState: any) => {
    if (!state.milestones) return;

    const containers = state.containers ?? {};
    const count = Object.keys(containers).length;

    // containerPlaced: first container added
    if (count >= 1 && !state.milestones.containerPlaced) {
      state.setMilestone('containerPlaced', true);
    }

    // multipleContainers: 2+ containers
    if (count >= 2 && !state.milestones.multipleContainers) {
      state.setMilestone('multipleContainers', true);
    }

    // exploredWalkthrough
    if (state.viewMode === 'walkthrough' && !state.milestones.exploredWalkthrough) {
      state.setMilestone('exploredWalkthrough', true);
    }

    prevContainerCount = count;
  });
}
