"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { setExportScene } from "@/utils/exportGLB";
import {
  CameraControls,
  OrbitControls,
  Sky,
  Environment,
  Stars,
  ContactShadows,
  Clouds,
  Cloud,
  Html,
  GizmoHelper,
  GizmoViewport,
} from "@react-three/drei";
import type CameraControlsImpl from "camera-controls";
import { useStore } from "@/store/useStore";
import { ViewMode, CONTAINER_DIMENSIONS, type Container } from "@/types/container";
import { createDefaultVoxelGrid } from "@/types/factories";
import { findStackTarget, findEdgeSnap, checkOverlap, getFootprintAt, computePoolUnion } from "@/store/spatialEngine";
import ContainerMesh from "./ContainerMesh";
import ContainerSkin from "@/components/objects/ContainerSkin";
import BlueprintRenderer from "./BlueprintRenderer";
import CameraController from "./CameraController";
import WalkthroughControls from "./WalkthroughControls";
import SharedWalls from "./SharedWallMesh";
import { useInputHandler } from "@/hooks/useInputHandler";
import { RAYCAST_LAYERS } from "@/utils/raycastLayers";
import { useFrameStore } from "@/store/frameStore";
import FrameBuilder from "./FrameBuilder";
import TapeMeasure from "./TapeMeasure";
import { DevSceneExpose } from "./DevSceneExpose";
import { EffectComposer, N8AO, Bloom, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import {
  loadAllTextures,
  getSteelTextures,
  getWoodTextures,
  applyTexturesToMaterial,
} from "@/config/pbrTextures";
import GroundManager from "./GroundManager";
import DebugOverlay from "./DebugOverlay";
import { FaceContextWidget } from "./FaceContextWidget";
import { _themeMats } from "@/config/materialCache";
import { type ThemeId } from "@/config/themes";
import { applyPalette } from "@/utils/applyPalette";
import type { MaterialPalette } from "@/store/slices/librarySlice";
// ── N8AO config (shared between Design + Walkthrough scenes) ─
const N8AO_CONFIG = {
  aoRadius: 0.8,
  intensity: 1.0,
  distanceFalloff: 1.5,
  quality: "medium" as const,
  halfRes: true,
};

const BLOOM_CONFIG = {
  luminanceThreshold: 0.85,
  luminanceSmoothing: 0.1,
  mipmapBlur: true,
} as const;

/** Wraps EffectComposer with a renderer-readiness guard to prevent null-GL crashes. */
function SafeEffectComposer({ children, ...props }: React.ComponentProps<typeof EffectComposer>) {
  const { gl } = useThree();
  if (!gl?.domElement) return null;
  return <EffectComposer {...props}>{children}</EffectComposer>;
}

// ── Sun Position Calculator ─────────────────────────────────

function useSunPosition() {
  const timeOfDay = useStore((s) => s.environment.timeOfDay);
  const northOffset = useStore((s) => s.environment.northOffset);

  return useMemo(() => {
    const solarAngle = ((timeOfDay - 6) / 12) * Math.PI;
    const elevation = Math.sin(solarAngle);
    const azimuth = Math.cos(solarAngle);
    const northRad = (northOffset * Math.PI) / 180;
    const x = azimuth * Math.cos(northRad) * 100;
    const z = azimuth * Math.sin(northRad) * 100;
    const y = Math.max(elevation * 100, -20);
    return new THREE.Vector3(x, y, z);
  }, [timeOfDay, northOffset]);
}

// ── Sun Light (with color temperature) ──────────────────────

function SunLight() {
  const sunPos = useSunPosition();
  const timeOfDay = useStore((s) => s.environment.timeOfDay);

  const intensity = useMemo(() => {
    if (timeOfDay < 5 || timeOfDay > 21) return 0;
    const t = ((timeOfDay - 5) / 16) * Math.PI;
    return Math.max(Math.sin(t) * 2.0, 0);
  }, [timeOfDay]);

  const color = useMemo(() => {
    if (timeOfDay < 5 || timeOfDay > 21) return new THREE.Color(0x0a0a2e);
    if (timeOfDay < 6.5) return new THREE.Color(0xff5522);   // dawn deep orange
    if (timeOfDay < 8) return new THREE.Color(0xff9944);     // morning warm
    if (timeOfDay < 16) return new THREE.Color(0xfff8f0);    // midday white
    if (timeOfDay < 17.5) return new THREE.Color(0xffbb55);  // afternoon golden
    if (timeOfDay < 19) return new THREE.Color(0xff6622);    // golden hour deep orange
    if (timeOfDay < 20.5) return new THREE.Color(0xcc3311);  // dusk red-orange
    return new THREE.Color(0x2244aa);
  }, [timeOfDay]);

  const hemiSkyColor = useMemo(() => {
    if (timeOfDay < 5 || timeOfDay > 21) return new THREE.Color(0x080818);
    if (timeOfDay < 6.5) return new THREE.Color(0xff9944);   // dawn amber
    if (timeOfDay < 8)   return new THREE.Color(0xddb877);   // morning warm
    if (timeOfDay < 16)  return new THREE.Color(0xb0d8ff);   // midday sky blue
    if (timeOfDay < 17.5) return new THREE.Color(0xddb877);  // afternoon warm
    if (timeOfDay < 19)  return new THREE.Color(0xff6622);   // golden hour orange
    if (timeOfDay < 20.5) return new THREE.Color(0x993311);  // dusk deep
    return new THREE.Color(0x080818);
  }, [timeOfDay]);

  const hemiGroundColor = useMemo(() => {
    if (timeOfDay < 5 || timeOfDay > 21) return new THREE.Color(0x060606);
    if (timeOfDay < 8 || timeOfDay > 17) return new THREE.Color(0x6b4020); // dawn/golden warm brown
    return new THREE.Color(0x8a7a60);  // midday green-brown
  }, [timeOfDay]);

  return (
    <>
      <directionalLight
        castShadow
        color={color}
        position={timeOfDay >= 5 && timeOfDay <= 21 ? [Math.max(sunPos.x, -80), Math.max(sunPos.y, 2.0), sunPos.z] : [20, 40, 20]}
        intensity={Math.min(Math.max(intensity * 1.2, 0.3), 3.0)}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.002}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
      />
      <ambientLight
        intensity={Math.max(intensity * 0.2, 0.08)}
        color={timeOfDay > 5 && timeOfDay < 21 ? 0xd0e0f8 : 0x080818}
      />
      <hemisphereLight
        args={[hemiSkyColor, hemiGroundColor, Math.max(intensity * 0.25, 0.05)]}
      />
    </>
  );
}

// ── Reusable scratch vectors (avoid allocating in useFrame hot paths) ──
const _v3A = new THREE.Vector3();
const _v3B = new THREE.Vector3();
const _upY = new THREE.Vector3(0, 1, 0);

// ── Blueprint Grid (1m spacing, dark blue-gray) ─────────────

const gridCellMat = new THREE.LineBasicMaterial({ color: "#1a2a3a", transparent: true, opacity: 0.35 });
const gridSectionMat = new THREE.LineBasicMaterial({ color: "#2a3a4a", transparent: true, opacity: 0.5 });

function useContainerBounds(padding = 2) {
  const containers = useStore((s) => s.containers);
  const [minX, maxX, minZ, maxZ] = useMemo(() => {
    const vals = Object.values(containers);
    if (vals.length === 0) return [-12, 12, -12, 12];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const c of vals) {
      const dims = CONTAINER_DIMENSIONS[c.size];
      const halfL = dims.length / 2;
      const halfW = dims.width / 2;
      const cosA = Math.abs(Math.cos(c.rotation));
      const sinA = Math.abs(Math.sin(c.rotation));
      const extX = halfL * cosA + halfW * sinA;
      const extZ = halfL * sinA + halfW * cosA;
      x0 = Math.min(x0, c.position.x - extX);
      x1 = Math.max(x1, c.position.x + extX);
      z0 = Math.min(z0, c.position.z - extZ);
      z1 = Math.max(z1, c.position.z + extZ);
    }
    return [x0 - padding, x1 + padding, z0 - padding, z1 + padding];
  }, [containers, padding]);
  return { minX, maxX, minZ, maxZ, empty: Object.keys(containers).length === 0 };
}

