"use client";

import { Canvas } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import * as THREE from "three";
import { Component, type ReactNode, Suspense, useCallback } from "react";
import Scene from "./Scene";
import { useStore } from "@/store/useStore";
import "@/utils/bvhSetup";

// ── ErrorBoundary ─────────────────────────────────────────────
interface EBState { error: Error | null }

class SceneErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error): EBState { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[CanvasErrorBoundary] R3F crash caught:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      const err = this.state.error;
      return (
        <div style={{ position: "absolute", inset: 0, zIndex: 99999, display: "flex", flexDirection: "column", padding: "32px", overflow: "auto", background: "rgba(127,29,29,0.97)", color: "#fecaca", fontFamily: "ui-monospace, monospace", fontSize: "13px", lineHeight: 1.6 }}>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>R3F Canvas Crash</div>
          <div style={{ padding: "12px 16px", borderRadius: "6px", background: "rgba(0,0,0,0.4)", marginBottom: "12px", fontSize: "14px", fontWeight: 600, color: "#fca5a5", wordBreak: "break-word" }}>{err.message}</div>
          <pre style={{ flex: 1, padding: "12px 16px", borderRadius: "6px", background: "rgba(0,0,0,0.35)", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "11px", color: "#fecaca", opacity: 0.85 }}>{err.stack}</pre>
          <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
            <button onClick={() => this.setState({ error: null })} style={{ padding: "10px 24px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>Retry Render</button>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ padding: "10px 24px", background: "#1e40af", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>Reset &amp; Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── SceneCanvas ───────────────────────────────────────────────
// ARCHITECTURE NOTE (for future self):
// - preserveDrawingBuffer MUST stay false (default). Setting it true breaks
//   Intel Iris Xe double-buffering → blue flicker.
// - Do NOT add gl.autoClear=false or gl.clear() interception. Three.js draws
//   scene.background as a fullscreen QUAD (draw call), not via gl.clear().
//   Intercepting clears has no effect on the background color.
// - EffectComposer at priority 1 suppresses R3F's default render. The scene
//   is rendered ONCE into EffectComposer's FBO, processed, then output to screen.
// - onCreated sets scene.background to a neutral ground-matching color so the
//   very first frames (before SkyDome mounts) don't flash jarring blue.
// - Camera bounds (cameraConstants.ts + CameraFloorGuard in Scene.tsx) are the
//   defense against excessive sky visibility, not rendering hacks.

/**
 * Initial scene background — neutral dark green that blends with the ground plane.
 * Set in onCreated so the very first frame before SkyDome mounts shows green (ground),
 * not the WebGL default black or a jarring blue. SkyDome overwrites this on its
 * first render with the time-appropriate sky color.
 */
const INITIAL_BG = new THREE.Color(0x2a4a20);

export default function SceneCanvas() {
  const activeBrush = useStore((s) => s.activeBrush);
  const activeSlot = useStore((s) => s.activeHotbarSlot);
  const cursor = (activeBrush || activeSlot !== null) ? 'crosshair' : 'default';

  const onCreated = useCallback((state: RootState) => {
    // Set a neutral initial background before SkyDome takes over.
    // Without this, the canvas shows WebGL's default clear color (black/transparent)
    // or, after SkyDome mounts, flashes blue (0x5b8fbf) before geometry renders.
    state.scene.background = INITIAL_BG;
  }, []);

  return (
    <SceneErrorBoundary>
      <div data-testid="canvas-3d" style={{ width: "100%", height: "100%" }}>
      <Canvas
        frameloop="always"
        shadows={{ type: THREE.PCFSoftShadowMap }}
        camera={{
          position: [14, 5, 14],
          fov: 48,
          near: 0.1,
          far: 500,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.NoToneMapping,
          toneMappingExposure: 1.0,
        }}
        onCreated={onCreated}
        onPointerMissed={() => {
          const s = useStore.getState();
          s.setHoveredVoxel(null);
          s.setHoveredVoxelEdge(null);
          s.setFaceContext(null);
          s.setSelectedFace(null);
          s.setSelectedVoxel(null);
          s.setSelectedVoxels(null);
          s.setFacePreview(null);
          document.body.style.cursor = 'auto';
        }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ width: "100%", height: "100%", touchAction: "none", cursor }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      </div>
    </SceneErrorBoundary>
  );
}
