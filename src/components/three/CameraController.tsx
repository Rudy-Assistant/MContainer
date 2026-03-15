"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { useStore } from "@/store/useStore";
import { ViewMode, CONTAINER_DIMENSIONS } from "@/types/container";

const MARGIN_FACTOR = 1.25;
const MIN_ZOOM = 3;
const MAX_ZOOM = 200;
const DEFAULT_ZOOM = 20;

function computeAutoFit(screenW: number, screenH: number) {
  const containers = useStore.getState().containers;
  const ids = Object.keys(containers);
  if (ids.length === 0) return null;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

  for (const c of Object.values(containers)) {
    const dims = CONTAINER_DIMENSIONS[c.size];
    const halfL = dims.length / 2;
    const halfW = dims.width / 2;
    const cosA = Math.abs(Math.cos(c.rotation));
    const sinA = Math.abs(Math.sin(c.rotation));
    const extX = halfL * cosA + halfW * sinA;
    const extZ = halfL * sinA + halfW * cosA;
    minX = Math.min(minX, c.position.x - extX);
    maxX = Math.max(maxX, c.position.x + extX);
    minZ = Math.min(minZ, c.position.z - extZ);
    maxZ = Math.max(maxZ, c.position.z + extZ);
  }

  const margin = 3;
  minX -= margin; maxX += margin; minZ -= margin; maxZ += margin;

  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const worldW = (maxX - minX) * MARGIN_FACTOR;
  const worldH = (maxZ - minZ) * MARGIN_FACTOR;
  const zoomX = screenW / worldW;
  const zoomZ = screenH / worldH;
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomX, zoomZ)));

  return { cx, cz, zoom, bounds: { minX, maxX, minZ, maxZ } };
}

export default function CameraController() {
  const viewMode = useStore((s) => s.viewMode);
  const containers = useStore((s) => s.containers);
  const { size } = useThree();
  const orthoRef = useRef<THREE.OrthographicCamera>(null);
  const hasAutoFitted = useRef(false);
  const prevCount = useRef(0);

  const isBlueprint = viewMode === ViewMode.Blueprint;
  const count = Object.keys(containers).length;

  const autoFit = useCallback(() => {
    if (!orthoRef.current) return;
    const cam = orthoRef.current;
    const result = computeAutoFit(size.width, size.height);
    if (result) {
      cam.position.set(result.cx, 50, result.cz);
      cam.zoom = result.zoom;
    } else {
      cam.position.set(0, 50, 0);
      cam.zoom = DEFAULT_ZOOM;
    }
    // CRITICAL: Set up vector to (0,0,-1) for top-down view.
    // The default up (0,1,0) is colinear with the look direction when looking
    // straight down, causing gimbal lock. Setting up=(0,0,-1) makes -Z = "north"
    // in screen space, which aligns the grid perfectly.
    cam.up.set(0, 0, -1);
    cam.lookAt(cam.position.x, 0, cam.position.z);
    cam.updateProjectionMatrix();
  }, [size.width, size.height]);

  useEffect(() => {
    if (isBlueprint) hasAutoFitted.current = false;
  }, [isBlueprint]);

  useEffect(() => {
    if (!isBlueprint || !orthoRef.current) return;
    if (!hasAutoFitted.current || count !== prevCount.current) {
      requestAnimationFrame(() => {
        autoFit();
        hasAutoFitted.current = true;
        prevCount.current = count;
      });
    }
  }, [isBlueprint, autoFit, count]);

  // Frustum guard — prevent camera drifting away from content
  useFrame(() => {
    if (!isBlueprint || !orthoRef.current) return;
    const state = useStore.getState();
    const ids = Object.keys(state.containers);
    if (ids.length === 0) return;

    let cx = 0, cz = 0;
    for (const c of Object.values(state.containers)) { cx += c.position.x; cz += c.position.z; }
    cx /= ids.length; cz /= ids.length;

    const cam = orthoRef.current;

    // Ensure up vector stays correct (OrbitControls respects camera.up for lookAt)
    if (cam.up.y !== 0 || cam.up.z !== -1) {
      cam.up.set(0, 0, -1);
      cam.updateProjectionMatrix();
    }

    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
    );
    if (!frustum.containsPoint(new THREE.Vector3(cx, 0.5, cz))) {
      autoFit();
    }
  });

  if (!isBlueprint) return null;

  return (
    <OrthographicCamera
      ref={orthoRef as React.RefObject<THREE.OrthographicCamera>}
      makeDefault={isBlueprint}
      position={[0, 50, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      zoom={DEFAULT_ZOOM}
      near={-10000}
      far={10000}
    />
  );
}