function BlueprintGrid() {
  const { minX, maxX, minZ, maxZ } = useContainerBounds(2);

  // Snap to nearest meter for stable grid lines
  const x0 = Math.floor(minX);
  const x1 = Math.ceil(maxX);
  const z0 = Math.floor(minZ);
  const z1 = Math.ceil(maxZ);

  const { cellGeo, sectionGeo } = useMemo(() => {
    const Y = 0.01;
    const cellPts: THREE.Vector3[] = [];
    const sectionPts: THREE.Vector3[] = [];

    for (let x = x0; x <= x1; x++) {
      const target = x % 5 === 0 ? sectionPts : cellPts;
      target.push(new THREE.Vector3(x, Y, z0), new THREE.Vector3(x, Y, z1));
    }
    for (let z = z0; z <= z1; z++) {
      const target = z % 5 === 0 ? sectionPts : cellPts;
      target.push(new THREE.Vector3(x0, Y, z), new THREE.Vector3(x1, Y, z));
    }

    return {
      cellGeo: new THREE.BufferGeometry().setFromPoints(cellPts),
      sectionGeo: new THREE.BufferGeometry().setFromPoints(sectionPts),
    };
  }, [x0, x1, z0, z1]);

  useEffect(() => {
    return () => { cellGeo.dispose(); sectionGeo.dispose(); };
  }, [cellGeo, sectionGeo]);

  return (
    <group>
      <lineSegments geometry={cellGeo} material={gridCellMat} />
      <lineSegments geometry={sectionGeo} material={gridSectionMat} />
    </group>
  );
}

// ── Blueprint Dimension Labels ───────────────────────────────

const dimLabelStyle: React.CSSProperties = {
  color: "#fff",
  fontSize: "13px",
  fontFamily: "ui-monospace, 'Cascadia Code', monospace",
  background: "rgba(20,30,50,0.8)",
  padding: "2px 8px",
  borderRadius: "4px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  userSelect: "none",
};

function DimensionLabels() {
  const { minX, maxX, minZ, maxZ, empty } = useContainerBounds(0);
  if (empty) return null;

  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  const width = (maxX - minX).toFixed(1);
  const depth = (maxZ - minZ).toFixed(1);

  return (
    <group>
      {/* Width labels (along X) at top and bottom edges */}
      <Html position={[midX, 0.5, maxZ + 1]} transform={false} style={dimLabelStyle} center>
        {width}m
      </Html>
      <Html position={[midX, 0.5, minZ - 1]} transform={false} style={dimLabelStyle} center>
        {width}m
      </Html>
      {/* Depth labels (along Z) at left and right edges */}
      <Html position={[maxX + 1, 0.5, midZ]} transform={false} style={dimLabelStyle} center>
        {depth}m
      </Html>
      <Html position={[minX - 1, 0.5, midZ]} transform={false} style={dimLabelStyle} center>
        {depth}m
      </Html>
    </group>
  );
}

// ── PBR Texture Loader ─────────────────────────────────────
// Loads PBR textures once and applies to cached theme materials.
// Must be inside <Canvas> tree for useThree/invalidate access.

function TimeOfDayEnvironment({ intensity = 0.4 }: { intensity?: number }) {
  const timeOfDay = useStore((s) => s.environment.timeOfDay);
  const envPreset = useMemo(() => {
    if (timeOfDay >= 17 && timeOfDay <= 20) return 'sunset' as const;
    if (timeOfDay >= 5 && timeOfDay <= 8)   return 'dawn' as const;
    if (timeOfDay >= 8 && timeOfDay <= 17)  return 'park' as const;
    return 'night' as const;
  }, [timeOfDay]);

  return <Environment preset={envPreset} background={false} environmentIntensity={intensity} />;
}

function PBRTextureLoader() {
  const { invalidate } = useThree();

  useEffect(() => {
    loadAllTextures().then(() => {
      const steel = getSteelTextures();
      if (steel) {
        applyTexturesToMaterial(_themeMats.industrial.steel, steel, 1.2);
        // Brighten the dark corrugated texture: light tint + high env reflections
        _themeMats.industrial.steel.color.setHex(0xd0d8e0);
        _themeMats.industrial.steel.envMapIntensity = 2.5;
        _themeMats.industrial.steel.needsUpdate = true;
      }

      const wood = getWoodTextures();
      if (wood) {
        applyTexturesToMaterial(_themeMats.industrial.wood, wood, 0.8);
        applyTexturesToMaterial(_themeMats.industrial.woodGroove, wood, 0.8);
      }

      invalidate();
    });
  }, [invalidate]);

  return null;
}

// Ground plane is now managed by GroundManager.tsx

// ── Time-of-Day Phase Helpers ──────────────────────────────

function isNightTime(t: number) { return t < 5 || t > 21; }
function isGoldenHourTime(t: number) { return (t >= 5 && t < 8) || (t > 17 && t <= 21); }
function isDeepTwilightTime(t: number) { return t < 6 || t > 20; }
function isTwilightTime(t: number) { return t < 6.5 || t > 19.5; }

const FOG_NIGHT = { color: '#060614', near: 60, far: 200 } as const;
const FOG_GOLDEN = { color: '#d4c4a8', near: 60, far: 180 } as const;
const FOG_DAY = { color: '#a8c0d0', near: 60, far: 180 } as const;

function getFogParams(t: number) {
  if (isNightTime(t)) return FOG_NIGHT;
  if (isGoldenHourTime(t)) return FOG_GOLDEN;
  return FOG_DAY;
}

// ── Sky Parameters (pure function — testable) ───────────────

export function getSkyParams(timeOfDay: number) {
  const goldenHour = isGoldenHourTime(timeOfDay);
  const deepTwilight = isDeepTwilightTime(timeOfDay);
  return {
    rayleigh: deepTwilight ? 4 : goldenHour ? 2.5 : 2.0,
    turbidity: deepTwilight ? 15 : goldenHour ? 6 : 2.5,
    mieCoefficient: goldenHour ? 0.008 : 0.005,
    mieDirectionalG: goldenHour ? 0.95 : 0.87,
  };
}

// ── Sky Dome ────────────────────────────────────────────────

function SkyDome() {
  const sunPos = useSunPosition();
  const timeOfDay = useStore((s) => s.environment.timeOfDay);

  if (isNightTime(timeOfDay)) {
    return (
      <>
        <color attach="background" args={[0x060614]} />
        <Stars radius={300} depth={60} count={4000} factor={4} saturation={0} fade speed={1} />
      </>
    );
  }

  const deepTwilight = isDeepTwilightTime(timeOfDay);
  const goldenHour = isGoldenHourTime(timeOfDay);
  const skyParams = getSkyParams(timeOfDay);

  // Fallback background: deep twilight gets dark slate, golden hour gets warm, midday gets sky blue
  const bgColor = deepTwilight ? 0x1a1a3e : goldenHour ? 0xd4a060 : 0x5b8fbf;

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <Sky
        distance={400}
        sunPosition={[sunPos.x, sunPos.y, sunPos.z]}
        rayleigh={skyParams.rayleigh}
        turbidity={skyParams.turbidity}
        mieCoefficient={skyParams.mieCoefficient}
        mieDirectionalG={skyParams.mieDirectionalG}
      />
      {isTwilightTime(timeOfDay) && <Stars radius={300} depth={60} count={2000} factor={3} saturation={0} fade speed={1} />}
    </>
  );
}

// ── Scene Fog (time-adaptive) ───────────────────────────────

function SceneFog() {
  const timeOfDay = useStore((s) => s.environment.timeOfDay);
  const fogRef = useRef<THREE.Fog>(null);
  const fog = getFogParams(timeOfDay);

  useEffect(() => {
    if (!fogRef.current) return;
    fogRef.current.color.set(fog.color);
    fogRef.current.near = fog.near;
    fogRef.current.far = fog.far;
  }, [fog]);

  return <fog ref={fogRef} attach="fog" args={[fog.color, fog.near, fog.far]} />;
}

// ── Keyboard Shortcuts ──────────────────────────────────────

