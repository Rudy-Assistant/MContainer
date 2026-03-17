"use client";

import { Component, type ReactNode, Suspense, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { useStore } from "@/store/useStore";
import { GROUND_PRESETS, DEFAULT_GROUND_PRESET, type GroundPresetId } from "@/config/groundPresets";

// ── ErrorBoundary ──────────────────────────────────────────
// useTexture throws Error on 404 (not Promise) — Suspense can't catch it.

interface EBState { hasError: boolean }

class GroundTextureBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  EBState
> {
  state: EBState = { hasError: false };

  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[GroundManager] Texture load failed, using fallback:", error.message);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ── Shared geometry ────────────────────────────────────────

const GROUND_SIZE = 200;
const GROUND_SEGMENTS = 128;
const GROUND_Y = -0.01;
const GROUND_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];
const GROUND_POSITION: [number, number, number] = [0, GROUND_Y, 0];

// ── Procedural displacement texture (module-level singleton) ──

const DISP_SIZE = 256;
const DISP_SEED = 42;
const TWO_PI = Math.PI * 2;

const _displacementTex = (() => {
  const data = new Uint8Array(DISP_SIZE * DISP_SIZE);
  for (let y = 0; y < DISP_SIZE; y++) {
    for (let x = 0; x < DISP_SIZE; x++) {
      const nx = x / DISP_SIZE, ny = y / DISP_SIZE;
      const v =
        0.5  * Math.sin(nx * TWO_PI * 2 + DISP_SEED) * Math.cos(ny * TWO_PI * 2) +
        0.25 * Math.sin(nx * TWO_PI * 4 + DISP_SEED * 1.3) * Math.cos(ny * TWO_PI * 3) +
        0.12 * Math.sin(nx * TWO_PI * 8 + DISP_SEED * 0.7) * Math.cos(ny * TWO_PI * 7) +
        0.06 * Math.sin(nx * TWO_PI * 16) * Math.cos(ny * TWO_PI * 14 + DISP_SEED);
      data[y * DISP_SIZE + x] = Math.floor(((v + 1) / 2) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, DISP_SIZE, DISP_SIZE, THREE.RedFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
})();

// ── Fallback (solid color, no textures) ────────────────────

function GroundFallback({ presetId }: { presetId: GroundPresetId }) {
  const preset = GROUND_PRESETS[presetId];
  useEffect(() => {
    console.warn(
      `[GroundManager] Texture load failed for preset "${presetId}". ` +
      `Falling back to solid color. Check that texture files exist at ` +
      `public/assets/materials/${preset.folder}/`
    );
  }, [presetId, preset.folder]);
  return (
    <mesh rotation={GROUND_ROTATION} position={GROUND_POSITION} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE, GROUND_SEGMENTS, GROUND_SEGMENTS]} />
      <meshStandardMaterial
        color={preset.color}
        roughness={preset.roughness}
        metalness={0}
        envMapIntensity={preset.envMapIntensity}
        displacementMap={_displacementTex}
        displacementScale={preset.displacementScale}
        displacementBias={-preset.displacementScale * 0.3}
      />
    </mesh>
  );
}

// ── Textured ground (suspends while loading) ───────────────

function TexturedGround({ presetId }: { presetId: GroundPresetId }) {
  const preset = GROUND_PRESETS[presetId];
  const base = `/assets/materials/${preset.folder}`;

  const rawTextures = useTexture({
    map: `${base}/color.jpg`,
    normalMap: `${base}/normal.jpg`,
    roughnessMap: `${base}/roughness.jpg`,
  });

  // Configure textures once per preset change (not every render)
  const textures = useMemo(() => {
    for (const tex of Object.values(rawTextures) as THREE.Texture[]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(preset.repeatX, preset.repeatY);
      tex.anisotropy = 4;
      tex.needsUpdate = true;
    }
    (rawTextures.map as THREE.Texture).colorSpace = THREE.SRGBColorSpace;
    return rawTextures;
  }, [rawTextures, preset.repeatX, preset.repeatY]);

  const normalScale = useMemo(
    () => new THREE.Vector2(preset.normalScale, preset.normalScale),
    [preset.normalScale],
  );

  return (
    <mesh rotation={GROUND_ROTATION} position={GROUND_POSITION} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE, GROUND_SEGMENTS, GROUND_SEGMENTS]} />
      <meshStandardMaterial
        map={textures.map as THREE.Texture}
        normalMap={textures.normalMap as THREE.Texture}
        normalScale={normalScale}
        roughnessMap={textures.roughnessMap as THREE.Texture}
        roughness={1.0}
        metalness={0}
        envMapIntensity={preset.envMapIntensity}
        color={preset.tint ?? 0xffffff}
        displacementMap={_displacementTex}
        displacementScale={preset.displacementScale}
        displacementBias={-preset.displacementScale * 0.3}
      />
    </mesh>
  );
}

// ── GroundManager ──────────────────────────────────────────

export default function GroundManager() {
  const rawPreset = useStore((s) => s.environment.groundPreset);

  const presetId = (rawPreset && rawPreset in GROUND_PRESETS
    ? rawPreset
    : DEFAULT_GROUND_PRESET) as GroundPresetId;

  const fallback = <GroundFallback presetId={presetId} />;

  return (
    <GroundTextureBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <TexturedGround presetId={presetId} />
      </Suspense>
    </GroundTextureBoundary>
  );
}
