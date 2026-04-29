"use client";

import React, { Component, type ReactNode, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import {
  EffectComposer,
  N8AO,
  Bloom,
  ToneMapping,
  Outline,
  HueSaturation,
  BrightnessContrast,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useThree } from '@react-three/fiber';
import { useStore } from '@/store/useStore';
import { QUALITY_PRESETS } from '@/config/qualityPresets';
import { getStyle } from '@/config/styleRegistry';
import type { StyleEffect } from '@/types/sceneObject';

// ── ErrorBoundary ────────────────────────────────────────────
// If EffectComposer causes GL context loss, retry on the next render
// rather than disabling permanently. Context loss is recoverable in
// modern browsers — the GPU process restarts, the canvas raises
// `webglcontextrestored`, and a retry-on-mount gives us a clean composer.
interface EBState { failed: boolean; attempt: number }

class PostProcessingBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { failed: false, attempt: 0 };
  static getDerivedStateFromError(): Partial<EBState> { return { failed: true }; }
  componentDidCatch(error: Error) {
    console.warn(
      `[PostProcessingStack] EffectComposer failed (attempt ${this.state.attempt + 1}):`,
      error.message,
    );
    // Retry once after a frame — handles transient context-attribute races
    // where the renderer is mid-initialization the first time we mount.
    if (this.state.attempt < 1) {
      requestAnimationFrame(() => {
        this.setState({ failed: false, attempt: this.state.attempt + 1 });
      });
    }
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/**
 * RendererReadyGate — defers child mount until the WebGL context is fully
 * initialized AND not lost. Without this, EffectComposer can read
 * `renderer.getContext().getContextAttributes()` while the underlying
 * context is still null, throwing "Cannot read properties of null
 * (reading 'alpha')" — verified bug in postprocessing v6.x against
 * @react-three/postprocessing v3.0.4.
 */
function RendererReadyGate({ children }: { children: ReactNode }) {
  const gl = useThree((s) => s.gl);
  const [ready, setReady] = useState(() => {
    // Best-effort sync check on first render
    try {
      const ctx = gl.getContext();
      const attrs = ctx?.getContextAttributes?.();
      return !!attrs && !ctx.isContextLost();
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    const tryReady = () => {
      if (cancelled) return;
      try {
        const ctx = gl.getContext();
        const attrs = ctx?.getContextAttributes?.();
        if (attrs && !ctx.isContextLost()) {
          setReady(true);
          return;
        }
      } catch { /* keep polling */ }
      requestAnimationFrame(tryReady);
    };
    requestAnimationFrame(tryReady);

    // Also recover from context loss/restored at runtime
    const canvas = gl.domElement;
    const onLost = (e: Event) => { e.preventDefault(); setReady(false); };
    const onRestored = () => setReady(true);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      cancelled = true;
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [ready, gl]);

  if (!ready) return null;
  return <>{children}</>;
}

// ── N8AO config ──────────────────────────────────────────────
const N8AO_CONFIG = {
  aoRadius: 0.8,
  intensity: 1.0,
  distanceFalloff: 1.5,
} as const;

export const BLOOM_CONFIG = {
  luminanceThreshold: 1.18,
  luminanceSmoothing: 0.06,
  intensity: 0.18,
  mipmapBlur: true,
} as const;

export function getBloomSettings(hasSoftBloom: boolean) {
  return {
    luminanceThreshold: hasSoftBloom ? 0.98 : BLOOM_CONFIG.luminanceThreshold,
    luminanceSmoothing: hasSoftBloom ? 0.12 : BLOOM_CONFIG.luminanceSmoothing,
    intensity: hasSoftBloom ? 0.32 : BLOOM_CONFIG.intensity,
  };
}

// Stable empty array to avoid re-renders when no style effects are active
const EMPTY_EFFECTS: StyleEffect[] = [];

// ── Effects (reads quality preset + active style from store) ─
function PostProcessingEffects() {
  const qualityPreset = useStore((s) => s.qualityPreset);
  const activeStyle = useStore((s) => s.activeStyle);
  const config = QUALITY_PRESETS[qualityPreset];

  const style = getStyle(activeStyle);
  const effects = style?.effects ?? EMPTY_EFFECTS;

  // Find active postprocessing effects (single traversal each, ≤3 effects per style)
  const saltFrostEffect = effects.find((e) => e.type === 'salt_frost');
  const softBloomEffect = effects.find((e) => e.type === 'soft_bloom');
  const edgeGlowEffect = effects.find((e) => e.type === 'edge_glow');

  // soft_bloom: allow light fixtures to glow without washing out the sky.
  const bloomSettings = getBloomSettings(!!softBloomEffect);

  // edge_glow: outline color from effect definition (memoize to avoid new Color per render)
  const edgeGlowColor = useMemo(
    () => edgeGlowEffect ? new THREE.Color(edgeGlowEffect.color ?? '#00ff88') : null,
    [edgeGlowEffect],
  );

  // salt_frost: frosty white-blue outline + desaturation
  const saltFrostColor = useMemo(
    () => saltFrostEffect ? new THREE.Color(saltFrostEffect.color ?? '#a8d8ff') : null,
    [saltFrostEffect],
  );

  // Early return AFTER all hooks to avoid "fewer hooks" error
  if (!config.postProcessing) return null;

  const aoProps = {
    ...N8AO_CONFIG,
    quality: config.aoHalfRes ? 'medium' as const : 'high' as const,
    halfRes: config.aoHalfRes,
  };

  // Build effect list dynamically — EffectComposer requires direct Element children
  // (no conditional `false` values), so we collect into an array.
  const children: React.ReactElement[] = [
    <N8AO key="ao" {...aoProps} />,
  ];

  if (config.bloomEnabled) {
    children.push(
      <Bloom
        key="bloom"
        luminanceThreshold={bloomSettings.luminanceThreshold}
        luminanceSmoothing={bloomSettings.luminanceSmoothing}
        intensity={bloomSettings.intensity}
        mipmapBlur
      />,
    );
  }

  // salt_frost — frosty desaturation + brightness boost
  if (saltFrostEffect && saltFrostColor) {
    children.push(
      <HueSaturation key="frost-hue" saturation={-(saltFrostEffect.intensity ?? 0.3)} />,
      <BrightnessContrast key="frost-bc" brightness={0.06} contrast={0.04} />,
      // White-blue edge outline on selectionLayer 11
      <Outline
        key="frost-outline"
        edgeStrength={2.5}
        visibleEdgeColor={saltFrostColor.getHex()}
        hiddenEdgeColor={0x000000}
        blur
        xRay={false}
        selectionLayer={11}
      />,
    );
  }

  // edge_glow — colored outline on selectionLayer 12
  if (edgeGlowEffect && edgeGlowColor) {
    children.push(
      <Outline
        key="edge-outline"
        edgeStrength={4.0}
        visibleEdgeColor={edgeGlowColor.getHex()}
        hiddenEdgeColor={0x000000}
        blur
        xRay={false}
        pulseSpeed={0.4}
        selectionLayer={12}
      />,
    );
  }

  children.push(
    <ToneMapping key="tonemap" mode={ToneMappingMode.ACES_FILMIC} />,
  );

  return <EffectComposer>{children}</EffectComposer>;
}

// ── Public component ─────────────────────────────────────────
export default function PostProcessingStack() {
  return (
    <PostProcessingBoundary>
      <RendererReadyGate>
        <PostProcessingEffects />
      </RendererReadyGate>
    </PostProcessingBoundary>
  );
}
