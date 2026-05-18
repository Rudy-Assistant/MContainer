"use client";

export type WalkthroughVectorInput =
  | readonly [number, number, number]
  | { x: number; y: number; z: number };

export interface WalkthroughCameraPoseInput {
  /** Eye/camera position in world metres. */
  position: WalkthroughVectorInput;
  /** Optional world-space point the camera should face. */
  target?: WalkthroughVectorInput;
  /** Optional yaw in radians, used when target is omitted. */
  yaw?: number;
  /** Optional pitch in radians, used with yaw when target is omitted. */
  pitch?: number;
  /** Optional floor/feet Y. Defaults to position.y - walkthrough eye height. */
  floorY?: number;
}

export interface WalkthroughCameraPose {
  position: [number, number, number];
  target?: [number, number, number];
  yaw?: number;
  pitch?: number;
  floorY?: number;
}

type WalkthroughCameraApplier = (pose: WalkthroughCameraPose) => void;

declare global {
  interface Window {
    /**
     * Playwright/debug hook for first-person walkthrough camera setup.
     *
     * Call this before switching to walkthrough to override the default spawn,
     * or call it while already in walkthrough to move the active FPV camera.
     */
    __setWalkthroughCameraPose?: (pose: WalkthroughCameraPoseInput) => WalkthroughCameraPose;
    /** Raw pending pose consumed by WalkthroughControls on first mount. */
    __walkthroughCameraPose?: WalkthroughCameraPoseInput | WalkthroughCameraPose;
  }
}

let pendingPose: WalkthroughCameraPose | null = null;
let liveApplier: WalkthroughCameraApplier | null = null;

function normalizeVector(value: WalkthroughVectorInput, label: string): [number, number, number] {
  const tuple: readonly [number, number, number] = "x" in value
    ? [value.x, value.y, value.z]
    : [value[0], value[1], value[2]];
  const vector = tuple.map((n) => Number(n)) as [number, number, number];

  if (vector.length !== 3 || vector.some((n) => !Number.isFinite(n))) {
    throw new Error(`Invalid walkthrough camera ${label}: expected finite [x, y, z]`);
  }

  return vector;
}

function finiteOptional(value: unknown, label: string): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid walkthrough camera ${label}: expected a finite number`);
  }
  return n;
}

export function normalizeWalkthroughCameraPose(input: WalkthroughCameraPoseInput): WalkthroughCameraPose {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid walkthrough camera pose: expected an object");
  }

  return {
    position: normalizeVector(input.position, "position"),
    target: input.target ? normalizeVector(input.target, "target") : undefined,
    yaw: finiteOptional(input.yaw, "yaw"),
    pitch: finiteOptional(input.pitch, "pitch"),
    floorY: finiteOptional(input.floorY, "floorY"),
  };
}

function setWindowPendingPose(pose: WalkthroughCameraPose | null) {
  if (typeof window === "undefined") return;
  if (pose) {
    window.__walkthroughCameraPose = pose;
  } else {
    delete window.__walkthroughCameraPose;
  }
}

export function setWalkthroughCameraPoseOverride(input: WalkthroughCameraPoseInput): WalkthroughCameraPose {
  const pose = normalizeWalkthroughCameraPose(input);
  pendingPose = pose;
  setWindowPendingPose(pose);

  if (liveApplier) {
    liveApplier(pose);
    pendingPose = null;
    setWindowPendingPose(null);
  }

  return pose;
}

export function consumeWalkthroughCameraPoseOverride(): WalkthroughCameraPose | null {
  let pose = pendingPose;

  if (!pose && typeof window !== "undefined" && window.__walkthroughCameraPose) {
    pose = normalizeWalkthroughCameraPose(window.__walkthroughCameraPose);
  }

  pendingPose = null;
  setWindowPendingPose(null);
  return pose;
}

export function clearWalkthroughCameraPoseOverride() {
  pendingPose = null;
  setWindowPendingPose(null);
}

export function registerWalkthroughCameraPoseApplier(applier: WalkthroughCameraApplier): () => void {
  liveApplier = applier;
  return () => {
    if (liveApplier === applier) liveApplier = null;
  };
}

export function installWalkthroughCameraPoseApi(): () => void {
  if (typeof window === "undefined") return () => {};

  const setter = (pose: WalkthroughCameraPoseInput) => setWalkthroughCameraPoseOverride(pose);
  window.__setWalkthroughCameraPose = setter;

  return () => {
    if (window.__setWalkthroughCameraPose === setter) {
      delete window.__setWalkthroughCameraPose;
    }
  };
}