function useKeyboardShortcuts() {
  const containers = useStore((s) => s.containers);
  const selection = useStore((s) => s.selection);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;

      const store = useStore.getState();
      const inWalkthrough = store.viewMode === ViewMode.Walkthrough;

      // Block destructive actions in Walkthrough mode
      if (inWalkthrough) {
        // Only allow Ctrl+Z/Y (undo/redo) and Escape in walkthrough — everything else handled by WalkthroughControls
        if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && !e.shiftKey) {
          e.preventDefault(); store.undo(); return;
        }
        if ((e.ctrlKey || e.metaKey) && ((e.code === "KeyZ" && e.shiftKey) || e.code === "KeyY")) {
          e.preventDefault(); store.redo(); return;
        }
        return;
      }

      // Grab mode: arrow keys move, Enter confirms, Escape cancels
      if (store.grabMode.active && store.grabMode.containerId) {
        const gId = store.grabMode.containerId;
        const gc = store.containers[gId];
        if (gc) {
          // Direct position update (no refreshAdjacency per keypress — only on Enter commit)
          const moveGrab = (pos: { x: number; y: number; z: number }) => {
            useStore.setState((s: any) => ({
              containers: { ...s.containers, [gId]: { ...s.containers[gId], position: pos } },
            }));
          };
          const step = e.shiftKey ? 1.0 : 0.1;
          if (e.code === "ArrowLeft")  { e.preventDefault(); moveGrab({ x: gc.position.x - step, y: gc.position.y, z: gc.position.z }); return; }
          if (e.code === "ArrowRight") { e.preventDefault(); moveGrab({ x: gc.position.x + step, y: gc.position.y, z: gc.position.z }); return; }
          if (e.code === "ArrowUp")    { e.preventDefault(); moveGrab({ x: gc.position.x, y: gc.position.y, z: gc.position.z - step }); return; }
          if (e.code === "ArrowDown")  { e.preventDefault(); moveGrab({ x: gc.position.x, y: gc.position.y, z: gc.position.z + step }); return; }
          if (e.code === "Enter")      { e.preventDefault(); store.clearGrabMode(); store.refreshAdjacency(); return; }
          if (e.code === "Escape")     {
            e.preventDefault();
            const origin = store.grabMode.origin;
            if (origin) moveGrab(origin);
            store.clearGrabMode();
            return;
          }
        }
        return; // Block all other keys while in grab mode
      }

      // Q = Rotate stamp faces 90° CW (when stamp active), else rotate selected containers
      if (e.code === "KeyQ" && !e.ctrlKey && !e.metaKey) {
        const stampFaces = store.getStampFaces();
        if (stampFaces) {
          e.preventDefault();
          store.rotateStampFaces();
        } else {
          for (const id of store.selection) {
            const c = store.containers[id];
            if (c) store.updateContainerRotation(id, c.rotation + Math.PI / 2);
          }
        }
      }

      // Delete / Backspace = Clear voxel if selected, else delete container
      if (e.code === "Delete" || e.code === "Backspace") {
        if (store.selectedVoxel && !store.selectedVoxel.isExtension) {
          e.preventDefault();
          store.setVoxelActive(store.selectedVoxel.containerId, store.selectedVoxel.index, false);
          return;
        }
        if (store.selection.length > 0) {
          e.preventDefault();
          for (const id of store.selection) store.removeContainer(id);
          store.clearSelection();
        }
      }

      // Ctrl+Z = Undo, Ctrl+Shift+Z / Ctrl+Y = Redo
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ((e.code === "KeyZ" && e.shiftKey) || e.code === "KeyY")) {
        e.preventDefault();
        store.redo();
        return;
      }

      // V = Cycle views: Blueprint → 3D → Walkthrough → Blueprint
      if (e.code === "KeyV" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const cycle = [ViewMode.Blueprint, ViewMode.Realistic3D, ViewMode.Walkthrough];
        const idx = cycle.indexOf(store.viewMode);
        const next = cycle[(idx + 1) % cycle.length];
        store.setViewMode(next);
        return;
      }
      // B = Toggle Build Mode (Frame Builder)
      if (e.code === "KeyB" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        useFrameStore.getState().toggleBuild();
        return;
      }
      // Alt+3 = 3D view, Alt+4 = Blueprint view
      if (e.code === "Digit3" && e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        store.setViewMode(ViewMode.Realistic3D);
        return;
      }
      if (e.code === "Digit4" && e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        store.setViewMode(ViewMode.Blueprint);
        return;
      }
      // F = Walkthrough (blocked if already in walkthrough)
      if (e.code === "KeyF" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        if (store.viewMode !== ViewMode.Walkthrough) {
          e.preventDefault();
          store.setViewMode(ViewMode.Walkthrough);
        }
        return;
      }

      // R = Rotate selected containers (when no stamp active; falls through to SmartHotbar for module rotation)
      if (e.code === "KeyR" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        if (store.selection.length > 0 && !store.getStampFaces()) {
          e.preventDefault();
          for (const id of store.selection) {
            const c = store.containers[id];
            if (c) store.updateContainerRotation(id, c.rotation + Math.PI / 2);
          }
          return;
        }
        // Fall through to SmartHotbar's R for module orientation rotation
      }

      // Shift+G = Grab mode (single container)
      if (e.code === "KeyG" && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (store.selection.length === 1) {
          const id = store.selection[0];
          const c = store.containers[id];
          if (c) {
            e.preventDefault();
            store.setGrabMode({ active: true, containerId: id, origin: { x: c.position.x, y: c.position.y, z: c.position.z } });
          }
        }
        return;
      }

      // G = Group selected containers into a zone
      if (e.code === "KeyG" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (store.selection.length >= 2) {
          store.createZone(`Group ${Date.now() % 1000}`, [...store.selection]);
        }
        return;
      }

      // U = Ungroup selected containers (remove from their zones)
      if (e.code === "KeyU" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (store.selection.length > 0) {
          const zones = store.zones;
          for (const zoneId of Object.keys(zones)) {
            const zone = zones[zoneId];
            const remaining = zone.containerIds.filter((cid) => !store.selection.includes(cid));
            if (remaining.length !== zone.containerIds.length) {
              if (remaining.length === 0) {
                store.removeZone(zoneId);
              } else {
                for (const cid of store.selection) {
                  if (zone.containerIds.includes(cid)) {
                    store.removeContainerFromZone(zoneId, cid);
                  }
                }
              }
            }
          }
        }
        return;
      }

      // E = Apply active hotbar config to HOVERED block (drive-by), OR edge-aware cycling
      // ★ STALE CLOSURE FIX: Read DIRECTLY from store at keypress time via getState()
      if (e.code === "KeyE" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const {
          hoveredVoxel, hoveredVoxelEdge,
          activeCustomSlot, activeHotbarSlot,
          stampFromCustomHotbar, stampFromHotbar,
          cycleVoxelFace, cycleVoxelTemplate,
        } = useStore.getState();
        if (hoveredVoxel && !hoveredVoxel.isExtension) {
          e.preventDefault();
          const { containerId, index } = hoveredVoxel;
          // Priority: custom hotbar > primary hotbar > edge cycle > block template cycle
          if (activeCustomSlot !== null) {
            stampFromCustomHotbar(containerId, index);
          } else if (activeHotbarSlot !== null) {
            stampFromHotbar(containerId, index);
          } else if (
            hoveredVoxelEdge &&
            hoveredVoxelEdge.containerId === containerId &&
            hoveredVoxelEdge.voxelIndex === index
          ) {
            // Edge hover → cycle just that face
            cycleVoxelFace(containerId, index, hoveredVoxelEdge.face);
          } else {
            // Center hover → cycle whole block template
            cycleVoxelTemplate(containerId, index);
          }
          return;
        }
      }

      // Escape = Deselect / cancel drag
      if (e.code === "Escape") {
        if (store.dragMovingId) {
          store.cancelContainerDrag();
        } else {
          store.clearSelection();
          store.closeBayContextMenu();
          store.stopPaint();
          store.clearClipboard();
          store.setActiveHotbarSlot(null);
        }
      }

      // Page Up/Down = Level slicer navigation
      // PageUp/PageDown = Level navigation (includes B1 at -1)
      if (e.code === "PageUp") {
        e.preventDefault();
        const maxLvl = Math.max(2, ...Object.values(store.containers).map((c) => c.level));
        const cur = store.viewLevel;
        if (cur !== null) store.setViewLevel(cur >= maxLvl ? null : cur + 1);
      }
      if (e.code === "PageDown") {
        e.preventDefault();
        const maxLvl = Math.max(2, ...Object.values(store.containers).map((c) => c.level));
        const cur = store.viewLevel;
        store.setViewLevel(cur === null ? maxLvl : Math.max(-1, cur - 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

// ── Keyboard Pan / Fly-Through Controls ──────────────────────

const panKeys: Record<string, boolean> = {};

function KeyboardPanControls() {
  const viewMode = useStore((s) => s.viewMode);
  const { camera } = useThree();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.ctrlKey || e.metaKey) return; // Don't register pan keys during shortcuts
      panKeys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => { panKeys[e.code] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      for (const k of Object.keys(panKeys)) panKeys[k] = false;
    };
  }, []);

  const forwardVec = useMemo(() => new THREE.Vector3(), []);
  const rightVec = useMemo(() => new THREE.Vector3(), []);
  const spherical = useMemo(() => new THREE.Spherical(), []);

  useFrame((state, delta) => {
    if (viewMode === ViewMode.Walkthrough) return;
    const dt = Math.min(delta, 0.1);

    if (viewMode === ViewMode.Blueprint) {
      // Blueprint: WASD/Arrows pan directly in world XZ
      let dx = 0, dz = 0;
      const speed = 25;
      if (panKeys["ArrowLeft"] || panKeys["KeyA"]) dx -= speed * dt;
      if (panKeys["ArrowRight"] || panKeys["KeyD"]) dx += speed * dt;
      if (panKeys["ArrowUp"] || panKeys["KeyW"]) dz -= speed * dt;
      if (panKeys["ArrowDown"] || panKeys["KeyS"]) dz += speed * dt;

      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        _v3A.set(dx, 0, dz);
        camera.position.add(_v3A);
        if (state.controls && "target" in state.controls) {
          (state.controls as any).target.add(_v3A);
        }
      }
      return;
    }

    // ── 3D Mode ─────────────────────────────────────────────
    const controls = state.controls as any;
    const hasOrbit = controls && "target" in controls;

    // WASD = Pan/Fly relative to camera facing
    let dx = 0, dz = 0, dy = 0;
    const panSpeed = 15;
    camera.getWorldDirection(forwardVec);
    forwardVec.y = 0;
    forwardVec.normalize();
    rightVec.crossVectors(forwardVec, _upY).normalize();

    let mx = 0, mz = 0;
    if (panKeys["KeyW"]) { mx += forwardVec.x; mz += forwardVec.z; }
    if (panKeys["KeyS"]) { mx -= forwardVec.x; mz -= forwardVec.z; }
    if (panKeys["KeyA"]) { mx -= rightVec.x; mz -= rightVec.z; }
    if (panKeys["KeyD"]) { mx += rightVec.x; mz += rightVec.z; }
    const len = Math.sqrt(mx * mx + mz * mz);
    if (len > 0.001) { dx = (mx / len) * panSpeed * dt; dz = (mz / len) * panSpeed * dt; }

    // R/F = Fly up/down (avoids Ctrl+Z conflict on KeyZ)
    if (panKeys["KeyR"]) dy += panSpeed * dt;
    if (panKeys["KeyF"]) dy -= panSpeed * dt;

    if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001 || Math.abs(dy) > 0.001) {
      _v3A.set(dx, dy, dz);
      camera.position.add(_v3A);
      if (hasOrbit) controls.target.add(_v3A);
    }

    // Arrow keys = Orbit rotation (yaw and pitch around target)
    if (hasOrbit) {
      const orbitSpeed = 1.8; // radians/sec
      let dTheta = 0, dPhi = 0;
      if (panKeys["ArrowLeft"]) dTheta += orbitSpeed * dt;
      if (panKeys["ArrowRight"]) dTheta -= orbitSpeed * dt;
      if (panKeys["ArrowUp"]) dPhi -= orbitSpeed * dt;
      if (panKeys["ArrowDown"]) dPhi += orbitSpeed * dt;

      if (Math.abs(dTheta) > 0.0001 || Math.abs(dPhi) > 0.0001) {
        const target = controls.target as THREE.Vector3;
        _v3A.copy(camera.position).sub(target);
        spherical.setFromVector3(_v3A);
        spherical.theta += dTheta;
        spherical.phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, spherical.phi + dPhi));
        _v3A.setFromSpherical(spherical);
        camera.position.copy(target).add(_v3A);
        camera.lookAt(target);
      }
    }
  });

  return null;
}

