/**
 * webXR.ts — Minimal WebXR (immersive-vr) integration for the existing R3F
 * scene. Enables `renderer.xr.enabled` and exposes start/end-session helpers.
 *
 * V1 scope: head-tracked observation. The user sees the design in VR with
 * head movement, but cannot move the camera (no locomotion). Locomotion
 * via controllers + teleport is a follow-up — would require @react-three/xr
 * or hand-rolled XR controller pose handling.
 */

import * as THREE from 'three';

/** Returns true if the browser supports WebXR + an immersive-vr session. */
export async function isVRSupported(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('xr' in navigator)) return false;
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  if (!xr) return false;
  try {
    return await xr.isSessionSupported('immersive-vr');
  } catch {
    return false;
  }
}

/** Lazily upgrade the renderer for XR. Idempotent — safe to call repeatedly. */
function enableRendererXR(renderer: THREE.WebGLRenderer): void {
  if (!renderer.xr.enabled) {
    renderer.xr.enabled = true;
  }
}

/** Start an immersive-vr session using the current renderer. Returns the
 *  session, or null on failure. */
export async function enterVR(): Promise<XRSession | null> {
  if (typeof window === 'undefined') return null;
  const renderer = (window as unknown as { __threeRenderer?: THREE.WebGLRenderer }).__threeRenderer;
  if (!renderer) {
    alert('Renderer not ready yet — try again in a moment.');
    return null;
  }
  if (!(await isVRSupported())) {
    alert('Your browser/device does not support WebXR immersive-vr. Try Chrome/Edge with a Quest or other XR headset.');
    return null;
  }
  enableRendererXR(renderer);
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr!;
  try {
    const session = await xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    });
    await renderer.xr.setSession(session);
    return session;
  } catch (e) {
    alert(`Failed to start VR session: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** End the active VR session, if any. */
export async function exitVR(): Promise<void> {
  if (typeof window === 'undefined') return;
  const renderer = (window as unknown as { __threeRenderer?: THREE.WebGLRenderer }).__threeRenderer;
  const session = renderer?.xr?.getSession?.();
  if (session) await session.end();
}
