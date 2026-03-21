"use client";

import { Component, type ReactNode } from 'react';
import { EffectComposer, N8AO, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useStore } from '@/store/useStore';
import { QUALITY_PRESETS } from '@/config/qualityPresets';

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

// ── Effects (reads quality preset from store) ────────────────
function PostProcessingEffects() {
  const qualityPreset = useStore((s) => s.qualityPreset);
  const config = QUALITY_PRESETS[qualityPreset];

  if (!config.postProcessing) return null;

  const aoProps = { ...N8AO_CONFIG, quality: config.aoHalfRes ? 'medium' as const : 'high' as const, halfRes: config.aoHalfRes };

  if (config.bloomEnabled) {
    return (
      <EffectComposer>
        <N8AO {...aoProps} />
        <Bloom {...BLOOM_CONFIG} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer>
      <N8AO {...aoProps} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

// ── Public component ─────────────────────────────────────────
export default function PostProcessingStack() {
  return (
    <PostProcessingBoundary>
      <PostProcessingEffects />
    </PostProcessingBoundary>
  );
}