// ── Camera Target Lerp — smoothly glides orbit pivot to desired target ────
const _lerpTarget = new THREE.Vector3(0, 1.5, 0);
const _desiredTarget = new THREE.Vector3(0, 1.5, 0);

function CameraTargetLerp({ desired }: { desired: [number, number, number] }) {
  const { controls } = useThree();
  const dragMovingId = useStore((s) => s.dragMovingId);
  // Keep _desiredTarget in sync with prop every frame
  _desiredTarget.set(...desired);

  useFrame((_, delta) => {
    if (!controls || dragMovingId) return; // freeze lerp during container drag
    // WU-6: Skip lerp while 3D camera is being restored (prevents "spring" fight with CameraBroadcast)
    if (useStore.getState().cameraRestoring) return;
    const ctrl = controls as any;
    if (!ctrl.target) return;
    // Exponential decay lerp — ~7× per second half-life feels like smooth glide
    _lerpTarget.lerp(_desiredTarget, 1 - Math.pow(0.001, delta));
    ctrl.target.copy(_lerpTarget);
    ctrl.update();
  });
  return null;
}

// ── Camera floor guard — prevents camera going below ground ──
const _floorGuardVec = new THREE.Vector3();

function CameraFloorGuard({ cameraControlsRef }: { cameraControlsRef: React.RefObject<CameraControlsImpl | null> }) {
  // Set right-click to TRUCK (pan) instead of ROTATE on mount
  useEffect(() => {
    const cc = cameraControlsRef.current;
    if (!cc) return;
    cc.mouseButtons.right = 2; // ACTION.TRUCK = 2
  }, [cameraControlsRef]);

  useFrame(() => {
    const cc = cameraControlsRef.current;
    if (!cc) return;
    cc.getPosition(_floorGuardVec);
    if (_floorGuardVec.y < 0.5) {
      cc.setPosition(_floorGuardVec.x, 0.5, _floorGuardVec.z, false);
    }
  });
  return null;
}

// ── Camera Angle Broadcast + 3D Camera Persistence ─────────
const _sphericalBroadcast = new THREE.Spherical();

