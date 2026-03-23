"use client";

import React, { Component, type ReactNode, useMemo } from 'react';
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
import { useStore } from '@/store/useStore';
import { QUALITY_PRESETS } from '@/config/qualityPresets';
import { getStyle } from '@/config/styleRegistry';
import type { StyleEffect } from '@/types/sceneObject';

// ── ErrorBoundary ────────────────────────────────────────────
// If EffectComposer causes GL context loss, disable gracefully
// rather than crashing the entire scene tree.
interface EBState { failed: boolean }

class PostProcessingBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { failed: false };
  static getDerivedStateFromError(): EBState { return { failed: true }; }
  componentDidCatch(error: Error) {
    console.warn('[PostProcessingStack] EffectComposer failed, disabling post-processing:', error.message);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

// ── N8AO config ──────────────────────────────────────────────
const N8AO_CONFIG = {
  aoRadius: 0.8,
  intensity: 1.0,
  distanceFalloff: 1.5,
} as const;

const BLOOM_CONFIG = {
  luminanceThreshold: 0.85,
  luminanceSmoothing: 0.1,
  mipmapBlur: true,
} as const;

// ── Style effect helpers ─────────────────────────────────────

function hasEffect(effects: StyleEffect[], type: string): boolean {
  return effects.some((e) => e.type === type);
}

function findEffect(effects: StyleEffect[], type: string): StyleEffect | undefined {
  return effects.find((e) => e.type === type);
}

// Stable empty array to avoid re-renders when no style effects are active
const EMPTY_EFFECTS: StyleEffect[] = [];

// ── Effects (reads quality preset + active style from store) ─
function PostProcessingEffects() {
  const qualityPreset = useStore((s) => s.qualityPreset);
  const activeStyle = useStore((s) => s.activeStyle);
  const config = QUALITY_PRESETS[qualityPreset];

  if (!config.postProcessing) return null;

  const style = getStyle(activeStyle);
  const effects = style?.effects ?? EMPTY_EFFECTS;

  // Detect active postprocessing style effects
  const hasSaltFrost = hasEffect(effects, 'salt_frost');
  const hasSoftBloom = hasEffect(effects, 'soft_bloom');
  const hasEdgeGlow = hasEffect(effects, 'edge_glow');

  // soft_bloom: lower luminance threshold so light fixtures bloom more visibly
  const bloomThreshold = hasSoftBloom ? 0.5 : BLOOM_CONFIG.luminanceThreshold;
  const bloomSmoothing = hasSoftBloom ? 0.3 : BLOOM_CONFIG.luminanceSmoothing;
  const bloomIntensity = hasSoftBloom ? 1.5 : 1.0;

  // edge_glow: outline color from effect definition
  const edgeGlowEffect = findEffect(effects, 'edge_glow');
  const edgeGlowColor = useMemo(
    () => new THREE.Color(edgeGlowEffect?.color ?? '#00ff88'),
    [edgeGlowEffect?.color],
  );

  // salt_frost: frosty white-blue outline + desaturation
  const saltFrostEffect = findEffect(effects, 'salt_frost');
  const saltFrostColor = useMemo(
    () => new THREE.Color(saltFrostEffect?.color ?? '#a8d8ff'),
    [saltFrostEffect?.color],
  );

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
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={bloomSmoothing}
        intensity={bloomIntensity}
        mipmapBlur
      />,
    );
  }

  // salt_frost — frosty desaturation + brightness boost
  if (hasSaltFrost) {
    children.push(
      <HueSaturation key="frost-hue" saturation={-(saltFrostEffect?.intensity ?? 0.3)} />,
      <BrightnessContrast key="frost-bc" brightness={0.06} contrast={0.04} />,
      // White-blue edge outline on selectionLayer 11
      <Outline
        key="frost-outline"
        edgeStrength={2.5}
        visibleEdgeColor={saltFrostColor as unknown as number}
        hiddenEdgeColor={0x000000}
        blur
        xRay={false}
        selectionLayer={11}
      />,
    );
  }

  // edge_glow — colored outline on selectionLayer 12
  if (hasEdgeGlow) {
    children.push(
      <Outline
        key="edge-outline"
        edgeStrength={4.0}
        visibleEdgeColor={edgeGlowColor as unknown as number}
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
      <PostProcessingEffects />
    </PostProcessingBoundary>
  );
}
