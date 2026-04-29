"use client";

/**
 * XRLocomotion.tsx — Thumbstick-driven movement during an active WebXR
 * session. Mounted inside the R3F Canvas so it has access to the renderer's
 * XR camera. When a session is active and an input source has a gamepad
 * with a thumbstick, deflection translates the camera across the floor.
 *
 * No new npm deps — uses the WebXR Device API directly via the renderer
 * exposed at `window.__threeRenderer`.
 *
 * Limitations vs. @react-three/xr:
 *   • No teleport, no controller models, no hand mesh.
 *   • No snap-turn (right-stick rotation is not implemented).
 *   • Movement is in head-direction, not chest-direction.
 * These are scoped follow-ups; for V1 head-relative thumbstick smooth
 * locomotion is enough to actually walk through the design.
 */

import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const SPEED_MPS = 1.6; // walk speed
const DEAD_ZONE = 0.15;

export default function XRLocomotion() {
  const { gl, camera } = useThree();
  // Reusable working vectors so useFrame doesn't allocate per tick
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  useFrame((_, dt) => {
    // Only active during an XR session
    const session = gl.xr.getSession?.();
    if (!session) return;
    const sources = session.inputSources;
    if (!sources || sources.length === 0) return;

    let ax = 0;
    let ay = 0;
    for (const src of sources) {
      const gp = src.gamepad;
      if (!gp || !gp.axes) continue;
      // Conventional Quest mapping: axes[2] = X, axes[3] = Y on the thumbstick
      const sx = gp.axes[2] ?? gp.axes[0] ?? 0;
      const sy = gp.axes[3] ?? gp.axes[1] ?? 0;
      if (Math.hypot(sx, sy) > DEAD_ZONE) {
        ax = sx;
        ay = sy;
        break; // first stick wins
      }
    }
    if (ax === 0 && ay === 0) return;

    // Compute head-relative forward / right vectors flattened to floor
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    right.crossVectors(fwd, up).normalize();

    // Translate the camera (negative Y on thumbstick = forward)
    const distance = SPEED_MPS * dt;
    camera.position.addScaledVector(fwd, -ay * distance);
    camera.position.addScaledVector(right, ax * distance);
  });

  return null;
}