function CameraBroadcast() {
  const { camera, controls } = useThree();
  const frameCount = useRef(0);
  const setCameraAngles = useStore((s) => s.setCameraAngles);
  const saveCamera3D = useStore((s) => s.saveCamera3D);
  const savedCamera3D = useStore((s) => s.savedCamera3D);

  // Restore saved camera position on mount (after view mode switch)
  useLayoutEffect(() => {
    if (!savedCamera3D) return;
    // WU-6: Set restore-lock so CameraTargetLerp won't fight the restoration
    useStore.getState().setCameraRestoring(true);
    camera.position.set(...savedCamera3D.position);
    const controls = (camera as any).__r3f?.controls;
    if (controls?.target) {
      controls.target.set(...savedCamera3D.target);
      controls.update?.();
    }
    // Release lock after lerp would have settled (~600ms)
    const timer = setTimeout(() => useStore.getState().setCameraRestoring(false), 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // Save camera state on unmount (before view mode switch)
  useEffect(() => {
    return () => {
      const controls = (camera as any).__r3f?.controls;
      const target = controls?.target ?? new THREE.Vector3(0, 1.5, 0);
      saveCamera3D(
        camera.position.toArray() as [number, number, number],
        [target.x, target.y, target.z]
      );
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // cleanup only

  useFrame(() => {
    // Unconditionally enforce upright camera every frame — prevents quaternion roll drift.
    // Then force OrbitControls to re-derive spherical coords from corrected up vector.
    camera.up.set(0, 1, 0);
    (controls as any)?.update?.();
    // Throttle to ~10 updates/sec at 60fps
    if (++frameCount.current % 6 !== 0) return;
    _v3A.set(0, 0, 0);
    // Use OrbitControls target if available (default controls store it)
    const orbitCtrl = (camera as any).__r3f?.controls;
    if (orbitCtrl?.target) {
      _v3A.copy(orbitCtrl.target);
    }
    _v3B.copy(camera.position).sub(_v3A);
    _sphericalBroadcast.setFromVector3(_v3B);
    setCameraAngles(_sphericalBroadcast.theta, _sphericalBroadcast.phi);
  });

  return null;
}

// ── Ghost Container — translucent wireframe box for above-active-level containers ──

const mGhostFill = new THREE.MeshStandardMaterial({
  color: "#94a3b8", transparent: true, opacity: 0.06,
  depthWrite: false, side: THREE.DoubleSide,
});
const mGhostWire = new THREE.LineBasicMaterial({
  color: "#94a3b8", transparent: true, opacity: 0.25,
});
const nullRaycastScene = () => {};

function GhostContainer({ container }: { container: Container }) {
  const dims = CONTAINER_DIMENSIONS[container.size];
  const pos = container.position;
  const boxGeo = useMemo(() => new THREE.BoxGeometry(dims.length, dims.height, dims.width), [dims]);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(boxGeo), [boxGeo]);

  return (
    <group position={[pos.x, pos.y + dims.height / 2, pos.z]} raycast={nullRaycastScene}>
      <mesh geometry={boxGeo} material={mGhostFill} raycast={nullRaycastScene} />
      <lineSegments geometry={edgesGeo} material={mGhostWire} raycast={nullRaycastScene} />
    </group>
  );
}

// ── Follow Light — travels with camera to illuminate interiors ──

function FollowLight() {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(({ camera }) => {
    if (lightRef.current) {
      lightRef.current.position.copy(camera.position);
    }
  });
  return <pointLight ref={lightRef} intensity={1.2} distance={12} decay={2} color={0xfff8e7} />;
}

// ── 3D Realistic Scene ──────────────────────────────────────

// ── 3D Realistic Scene ──────────────────────────────────────

function RealisticScene() {
  const containers = useStore((s) => s.containers);
  const viewLevel = useStore((s) => s.viewLevel);
  const clearSelection = useStore((s) => s.clearSelection);
  const debugMode = useStore((s) => s.debugMode);
  const dragMovingId = useStore((s) => s.dragMovingId);
  const selectedVoxel = useStore((s) => s.selectedVoxel);
  const hoveredVoxel = useStore((s) => s.hoveredVoxel);
  const hoveredVoxelEdge = useStore((s) => s.hoveredVoxelEdge);
  const isPreviewMode = useStore((s) => s.isPreviewMode);
  const activePaletteId = useStore((s) => s.activePaletteId);
  const currentTheme = useStore((s) => s.currentTheme);
  const cameraControlsRef = useRef<CameraControlsImpl>(null);

  // Apply palette when active palette or theme changes
  useEffect(() => {
    const { palettes, environment } = useStore.getState();
    const palette = palettes.find((p: MaterialPalette) => p.id === activePaletteId);
    if (palette) {
      applyPalette(palette, currentTheme);
      if (palette.groundPreset !== environment.groundPreset) {
        useStore.getState().setGroundPreset(palette.groundPreset);
      }
    }
  }, [activePaletteId, currentTheme]);

  // ★ PILLAR 3: Layer Ghosting Logic
  // viewLevel === null → All containers at 100% (no filtering)
  // viewLevel === N    → Active level N = 100% interactive; above = 15% ghost; below = hidden
  const allContainers = useMemo(() => Object.values(containers), [containers]);
  const activeContainers = useMemo(() =>
    viewLevel === null
      ? allContainers
      : allContainers.filter((c) => c.level === viewLevel),
    [allContainers, viewLevel]
  );
  const poolUnion = useMemo(() => computePoolUnion(containers), [containers]);
  const ghostedContainers = useMemo(() =>
    viewLevel === null
      ? []
      : allContainers.filter((c) => c.level > viewLevel),
    [allContainers, viewLevel]
  );
  // Below active level → not rendered at all (hidden)

  // Compute orbit pivot — selected container takes priority, then center-of-mass
  const selection = useStore((s) => s.selection);
  const orbitTarget = useMemo(() => {
    if (selection.length > 0) {
      const sel = containers[selection[0]];
      if (sel) {
        const d = CONTAINER_DIMENSIONS[sel.size];
        return [sel.position.x, sel.position.y + d.height / 2, sel.position.z] as [number, number, number];
      }
    }
    const all = Object.values(containers);
    if (all.length === 0) return [0, 1.5, 0] as [number, number, number];
    let sx = 0, sy = 0, sz = 0;
    for (const c of all) {
      const d = CONTAINER_DIMENSIONS[c.size];
      sx += c.position.x;
      sy += c.position.y + d.height / 2;
      sz += c.position.z;
    }
    return [sx / all.length, sy / all.length, sz / all.length] as [number, number, number];
  }, [containers, selection]);

  return (
    <>
      <SkyDome />
      <SunLight />
      <FollowLight />
      <GroundManager />
      <PBRTextureLoader />

      {/* Phase 8: HDRI environment for PBR reflections (visible corrugation reflections) */}
      <TimeOfDayEnvironment intensity={0.65} />

      {/* Distance fog — softens horizon edge */}
      <SceneFog />

      {/* Contact shadows — soft shadow blob under containers.
           frames={1} bakes once (doesn't update on drag — acceptable for design tool). */}
      <ContactShadows
        position={[0, 0.01, 0]}
        scale={35}
        blur={2.0}
        opacity={0.28}
        far={6}
        resolution={1024}
        frames={1}
        color="#0a1a06"
        raycast={() => {}}
      />

      {/* Atmospheric clouds */}
      <Clouds material={THREE.MeshBasicMaterial}>
        <Cloud position={[-20, 22, -40]} speed={0.2} opacity={0.5} bounds={[20, 3, 8]} segments={20} />
        <Cloud position={[30, 25, -60]} speed={0.15} opacity={0.4} bounds={[15, 2, 6]} segments={15} />
        <Cloud position={[10, 28, -80]} speed={0.1} opacity={0.35} bounds={[25, 4, 10]} segments={18} />
        <Cloud position={[-40, 24, -50]} speed={0.12} opacity={0.35} bounds={[18, 3, 7]} segments={16} />
        <Cloud position={[50, 26, -70]} speed={0.18} opacity={0.3} bounds={[22, 3, 9]} segments={17} />
      </Clouds>

      {/* Active level containers — 100% opacity, fully interactive */}
      {activeContainers.map((container) => (
        <ContainerMesh key={container.id} container={container} />
      ))}

      {/* Ghosted containers (above active level) — 15% translucent wireframe, no raycasting */}
      {ghostedContainers.map((container) => (
        <GhostContainer key={`ghost_${container.id}`} container={container} />
      ))}

      {/* Shared walls for adjacent containers (prevents z-fighting) */}
      <SharedWalls />

      {/* Debug wireframe overlay */}
      {debugMode && <DebugOverlay />}

      {/* Phase 9: Tape measure tool */}
      <TapeMeasure />

      <DragMoveGhost />

      {/* CameraControls: smooth transitions, BVH-friendly, programmatic target control */}
      <CameraControls
        ref={cameraControlsRef}
        makeDefault
        enabled={!dragMovingId}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI / 2 - 0.08}
        minDistance={3}
        maxDistance={120}
        smoothTime={0.15}
        draggingSmoothTime={0.1}
      />
      <CameraFloorGuard cameraControlsRef={cameraControlsRef} />

      {/* Smooth camera orbit pivot lerp — glides target to desired position */}
      <CameraTargetLerp desired={orbitTarget} />

      {/* Broadcast camera orientation to store for IsoEditor sync */}
      <CameraBroadcast />

      {/* Click empty space to deselect (transparent but raycastable) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          clearSelection();
          useStore.getState().setSelectedVoxel(null);
          useStore.getState().closeBayContextMenu();
        }}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
      </mesh>

      {/* Merged pool water plane — single plane spanning all pool-basin voxels */}
      {poolUnion && (
        <mesh
          position={[
            (poolUnion.minX + poolUnion.maxX) / 2,
            poolUnion.waterY,
            (poolUnion.minZ + poolUnion.maxZ) / 2,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[poolUnion.maxX - poolUnion.minX, poolUnion.maxZ - poolUnion.minZ]} />
          <meshPhysicalMaterial
            color="#0ea5e9"
            transparent
            opacity={0.65}
            roughness={0.05}
            metalness={0.1}
          />
        </mesh>
      )}

      {/* Floating face context widget — appears near selected face in 3D */}
      <FaceContextWidget />

      {/* Phase 8: Post-processing — AO + Bloom */}
      <SafeEffectComposer enableNormalPass>
        <N8AO {...N8AO_CONFIG} />
        <Bloom intensity={0.4} {...BLOOM_CONFIG} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </SafeEffectComposer>

      {/* 3D orientation gizmo */}
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport />
      </GizmoHelper>
    </>
  );
}

// ── Blueprint Scene ─────────────────────────────────────────

function BlueprintScene() {
  const dragMovingId = useStore((s) => s.dragMovingId);

  return (
    <>
      <BlueprintRenderer />
      <DimensionLabels />
      <DragMoveGhostBlueprint />
      <OrbitControls
        makeDefault
        enabled={!dragMovingId}
        enableRotate={false}
        minZoom={2}
        maxZoom={200}
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.1}
        screenSpacePanning
        mouseButtons={{
          LEFT: -1 as any,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
    </>
  );
}

// ── Palette Drag Ghost (new container from palette) ─────────

// Grid snapping — imported from gridSystem for consistency
import { gridSnap, GRID_STEP } from "@/utils/gridSystem";

const ghostSolid = new THREE.MeshBasicMaterial({ color: "#00bcd4", transparent: true, opacity: 0.35 }); // Cyan ghost
const ghostEdge = new THREE.MeshBasicMaterial({ color: "#00bcd4", transparent: true, opacity: 0.7, wireframe: true });
const ghostInvalidEdge = new THREE.MeshBasicMaterial({ color: "#c62828", transparent: true, opacity: 0.7, wireframe: true });
const ghostStackSolid = new THREE.MeshBasicMaterial({ color: "#2e7d32", transparent: true, opacity: 0.25 });
const ghostStackEdge = new THREE.MeshBasicMaterial({ color: "#2e7d32", transparent: true, opacity: 0.7, wireframe: true });
const ghostSnapSolid = new THREE.MeshBasicMaterial({ color: "#00bcd4", transparent: true, opacity: 0.4 });
const ghostSnapEdge = new THREE.MeshBasicMaterial({ color: "#42a5f5", transparent: true, opacity: 0.8, wireframe: true });
// Shared material-clone cache for all ghost renderers (DragGhost + MoveGhostVisual)
const _ghostOverlayMats = new Map<THREE.Material, THREE.Material>();

function DragGhost() {
  const dragContainer = useStore((s) => s.dragContainer);
  const setDragWorldPos = useStore((s) => s.setDragWorldPos);
  const dragWorldPos = useStore((s) => s.dragWorldPos);
  const addContainer = useStore((s) => s.addContainer);
  const stackContainer = useStore((s) => s.stackContainer);
  const isPreviewMode = useStore((s) => s.isPreviewMode);
  const { raycaster, pointer, camera } = useThree();

  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const snappedRef = useRef(false);
  const validRef = useRef(true);

  useFrame(() => {
    if (!dragContainer) return;
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
      let sx = gridSnap(hitPoint.x);
      let sz = gridSnap(hitPoint.z);

      const containers = useStore.getState().containers;

      // Adjacency snap overrides grid snap
      const snap = findEdgeSnap(containers, null, sx, sz, dragContainer);
      if (snap.snapped) { sx = snap.x; sz = snap.z; }
      snappedRef.current = snap.snapped;

      // Stacking detection
      const target = findStackTarget(containers, sx, sz, dragContainer);
      const stacking = target !== null;

      // Elevate ghost to level-2 Y when stacking onto an existing container
      let ghostY = 0;
      if (target) {
        const targetCont = containers[target.containerId];
        const targetDims = CONTAINER_DIMENSIONS[targetCont.size];
        ghostY = targetCont.position.y + targetDims.height;
      }

      // Overlap check — stacking is always valid (lower container is expected overlap)
      const foot = getFootprintAt(sx, sz, dragContainer);
      const overlaps = checkOverlap(containers, null, foot);
      validRef.current = stacking ? true : !overlaps;

      setDragWorldPos({ x: sx, y: ghostY, z: sz, stackTargetId: target?.containerId ?? null });
    }
  });

  useEffect(() => {
    if (!dragContainer) setDragWorldPos(null);
  }, [dragContainer, setDragWorldPos]);

  useEffect(() => {
    if (!dragContainer) return;
    const handleUp = () => {
      const pos = useStore.getState().dragWorldPos;
      if (!pos || !validRef.current) {
        useStore.getState().setDragContainer(null);
        return;
      }
      const newId = useStore.getState().addContainer(dragContainer, { x: pos.x, y: pos.y, z: pos.z });
      useStore.getState().setAllExtensions(newId, 'all_deck', false);
      if (pos.stackTargetId) {
        useStore.getState().stackContainer(newId, pos.stackTargetId);
      }
      useStore.getState().setDragContainer(null);
    };
    window.addEventListener("mouseup", handleUp);
    return () => window.removeEventListener("mouseup", handleUp);
  }, [dragContainer, addContainer, stackContainer]);

  // Mock container for ContainerSkin rendering — created once per drag session
  const mockContainer = useMemo((): Container | null => {
    if (!dragContainer) return null;
    return {
      id: '__drag_ghost__',
      size: dragContainer,
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      level: 0,
      voxelGrid: createDefaultVoxelGrid(),
    } as Container;
  }, [dragContainer]);

  const skinGroupRef = useRef<THREE.Group>(null);
  const skinReadyRef = useRef(false);

  // Reset skin clone flag when drag container changes
  useEffect(() => { skinReadyRef.current = false; }, [dragContainer]);

  // One-time material cloning at 40% opacity (same pattern as MoveGhostVisual)
  useFrame(() => {
    if (!dragContainer || !skinGroupRef.current || skinReadyRef.current) return;
    skinReadyRef.current = true;
    const cloneMat = (m: THREE.Material): THREE.Material => {
      if (_ghostOverlayMats.has(m)) return _ghostOverlayMats.get(m)!;
      const c = m.clone();
      c.transparent = true;
      (c as THREE.MeshStandardMaterial).opacity = Math.min((m as any).opacity ?? 1, 0.4);
      _ghostOverlayMats.set(m, c);
      return c;
    };
    skinGroupRef.current.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(cloneMat);
      } else {
        mesh.material = cloneMat(mesh.material);
      }
    });
  });

  if (!dragContainer || !dragWorldPos || !mockContainer || isPreviewMode) return null;

  const dims = CONTAINER_DIMENSIONS[dragContainer];
  const isStacking = dragWorldPos.stackTargetId !== null;
  const isSnapped = snappedRef.current;
  const isValid = validRef.current;
  const edgeMat = isStacking ? ghostStackEdge : !isValid ? ghostInvalidEdge : isSnapped ? ghostSnapEdge : ghostEdge;

  return (
    <group position={[dragWorldPos.x, dragWorldPos.y + dims.height / 2, dragWorldPos.z]}>
      {/* Real container skin at 40% opacity */}
      <group ref={skinGroupRef}>
        <ContainerSkin container={mockContainer} animated={false} ghostMode={true} />
      </group>
      {/* Colored wireframe overlay for snap/stack feedback */}
      <mesh material={edgeMat}>
        <boxGeometry args={[dims.length, dims.height, dims.width]} />
      </mesh>
    </group>
  );
}

// ── Container Move Ghost (3D view) ──────────────────────────

const moveValid = new THREE.MeshBasicMaterial({ color: "#2e7d32", transparent: true, opacity: 0.25 });
const moveValidEdge = new THREE.MeshBasicMaterial({ color: "#2e7d32", transparent: true, opacity: 0.6, wireframe: true });
const moveInvalid = new THREE.MeshBasicMaterial({ color: "#c62828", transparent: true, opacity: 0.25 });
const moveInvalidEdge = new THREE.MeshBasicMaterial({ color: "#c62828", transparent: true, opacity: 0.6, wireframe: true });
const moveSnap = new THREE.MeshBasicMaterial({ color: "#1565c0", transparent: true, opacity: 0.3 });
const moveSnapEdge = new THREE.MeshBasicMaterial({ color: "#42a5f5", transparent: true, opacity: 0.7, wireframe: true });
const moveStack = new THREE.MeshBasicMaterial({ color: "#7b1fa2", transparent: true, opacity: 0.3 });
const moveStackEdge = new THREE.MeshBasicMaterial({ color: "#ab47bc", transparent: true, opacity: 0.7, wireframe: true });

function DragMoveGhost() {
  const dragMovingId = useStore((s) => s.dragMovingId);
  const commitContainerDrag = useStore((s) => s.commitContainerDrag);
  const cancelContainerDrag = useStore((s) => s.cancelContainerDrag);
  const isPreviewMode = useStore((s) => s.isPreviewMode);
  const { raycaster, pointer, camera, gl } = useThree();

  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const ghostPos = useRef({ x: 0, y: 0, z: 0, valid: true, snapped: false, stacking: false });

  // Initialize ghostPos to container's current position to prevent jump-to-origin on quick click
  useEffect(() => {
    if (!dragMovingId) return;
    const container = useStore.getState().containers[dragMovingId];
    if (container) {
      ghostPos.current = { x: container.position.x, y: container.position.y, z: container.position.z, valid: true, snapped: false, stacking: false };
    }
  }, [dragMovingId]);

  useFrame(() => {
    if (!dragMovingId) return;
    const containers = useStore.getState().containers;
    const container = containers[dragMovingId];
    if (!container) return;

    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;

    let sx = gridSnap(hitPoint.x);
    let sz = gridSnap(hitPoint.z);

    const snap = findEdgeSnap(containers, dragMovingId, sx, sz, container.size, container.rotation);
    if (snap.snapped) { sx = snap.x; sz = snap.z; }

    // Check for stacking target
    const stackTarget = findStackTarget(containers, sx, sz, container.size);
    const stacking = stackTarget !== null;
    // Elevate ghost to level-2 Y when stacking onto an existing container
    let ghostY = 0;
    if (stackTarget) {
      const targetCont = containers[stackTarget.containerId];
      const targetDims = CONTAINER_DIMENSIONS[targetCont.size];
      ghostY = targetCont.position.y + targetDims.height;
    }

    const foot = getFootprintAt(sx, sz, container.size, container.rotation);
    const overlaps = checkOverlap(containers, dragMovingId, foot);
    // If stacking, overlap with the container below is expected — check only same-level overlap
    const valid = stacking ? true : !overlaps;

    ghostPos.current = { x: sx, y: ghostY, z: sz, valid, snapped: snap.snapped, stacking };
  });

  useLayoutEffect(() => {
    if (!dragMovingId) return;
    const handleUp = () => {
      const g = ghostPos.current;
      if (g.valid) {
        commitContainerDrag(g.x, g.z);
      } else {
        cancelContainerDrag();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") cancelContainerDrag();
    };
    gl.domElement.addEventListener("pointerup", handleUp);
    gl.domElement.addEventListener("pointercancel", cancelContainerDrag);
    window.addEventListener("keydown", handleKey);
    return () => {
      gl.domElement.removeEventListener("pointerup", handleUp);
      gl.domElement.removeEventListener("pointercancel", cancelContainerDrag);
      window.removeEventListener("keydown", handleKey);
    };
  }, [dragMovingId, commitContainerDrag, cancelContainerDrag, gl]);

  if (!dragMovingId || isPreviewMode) return null;

  const containers = useStore.getState().containers;
  const container = containers[dragMovingId];
  if (!container) return null;
  const dims = CONTAINER_DIMENSIONS[container.size];

  return <MoveGhostVisual dims={dims} ghostPos={ghostPos} container={container} />;
}

function MoveGhostVisual({
  dims,
  ghostPos,
  container,
}: {
  dims: { length: number; width: number; height: number };
  ghostPos: React.RefObject<{ x: number; y: number; z: number; valid: boolean; snapped: boolean; stacking: boolean }>;
  container: Container;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const skinGroupRef = useRef<THREE.Group>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const skinReadyRef = useRef(false);

  // Clone all ContainerSkin materials once at 40% opacity so we don't modify shared instances
  useFrame(() => {
    if (!groupRef.current || !ghostPos.current) return;
    const g = ghostPos.current;
    groupRef.current.position.set(g.x, g.y + dims.height / 2, g.z);

    // One-time material cloning for the skin group
    if (skinGroupRef.current && !skinReadyRef.current) {
      skinReadyRef.current = true;
      const cloneMat = (m: THREE.Material): THREE.Material => {
        if (_ghostOverlayMats.has(m)) return _ghostOverlayMats.get(m)!;
        const c = m.clone();
        c.transparent = true;
        (c as THREE.MeshStandardMaterial).opacity = Math.min((m as any).opacity ?? 1, 0.4);
        _ghostOverlayMats.set(m, c);
        return c;
      };
      skinGroupRef.current.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(cloneMat);
        } else {
          mesh.material = cloneMat(mesh.material);
        }
      });
    }

    // Color-code the wireframe overlay based on validity
    const wire = g.stacking ? moveStackEdge : g.snapped ? moveSnapEdge : g.valid ? moveValidEdge : moveInvalidEdge;
    if (wireRef.current) wireRef.current.material = wire;
  });

  return (
    <group ref={groupRef}>
      {/* Real container skin at 40% opacity */}
      <group ref={skinGroupRef}>
        <ContainerSkin container={container} animated={false} ghostMode={true} />
      </group>
      {/* Colored wireframe overlay for valid/invalid/snap/stack feedback */}
      <mesh ref={wireRef} material={moveValidEdge}>
        <boxGeometry args={[dims.length, dims.height, dims.width]} />
      </mesh>
    </group>
  );
}

// ── Blueprint Drag Move Ghost (2D) ──────────────────────────

const bpMoveValid = new THREE.MeshBasicMaterial({ color: "#2e7d32", transparent: true, opacity: 0.3, depthTest: false });
const bpMoveInvalid = new THREE.MeshBasicMaterial({ color: "#c62828", transparent: true, opacity: 0.3, depthTest: false });
const bpMoveSnap = new THREE.MeshBasicMaterial({ color: "#1565c0", transparent: true, opacity: 0.35, depthTest: false });

function DragMoveGhostBlueprint() {
  const dragMovingId = useStore((s) => s.dragMovingId);
  const commitContainerDrag = useStore((s) => s.commitContainerDrag);
  const cancelContainerDrag = useStore((s) => s.cancelContainerDrag);
  const { raycaster, pointer, camera, gl } = useThree();

  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const ghostPos = useRef({ x: 0, z: 0, valid: true, snapped: false });

  // Initialize ghostPos to container's current position to prevent jump-to-origin on quick click
  useEffect(() => {
    if (!dragMovingId) return;
    const container = useStore.getState().containers[dragMovingId];
    if (container) {
      ghostPos.current = { x: container.position.x, z: container.position.z, valid: true, snapped: false };
    }
  }, [dragMovingId]);

  useFrame(() => {
    if (!dragMovingId) return;
    const containers = useStore.getState().containers;
    const container = containers[dragMovingId];
    if (!container) return;

    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;

    let sx = gridSnap(hitPoint.x);
    let sz = gridSnap(hitPoint.z);

    const snap = findEdgeSnap(containers, dragMovingId, sx, sz, container.size, container.rotation);
    if (snap.snapped) { sx = snap.x; sz = snap.z; }

    const foot = getFootprintAt(sx, sz, container.size, container.rotation);
    const overlaps = checkOverlap(containers, dragMovingId, foot);

    ghostPos.current = { x: sx, z: sz, valid: !overlaps, snapped: snap.snapped };
  });

  useLayoutEffect(() => {
    if (!dragMovingId) return;
    const handleUp = () => {
      const g = ghostPos.current;
      if (g.valid) {
        commitContainerDrag(g.x, g.z);
      } else {
        cancelContainerDrag();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") cancelContainerDrag();
    };
    gl.domElement.addEventListener("pointerup", handleUp);
    gl.domElement.addEventListener("pointercancel", cancelContainerDrag);
    window.addEventListener("keydown", handleKey);
    return () => {
      gl.domElement.removeEventListener("pointerup", handleUp);
      gl.domElement.removeEventListener("pointercancel", cancelContainerDrag);
      window.removeEventListener("keydown", handleKey);
    };
  }, [dragMovingId, commitContainerDrag, cancelContainerDrag, gl]);

  if (!dragMovingId) return null;

  const containers = useStore.getState().containers;
  const container = containers[dragMovingId];
  if (!container) return null;
  const dims = CONTAINER_DIMENSIONS[container.size];

  return <BpMoveGhostVisual dims={dims} ghostPos={ghostPos} rotation={container.rotation} />;
}

function BpMoveGhostVisual({
  dims,
  ghostPos,
  rotation,
}: {
  dims: { length: number; width: number; height: number };
  ghostPos: React.RefObject<{ x: number; z: number; valid: boolean; snapped: boolean }>;
  rotation: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current || !ghostPos.current) return;
    const g = ghostPos.current;
    meshRef.current.position.set(g.x, 0.55, g.z);
    meshRef.current.material = g.snapped ? bpMoveSnap : g.valid ? bpMoveValid : bpMoveInvalid;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, rotation]} material={bpMoveValid} renderOrder={998}>
      <planeGeometry args={[dims.length, dims.width]} />
    </mesh>
  );
}

