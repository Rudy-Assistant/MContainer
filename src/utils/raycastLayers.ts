/**
 * RAYCAST LAYER SYSTEM
 *
 * Prevents geometry occlusion by separating interactive and non-interactive meshes.
 * Layer 0: Non-interactive (containers, roofs, helpers)
 * Layer 1: Interactive (floors, walls, edges, furniture)
 */

import * as THREE from 'three';

export const RAYCAST_LAYERS = {
  IGNORE: 0,        // Container bodies, roofs, helper volumes
  INTERACTABLE: 1,  // Floor panels, wall panels, edges, furniture
} as const;

/**
 * Configure a mesh to be interactive (Layer 1)
 */
export function makeInteractable(mesh: THREE.Mesh | THREE.Group) {
  mesh.layers.disableAll();
  mesh.layers.enable(RAYCAST_LAYERS.INTERACTABLE);

  // Recursively apply to children
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
      child.layers.disableAll();
      child.layers.enable(RAYCAST_LAYERS.INTERACTABLE);
    }
  });
}

/**
 * Configure a mesh to be non-interactive (Layer 0)
 */
export function makeNonInteractable(mesh: THREE.Mesh | THREE.Group) {
  mesh.layers.disableAll();
  mesh.layers.enable(RAYCAST_LAYERS.IGNORE);

  // Recursively apply to children
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
      child.layers.disableAll();
      child.layers.enable(RAYCAST_LAYERS.IGNORE);
    }
  });
}

/**
 * Configure a raycaster to only check interactive layer
 */
export function configureRaycasterForInteraction(raycaster: THREE.Raycaster) {
  raycaster.layers.disableAll();
  raycaster.layers.enable(RAYCAST_LAYERS.INTERACTABLE);
}
