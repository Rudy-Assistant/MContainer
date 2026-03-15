/**
 * GLB Export Utility
 *
 * Exposes window.__exportGLB for use from UI components outside the Canvas.
 * The SceneExporter component (mounted inside Canvas) sets up the scene reference.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

let _scene: THREE.Scene | null = null;

/** Called from SceneExporter inside the R3F Canvas */
export function setExportScene(scene: THREE.Scene) {
  _scene = scene;
}

/** Export the current 3D scene as a downloadable .glb file */
export async function exportSceneToGLB(): Promise<boolean> {
  if (!_scene) {
    console.warn('[exportGLB] No scene registered');
    return false;
  }

  const exporter = new GLTFExporter();

  try {
    const result = await exporter.parseAsync(_scene, { binary: true });
    const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moduhome-export-${Date.now()}.glb`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('[exportGLB] Export failed:', err);
    return false;
  }
}

// Expose on window for Playwright testing
if (typeof window !== 'undefined') {
  (window as any).__exportGLB = exportSceneToGLB;
}