// ── Walkthrough env suppressor ───────────────────────────────
// Reduces envMapIntensity on all theme materials while in FP mode
// to prevent exterior HDRI reflections on interior steel surfaces.

const ENV_SUPPRESS_KEYS: ('steel' | 'steelInner' | 'glass' | 'frame' | 'rail')[] =
  ['steel', 'steelInner', 'glass', 'frame', 'rail'];
const WALKTHROUGH_ENV = 0.05;

function WalkthroughEnvSuppressor() {
  useEffect(() => {
    // Snapshot current values so cleanup restores exactly what was there
    const saved = new Map<string, number>();
    for (const themeId of Object.keys(_themeMats) as ThemeId[]) {
      const mats = _themeMats[themeId];
      for (const k of ENV_SUPPRESS_KEYS) {
        saved.set(`${themeId}.${k}`, mats[k].envMapIntensity);
        mats[k].envMapIntensity = WALKTHROUGH_ENV;
        mats[k].needsUpdate = true;
      }
    }
    return () => {
      for (const themeId of Object.keys(_themeMats) as ThemeId[]) {
        const mats = _themeMats[themeId];
        for (const k of ENV_SUPPRESS_KEYS) {
          mats[k].envMapIntensity = saved.get(`${themeId}.${k}`) ?? 1.0;
          mats[k].needsUpdate = true;
        }
      }
    };
  }, []);
  return null;
}

