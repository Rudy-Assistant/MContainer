"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Component, type ReactNode, Suspense } from "react";
import Scene from "./Scene";
import { useStore } from "@/store/useStore";
import "@/utils/bvhSetup";

// ── ErrorBoundary ─────────────────────────────────────────────
// Catches any runtime exception from Three.js/R3F and shows a safe
// fallback instead of a white screen.

interface EBState { error: Error | null }

class SceneErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // eslint-disable-next-line no-console
    console.error("[CanvasErrorBoundary] R3F crash caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const err = this.state.error;
      return (
        <div style={{
          position: "absolute", inset: 0, zIndex: 99999,
          display: "flex", flexDirection: "column",
          padding: "32px", overflow: "auto",
          background: "rgba(127,29,29,0.97)", color: "#fecaca",
          fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
          fontSize: "13px", lineHeight: 1.6,
        }}>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
            R3F Canvas Crash
          </div>
          <div style={{
            padding: "12px 16px", borderRadius: "6px",
            background: "rgba(0,0,0,0.4)", marginBottom: "12px",
            fontSize: "14px", fontWeight: 600, color: "#fca5a5",
            wordBreak: "break-word",
          }}>
            {err.message}
          </div>
          <pre style={{
            flex: 1, padding: "12px 16px", borderRadius: "6px",
            background: "rgba(0,0,0,0.35)", overflow: "auto",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            fontSize: "11px", color: "#fecaca", opacity: 0.85,
          }}>
            {err.stack}
          </pre>
          <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
            <button
              onClick={() => this.setState({ error: null })}
              style={{
                padding: "10px 24px", background: "#dc2626", color: "#fff",
                border: "none", borderRadius: "6px", cursor: "pointer",
                fontSize: "13px", fontWeight: 600,
              }}
            >
              Retry Render
            </button>
            <button
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{
                padding: "10px 24px", background: "#1e40af", color: "#fff",
                border: "none", borderRadius: "6px", cursor: "pointer",
                fontSize: "13px", fontWeight: 600,
              }}
            >
              Reset &amp; Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── SceneCanvas ───────────────────────────────────────────────

export default function SceneCanvas() {
  const activeBrush = useStore((s) => s.activeBrush);
  const activeSlot = useStore((s) => s.activeHotbarSlot);
  const cursor = (activeBrush || activeSlot !== null) ? 'crosshair' : 'default';

  return (
    <SceneErrorBoundary>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        camera={{
          position: [14, 5, 14],  // human-scale perspective — shows long wall + roof
          fov: 48,
          near: 0.1,
          far: 500,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.NoToneMapping,
          toneMappingExposure: 1.0,
        }}
        onPointerMissed={() => {
          const s = useStore.getState();
          s.setHoveredVoxel(null);
          s.setHoveredVoxelEdge(null);
          s.setFaceContext(null);
          s.setSelectedFace(null);
          s.setSelectedVoxel(null);
          document.body.style.cursor = 'auto';
        }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ width: "100%", height: "100%", touchAction: "none", cursor }}
      >
        {/* Scene components may suspend (e.g. Text font loading) — catch with fallback */}
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </SceneErrorBoundary>
  );
}
