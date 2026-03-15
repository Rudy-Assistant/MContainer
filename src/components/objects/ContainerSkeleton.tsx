"use client";

/**
 * ContainerSkeleton.tsx — The Invisible Interaction Rig
 *
 * GEOMETRY RULE (Z-Axis Length):
 *   Side Walls (left/right): panels along Z (length=12.19m). x = ±1.22
 *   End Walls (front/back):  panels along X (width=2.44m).   z = ±6.09
 *
 * Every "bone" is:
 *   - visible={true} but opacity=0 (invisible yet clickable by raycaster)
 *   - scale=[1.1, 1.1, 1.1] (fat hitboxes for easy clicking)
 *   - Has unique userData for hit resolution
 *
 * ALL interaction events live here. ContainerSkin has ZERO handlers.
 *
 * Part 2: Corner Post hitboxes at the 4 container corners.
 * Part 3: onPointerOver/Out drives hoveredPart for visual feedback in Skin.
 */

import { useCallback } from "react";
import * as THREE from "three";
import {
  type Container,
  type WallSide,
  type CornerName,
  CONTAINER_DIMS,
  SIDE_PANEL_COUNTS,
  panelWidth,
  panelKey,
  WALL_SIDES,
  CORNER_NAMES,
  cornerFrameKey,
  rotationToRadians,
} from "@/store/containerStore";
import { useContainerStore } from "@/store/containerStore";

// ── Invisible Hitbox Material (opacity=0 but raycastable) ────

const matHitbox = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const WALL_THICK = 0.08; // Hitbox thickness
const POST_SIZE = 0.12;  // Fat post hitbox
const BEAM_H = 0.10;     // Fat beam hitbox
const CORNER_SIZE = 0.14; // Corner post hitbox (slightly bigger than regular post)

// ── Skeleton Bone Positions (Z-Axis Length Convention) ────────

function panelCenter(
  side: WallSide, index: number, pw: number,
  dims: { length: number; width: number; height: number }
): [number, number, number] {
  const halfW = dims.width / 2;
  const halfL = dims.length / 2;
  const halfH = dims.height / 2;

  switch (side) {
    case "left":  return [-halfW, halfH, -halfL + pw / 2 + index * pw];
    case "right": return [halfW, halfH, -halfL + pw / 2 + index * pw];
    case "front": return [-halfW + pw / 2 + index * pw, halfH, -halfL];
    case "back":  return [-halfW + pw / 2 + index * pw, halfH, halfL];
  }
}

function panelSize(
  side: WallSide, pw: number, height: number
): [number, number, number] {
  switch (side) {
    case "left":
    case "right": return [WALL_THICK, height, pw];
    case "front":
    case "back":  return [pw, height, WALL_THICK];
  }
}

function postPosition(
  side: WallSide, index: number, pw: number,
  dims: { length: number; width: number; height: number }
): [number, number, number] {
  const halfW = dims.width / 2;
  const halfL = dims.length / 2;
  const halfH = dims.height / 2;

  switch (side) {
    case "left":  return [-halfW, halfH, -halfL + index * pw];
    case "right": return [halfW, halfH, -halfL + index * pw];
    case "front": return [-halfW + index * pw, halfH, -halfL];
    case "back":  return [-halfW + index * pw, halfH, halfL];
  }
}

function beamPosition(
  side: WallSide, index: number, pw: number,
  dims: { length: number; width: number; height: number },
  isTop: boolean
): [number, number, number] {
  const [px, , pz] = panelCenter(side, index, pw, dims);
  const y = isTop ? dims.height : 0;
  return [px, y, pz];
}

function beamSize(side: WallSide, pw: number): [number, number, number] {
  switch (side) {
    case "left":
    case "right": return [BEAM_H, BEAM_H, pw];
    case "front":
    case "back":  return [pw, BEAM_H, BEAM_H];
  }
}

/** Corner post positions at the 4 corners of the container */
function cornerPosition(
  corner: CornerName,
  dims: { length: number; width: number; height: number }
): [number, number, number] {
  const halfW = dims.width / 2;
  const halfL = dims.length / 2;
  const halfH = dims.height / 2;

  switch (corner) {
    case "front_left":  return [-halfW, halfH, -halfL];
    case "front_right": return [halfW, halfH, -halfL];
    case "back_left":   return [-halfW, halfH, halfL];
    case "back_right":  return [halfW, halfH, halfL];
  }
}

