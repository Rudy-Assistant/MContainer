"use client";

import { Component, type ReactNode, Suspense, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { useStore } from "@/store/useStore";
import { GROUND_PRESETS, DEFAULT_GROUND_PRESET, type GroundPresetId } from "@/config/groundPresets";
import { nullRaycast } from '@/utils/nullRaycast';

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

const DISP_SIZE = 512;
const DISP_SEED = 42;
const TWO_PI = Math.PI * 2;

const _displacementTex = (() => {
  const data = new Uint8Array(DISP_SIZE * DISP_SIZE);
  for (let y = 0; y < DISP_SIZE; y++) {
    for (let x = 0; x < DISP_SIZE; x++) {
      const nx = x / DISP_SIZE, ny = y / DISP_SIZE;
      const v =
        0.45 * Math.sin(nx * TWO_PI * 2 + DISP_SEED) * Math.cos(ny * TWO_PI * 2) +
        0.22 * Math.sin(nx * TWO_PI * 4 + DISP_SEED * 1.3) * Math.cos(ny * TWO_PI * 3) +
        0.12 * Math.sin(nx * TWO_PI * 8 + DISP_SEED * 0.7) * Math.cos(ny * TWO_PI * 7) +
        0.08 * Math.sin(nx * TWO_PI * 16) * Math.cos(ny * TWO_PI * 14 + DISP_SEED) +
        0.05 * Math.sin(nx * TWO_PI * 32 + 1.7) * Math.cos(ny * TWO_PI * 28 + DISP_SEED * 0.3) +
        0.03 * Math.sin(nx * TWO_PI * 64 + 2.1) * Math.cos(ny * TWO_PI * 48);
      data[y * DISP_SIZE + x] = Math.floor(((v + 1) / 2) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, DISP_SIZE, DISP_SIZE, THREE.RedFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
})();

// Random UV rotation angle per session — breaks visible tiling pattern
const _uvRotAngle = Math.random() * Math.PI * 0.25; // 0–45° random rotation

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
    <mesh rotation={GROUND_ROTATION} position={GROUND_POSITION} receiveShadow raycast={nullRaycast}>
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

  // Load core textures + optional displacement/AO when preset specifies them
  const texPaths: Record<string, string> = useMemo(() => {
    const paths: Record<string, string> = {
      map: `${base}/${preset.colorFile ?? 'color.jpg'}`,
      normalMap: `${base}/${preset.normalFile ?? 'normal.jpg'}`,
      roughnessMap: `${base}/${preset.roughnessFile ?? 'roughness.jpg'}`,
    };
    if (preset.displacementFile) paths.displacementMap = `${base}/${preset.displacementFile}`;
    if (preset.aoFile) paths.aoMap = `${base}/${preset.aoFile}`;
    return paths;
  }, [base, preset.colorFile, preset.normalFile, preset.roughnessFile, preset.displacementFile, preset.aoFile]);

  const rawTextures = useTexture(texPaths);

  // Configure textures once per preset change (not every render)
  const textures = useMemo(() => {
    for (const tex of Object.values(rawTextures) as THREE.Texture[]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(preset.repeatX, preset.repeatY);
      // Apply random UV rotation to break visible tiling
      tex.rotation = _uvRotAngle;
      tex.center.set(0.5, 0.5);
      tex.anisotropy = 8; // Higher anisotropy for oblique viewing
      tex.needsUpdate = true;
    }
    (rawTextures.map as THREE.Texture).colorSpace = THREE.SRGBColorSpace;
    return rawTextures;
  }, [rawTextures, preset.repeatX, preset.repeatY]);

  const normalScale = useMemo(
    () => new THREE.Vector2(preset.normalScale, preset.normalScale),
    [preset.normalScale],
  );

  const dispMap = (textures.displacementMap as THREE.Texture | undefined) ?? _displacementTex;
  const aoMap = textures.aoMap as THREE.Texture | undefined;

  return (
    <mesh rotation={GROUND_ROTATION} position={GROUND_POSITION} receiveShadow raycast={nullRaycast}>
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
        aoMap={aoMap}
        aoMapIntensity={aoMap ? 0.6 : 0}
        displacementMap={dispMap ?? _displacementTex}
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
