/**
 * unpackAnimations.ts — Configuration for extension "unpacking" animation sequences.
 *
 * Defines which animation phases play in sequence for each extension config,
 * and the transition rules between phases.
 *
 * ANIMATION TYPES:
 *   wall_to_floor:   Container wall swivels down on bottom hinge → becomes floor
 *   wall_to_ceiling: Container wall swivels up on top hinge → becomes ceiling
 *   floor_slide:     Floor panel slides outward from container body
 *   walls_deploy:    Side walls scale up from floor (like railings deploying)
 *   reverse:         Plays the entry animation in reverse
 */

import type { UnpackPhase } from '@/types/container';

/**
 * Given the current phase that just completed, return the next phase in sequence.
 * Returns undefined if the animation sequence is complete.
 *
 * Phase chains:
 *   wall_to_floor → done (deck mode: just the floor unfolds)
 *   wall_to_ceiling → done (interior mode: ceiling unfolds, support poles appear)
 *   floor_slide → walls_deploy → done (future: combined ceiling+floor+walls)
 *   walls_deploy → done
 *   reverse → done
 */
export function getNextPhase(completedPhase: UnpackPhase): UnpackPhase | undefined {
  switch (completedPhase) {
    case 'wall_to_floor':
      return undefined; // Deck unpack complete
    case 'wall_to_ceiling':
      return undefined; // Interior ceiling unpack complete
    case 'floor_slide':
      return 'walls_deploy'; // After floor slides out, deploy side walls
    case 'walls_deploy':
      return undefined; // Full sequence complete
    case 'reverse':
      return undefined; // Reverse complete
    default:
      return undefined;
  }
}

/** Duration hints for each animation phase (seconds). Used for stagger delays. */
export const PHASE_DURATIONS: Record<UnpackPhase, number> = {
  wall_to_floor: 0.6,
  wall_to_ceiling: 0.6,
  floor_slide: 0.5,
  walls_deploy: 0.4,
  reverse: 0.5,
};

/** Damp speed for each phase — lower = more cinematic, higher = snappier */
export const PHASE_DAMP_SPEED: Record<UnpackPhase, number> = {
  wall_to_floor: 4.5,
  wall_to_ceiling: 4.5,
  floor_slide: 5.0,
  walls_deploy: 6.0,
  reverse: 5.5,
};

// ── Element-specific animation speeds ────────────────────────

/** Stair telescope: top-anchored, treads extend downward */
export const STAIR_TELESCOPE_SPEED = 4.0;
export const STAIR_TELESCOPE_EXIT_SPEED = 5.0;

/** Railing fold: rotates up from floor edge */
export const RAILING_FOLD_SPEED = 5.0;
export const RAILING_FOLD_EXIT_SPEED = 5.5;

/** Pillar fold: swings down from ceiling attachment */
export const PILLAR_FOLD_SPEED = 4.5;
export const PILLAR_FOLD_EXIT_SPEED = 5.0;

// ── Exit animation durations (ms) for useExitAnimation timeouts ──

export const STAIR_EXIT_DURATION = 500;
export const RAILING_EXIT_DURATION = 400;
export const PILLAR_EXIT_DURATION = 450;
