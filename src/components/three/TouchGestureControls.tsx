"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { ViewMode } from "@/types/container";

/* eslint-disable react-hooks/immutability -- Three.js controls and canvas styles are imperative external APIs. */

type CameraControlsTouches = {
  one: number;
  two: number;
  three: number;
};

type CameraControlsLike = {
  touches: CameraControlsTouches;
  dollyToCursor: boolean;
  truck: (x: number, y: number, enableTransition?: boolean) => Promise<void>;
  rotate: (azimuthAngle: number, polarAngle: number, enableTransition?: boolean) => Promise<void>;
  dolly: (distance: number, enableTransition?: boolean) => Promise<void>;
};

type OrbitTouches = {
  ONE?: THREE.TOUCH;
  TWO?: THREE.TOUCH;
};

type OrbitControlsLike = {
  touches: OrbitTouches;
  update: () => void;
};

type TouchGestureControlsProps = {
  enabled?: boolean;
};

// camera-controls ACTION values. The package only exports these on the runtime
// class, while this component only needs stable numeric touch mappings.
const CAMERA_TOUCH = {
  NONE: 0,
  TOUCH_TRUCK: 128,
  TOUCH_DOLLY_TRUCK: 4096,
  TOUCH_DOLLY_ROTATE: 32768,
} as const;

export const MCONTAINER_3D_TOUCHES: CameraControlsTouches = {
  // Match desktop MContainer behavior: one-finger drag pans the model.
  one: CAMERA_TOUCH.TOUCH_TRUCK,
  // Two fingers own zoom/orbit gestures without interfering with tap selection.
  two: CAMERA_TOUCH.TOUCH_DOLLY_ROTATE,
  // Three fingers are a fallback for precise pan+zoom on larger tablets.
  three: CAMERA_TOUCH.TOUCH_DOLLY_TRUCK,
};

export const MCONTAINER_BLUEPRINT_TOUCHES: OrbitTouches = {
  ONE: THREE.TOUCH.PAN,
  TWO: THREE.TOUCH.DOLLY_PAN,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCameraControlsLike(value: unknown): value is CameraControlsLike {
  if (!isObject(value)) return false;
  const touches = value.touches;
  return (
    isObject(touches) &&
    typeof touches.one === "number" &&
    typeof touches.two === "number" &&
    typeof touches.three === "number" &&
    typeof value.truck === "function" &&
    typeof value.rotate === "function" &&
    typeof value.dolly === "function"
  );
}

function isOrbitControlsLike(value: unknown): value is OrbitControlsLike {
  if (!isObject(value) || isCameraControlsLike(value)) return false;
  return isObject(value.touches) && typeof value.update === "function";
}

/**
 * TouchGestureControls centralizes tablet/canvas gesture policy.
 *
 * It does not render UI or replace the active camera controls. Instead, it
 * configures the controls that are already marked makeDefault by the scene:
 * - 3D: one-finger pan, two-finger pinch/orbit, three-finger pinch/pan.
 * - Blueprint: one-finger pan, two-finger pinch/pan, rotation disabled.
 */
export default function TouchGestureControls({ enabled = true }: TouchGestureControlsProps) {
  const controls = useThree((s) => s.controls);
  const gl = useThree((s) => s.gl);
  const viewMode = useStore((s) => s.viewMode);

  useEffect(() => {
    const element = gl.domElement;
    const previousTouchAction = element.style.touchAction;
    const previousOverscroll = element.style.overscrollBehavior;

    element.style.touchAction = "none";
    element.style.overscrollBehavior = "none";

    const preventNativeGesture = (event: Event) => {
      event.preventDefault();
    };

    element.addEventListener("gesturestart", preventNativeGesture);
    element.addEventListener("gesturechange", preventNativeGesture);
    element.addEventListener("gestureend", preventNativeGesture);

    return () => {
      element.style.touchAction = previousTouchAction;
      element.style.overscrollBehavior = previousOverscroll;
      element.removeEventListener("gesturestart", preventNativeGesture);
      element.removeEventListener("gesturechange", preventNativeGesture);
      element.removeEventListener("gestureend", preventNativeGesture);
    };
  }, [gl.domElement]);

  useEffect(() => {
    if (!enabled || viewMode === ViewMode.Walkthrough || !controls) return;

    if (viewMode === ViewMode.Realistic3D && isCameraControlsLike(controls)) {
      const previousTouches = { ...controls.touches };
      const previousDollyToCursor = controls.dollyToCursor;

      controls.touches = { ...MCONTAINER_3D_TOUCHES };
      controls.dollyToCursor = true;

      return () => {
        controls.touches = previousTouches;
        controls.dollyToCursor = previousDollyToCursor;
      };
    }

    if (viewMode === ViewMode.Blueprint && isOrbitControlsLike(controls)) {
      const previousTouches = { ...controls.touches };

      controls.touches = {
        ...controls.touches,
        ...MCONTAINER_BLUEPRINT_TOUCHES,
      };
      controls.update();

      return () => {
        controls.touches = previousTouches;
        controls.update();
      };
    }
  }, [controls, enabled, viewMode]);

  return null;
}