// ── Walkthrough Scene (First-Person) ─────────────────────────

function WalkthroughScene() {
  const containers = useStore((s) => s.containers);
  const viewLevel = useStore((s) => s.viewLevel);

  const visibleContainers = Object.values(containers).filter(
    (c) => viewLevel === null || c.level <= viewLevel
  );

  return (
    <>
      <WalkthroughEnvSuppressor />
      <SkyDome />
      <SunLight />
      <GroundManager />

      {/* Phase 8: HDRI environment for PBR reflections */}
      <TimeOfDayEnvironment intensity={0.4} />

      {visibleContainers.map((container) => (
        <ContainerMesh key={container.id} container={container} />
      ))}

      <WalkthroughControls />

      {/* Phase 8: Post-processing — AO + Bloom */}
      <SafeEffectComposer enableNormalPass>
        <N8AO {...N8AO_CONFIG} />
        <Bloom intensity={0.25} {...BLOOM_CONFIG} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </SafeEffectComposer>
    </>
  );
}

// ── Blueprint Drag Ghost (new container from palette — flat 2D) ────

const bpDragGhost = new THREE.MeshBasicMaterial({ color: "#1565c0", transparent: true, opacity: 0.25, depthTest: false });
const bpDragGhostEdge = new THREE.MeshBasicMaterial({ color: "#1565c0", transparent: true, opacity: 0.6, depthTest: false, wireframe: true });
const bpDragGhostSnap = new THREE.MeshBasicMaterial({ color: "#42a5f5", transparent: true, opacity: 0.35, depthTest: false });
const bpDragGhostStack = new THREE.MeshBasicMaterial({ color: "#2e7d32", transparent: true, opacity: 0.3, depthTest: false });