// ── Main Component ───────────────────────────────────────────

interface ContainerSkeletonProps {
  container: Container;
}

export default function ContainerSkeleton({ container }: ContainerSkeletonProps) {
  const applyBrush = useContainerStore((s) => s.applyBrush);
  const toggleFrame = useContainerStore((s) => s.toggleFrame);
  const selectContainer = useContainerStore((s) => s.selectContainer);
  const selectAdditive = useContainerStore((s) => s.selectAdditive);
  const focusPanel = useContainerStore((s) => s.focusPanel);
  const brush = useContainerStore((s) => s.brush);
  const setHoveredPart = useContainerStore((s) => s.setHoveredPart);

  const dims = CONTAINER_DIMS[container.type];

  // ── Click Handlers ─────────────────────────────────────────

  const handlePanelClick = useCallback((e: any, containerId: string, key: string) => {
    e.stopPropagation();
    if (brush === "frame") return;
    if (e.nativeEvent?.shiftKey) {
      selectAdditive(containerId);
    } else {
      applyBrush(containerId, key);
    }
  }, [brush, applyBrush, selectAdditive]);

  const handleFrameClick = useCallback((e: any, containerId: string, frameKey: string) => {
    e.stopPropagation();
    if (brush === "frame") {
      toggleFrame(containerId, frameKey);
    } else if (e.nativeEvent?.shiftKey) {
      selectAdditive(containerId);
    } else {
      selectContainer(containerId);
      focusPanel(null);
    }
  }, [brush, toggleFrame, selectContainer, selectAdditive, focusPanel]);

  const handleCornerClick = useCallback((e: any, containerId: string, cornerKey: string) => {
    e.stopPropagation();
    if (brush === "frame") {
      toggleFrame(containerId, cornerKey);
    } else if (e.nativeEvent?.shiftKey) {
      selectAdditive(containerId);
    } else {
      selectContainer(containerId);
      focusPanel(null);
    }
  }, [brush, toggleFrame, selectContainer, selectAdditive, focusPanel]);

  const handleFloorClick = useCallback((e: any) => {
    e.stopPropagation();
    if (e.nativeEvent?.shiftKey) {
      selectAdditive(container.id);
    } else {
      selectContainer(container.id);
      focusPanel(null);
    }
  }, [container.id, selectContainer, selectAdditive, focusPanel]);

  // ── Hover Handlers ─────────────────────────────────────────

  const handlePanelOver = useCallback((e: any, containerId: string, key: string) => {
    e.stopPropagation();
    setHoveredPart({ type: "panel", containerId, panelKey: key });
  }, [setHoveredPart]);

  const handlePanelOut = useCallback((e: any) => {
    e.stopPropagation();
    setHoveredPart(null);
  }, [setHoveredPart]);

  const handleBeamOver = useCallback((e: any, containerId: string, frameKey: string) => {
    e.stopPropagation();
    setHoveredPart({ type: "beam", containerId, frameKey });
  }, [setHoveredPart]);

  const handlePostOver = useCallback((e: any, containerId: string, frameKey: string) => {
    e.stopPropagation();
    setHoveredPart({ type: "post", containerId, frameKey });
  }, [setHoveredPart]);

  const handleCornerOver = useCallback((e: any, containerId: string, cornerKey: string) => {
    e.stopPropagation();
    setHoveredPart({ type: "corner", containerId, cornerKey });
  }, [setHoveredPart]);

  const handleFloorOver = useCallback((e: any) => {
    e.stopPropagation();
    setHoveredPart({ type: "floor", containerId: container.id });
  }, [container.id, setHoveredPart]);

  const handlePartOut = useCallback((e: any) => {
    e.stopPropagation();
    setHoveredPart(null);
  }, [setHoveredPart]);

  return (
    <group
      position={container.position}
      rotation={[0, rotationToRadians(container.rotation), 0]}
    >
      {/* ── Floor Hitbox ── */}
      <mesh
        position={[0, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={matHitbox}
        scale={[1.1, 1.1, 1]}
        userData={{ hitType: "floor", containerId: container.id, priority: 0 }}
        onPointerDown={handleFloorClick}
        onPointerOver={handleFloorOver}
        onPointerOut={handlePartOut}
      >
        <planeGeometry args={[dims.width, dims.length]} />
      </mesh>

      {/* ── Corner Post Hitboxes (Part 2) ── */}
      {CORNER_NAMES.map((corner) => {
        const key = cornerFrameKey(corner);
        const pos = cornerPosition(corner, dims);

        return (
          <mesh
            key={key}
            position={pos}
            material={matHitbox}
            scale={[1.1, 1.1, 1.1]}
            userData={{ hitType: "corner_post", containerId: container.id, cornerKey: key, priority: 4 }}
            onPointerDown={(e) => handleCornerClick(e, container.id, key)}
            onPointerOver={(e) => handleCornerOver(e, container.id, key)}
            onPointerOut={handlePartOut}
          >
            <boxGeometry args={[CORNER_SIZE, dims.height, CORNER_SIZE]} />
          </mesh>
        );
      })}

      {/* ── Per-Side: Panel Bones + Post Bones + Beam Bones ── */}
      {WALL_SIDES.map((side) => {
        const count = SIDE_PANEL_COUNTS[container.type][side];
        const pw = panelWidth(container.type, side);

        return (
          <group key={side}>
            {/* Panel Bones (priority 1) */}
            {Array.from({ length: count }, (_, i) => {
              const key = panelKey(side, i);
              const pos = panelCenter(side, i, pw, dims);
              const size = panelSize(side, pw, dims.height);
              const ud = { hitType: "panel", containerId: container.id, panelKey: key, side, index: i, priority: 1 };

              return (
                <mesh
                  key={`panel_${key}`}
                  position={pos}
                  material={matHitbox}
                  scale={[1.1, 1.1, 1.1]}
                  userData={ud}
                  onPointerDown={(e) => handlePanelClick(e, container.id, key)}
                  onPointerOver={(e) => handlePanelOver(e, container.id, key)}
                  onPointerOut={handlePanelOut}
                >
                  <boxGeometry args={size} />
                </mesh>
              );
            })}

            {/* Post Bones (priority 3) */}
            {Array.from({ length: count + 1 }, (_, i) => {
              const postKey = `post_${side}_${i}`;
              const pos = postPosition(side, i, pw, dims);
              const ud = { hitType: "frame_post", containerId: container.id, frameKey: postKey, priority: 3 };

              return (
                <mesh
                  key={postKey}
                  position={pos}
                  material={matHitbox}
                  scale={[1.1, 1.1, 1.1]}
                  userData={ud}
                  onPointerDown={(e) => handleFrameClick(e, container.id, postKey)}
                  onPointerOver={(e) => handlePostOver(e, container.id, postKey)}
                  onPointerOut={handlePartOut}
                >
                  <boxGeometry args={[POST_SIZE, dims.height, POST_SIZE]} />
                </mesh>
              );
            })}

            {/* Beam Bones — top + bottom (priority 3) */}
            {Array.from({ length: count }, (_, i) => {
              const topKey = `beam_top_${side}_${i}`;
              const botKey = `beam_bottom_${side}_${i}`;
              const bSize = beamSize(side, pw);
              const topPos = beamPosition(side, i, pw, dims, true);
              const botPos = beamPosition(side, i, pw, dims, false);

              return (
                <group key={`beams_${side}_${i}`}>
                  <mesh
                    position={topPos}
                    material={matHitbox}
                    scale={[1.1, 1.1, 1.1]}
                    userData={{ hitType: "frame_beam", containerId: container.id, frameKey: topKey, priority: 3 }}
                    onPointerDown={(e) => handleFrameClick(e, container.id, topKey)}
                    onPointerOver={(e) => handleBeamOver(e, container.id, topKey)}
                    onPointerOut={handlePartOut}
                  >
                    <boxGeometry args={bSize} />
                  </mesh>
                  <mesh
                    position={botPos}
                    material={matHitbox}
                    scale={[1.1, 1.1, 1.1]}
                    userData={{ hitType: "frame_beam", containerId: container.id, frameKey: botKey, priority: 3 }}
                    onPointerDown={(e) => handleFrameClick(e, container.id, botKey)}
                    onPointerOver={(e) => handleBeamOver(e, container.id, botKey)}
                    onPointerOut={handlePartOut}
                  >
                    <boxGeometry args={bSize} />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