function DragGhostBlueprint() {
  const dragContainer = useStore((s) => s.dragContainer);
  const setDragWorldPos = useStore((s) => s.setDragWorldPos);
  const dragWorldPos = useStore((s) => s.dragWorldPos);
  const addContainer = useStore((s) => s.addContainer);
  const stackContainer = useStore((s) => s.stackContainer);
  const { raycaster, pointer, camera } = useThree();

  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const snappedRef = useRef(false);

  useFrame(() => {
    if (!dragContainer) return;
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
      let sx = gridSnap(hitPoint.x);
      let sz = gridSnap(hitPoint.z);

      const containers = useStore.getState().containers;
      const snap = findEdgeSnap(containers, null, sx, sz, dragContainer);
      if (snap.snapped) { sx = snap.x; sz = snap.z; }
      snappedRef.current = snap.snapped;

      setDragWorldPos({ x: sx, y: 0, z: sz, stackTargetId: null });
    }
  });

  useEffect(() => {
    if (!dragContainer) setDragWorldPos(null);
  }, [dragContainer, setDragWorldPos]);

  useEffect(() => {
    if (!dragContainer) return;
    const handleUp = () => {
      const pos = useStore.getState().dragWorldPos;
      if (!pos) {
        useStore.getState().setDragContainer(null);
        return;
      }
      const newId2 = useStore.getState().addContainer(dragContainer, { x: pos.x, y: 0, z: pos.z });
      useStore.getState().setAllExtensions(newId2, 'all_deck', false);
      useStore.getState().setDragContainer(null);
    };
    window.addEventListener("mouseup", handleUp);
    return () => window.removeEventListener("mouseup", handleUp);
  }, [dragContainer, addContainer, stackContainer]);

  if (!dragContainer || !dragWorldPos) return null;

  const dims = CONTAINER_DIMENSIONS[dragContainer];
  const fillMat = snappedRef.current ? bpDragGhostSnap : bpDragGhost;

  return (
    <group>
      <mesh position={[dragWorldPos.x, 0.55, dragWorldPos.z]} rotation={[-Math.PI / 2, 0, 0]} material={fillMat} renderOrder={997}>
        <planeGeometry args={[dims.length, dims.width]} />
      </mesh>
      <mesh position={[dragWorldPos.x, 0.56, dragWorldPos.z]} rotation={[-Math.PI / 2, 0, 0]} material={bpDragGhostEdge} renderOrder={998}>
        <planeGeometry args={[dims.length, dims.width]} />
      </mesh>
    </group>
  );
}

// ── Main Scene ──────────────────────────────────────────────

// BuildToolGhost removed — replaced by VoxelBuilder + TileRenderer

// Configure raycaster layers — Blueprint uses all layers (default), 3D/Walk uses Layer 1 only
function RaycasterConfig() {
  const { raycaster } = useThree();
  const viewMode = useStore((s) => s.viewMode);

  useEffect(() => {
    if (viewMode === ViewMode.Blueprint) {
      // Blueprint meshes use default Layer 0 — enable all layers
      raycaster.layers.enableAll();
    } else {
      // 3D/Walkthrough: only check interactive layer to avoid ghost box occlusion
      raycaster.layers.disableAll();
      raycaster.layers.enable(RAYCAST_LAYERS.INTERACTABLE);
    }
  }, [raycaster, viewMode]);

  return null;
}

function SceneExporter() {
  const { scene, camera } = useThree();
  useEffect(() => { setExportScene(scene); (window as any).__scene = scene; (window as any).__camera = camera; }, [scene, camera]);
  return null;
}

// DevSceneExpose imported from ./DevSceneExpose (standalone, with __inspectScene + __inspectStore)

export default function Scene() {
  const viewMode = useStore((s) => s.viewMode);
  useKeyboardShortcuts();
  useInputHandler(); // Click-outside menu close + Spacebar edge cycling (ESC reserved for pointer lock)

  return (
    <>
      <DevSceneExpose />
      <SceneExporter />
      <RaycasterConfig />
      <CameraController />
      <FrameBuilder />
      {viewMode === ViewMode.Realistic3D && <DragGhost />}
      {viewMode === ViewMode.Blueprint && <DragGhostBlueprint />}
      {viewMode !== ViewMode.Walkthrough && <KeyboardPanControls />}
      {viewMode === ViewMode.Blueprint && <><BlueprintGrid /><BlueprintScene /></>}
      {viewMode === ViewMode.Realistic3D && <RealisticScene />}
      {viewMode === ViewMode.Walkthrough && <WalkthroughScene />}
    </>
  );
}
