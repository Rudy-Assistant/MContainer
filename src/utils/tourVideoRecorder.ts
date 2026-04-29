/**
 * tourVideoRecorder.ts — Capture the live canvas as a WebM video clip.
 *
 * Uses the browser's MediaRecorder API + HTMLCanvasElement.captureStream().
 * No npm dependencies. The user starts recording, the existing walkthrough /
 * orbit camera animation is captured, and the clip downloads as WebM.
 *
 * For best results the user should pair this with the auto-tour mode (if
 * available) so the camera moves itself during recording.
 */

// HTMLCanvasElement.captureStream is part of the standard MediaCapture API
// (TS lib.dom typings include it as optional). No need to redeclare.

import { downloadBlob } from '@/utils/downloadBlob';

interface RecordingHandle {
  stop: () => Promise<Blob | null>;
  /** Recording state — useful for UI status. */
  isRecording: () => boolean;
}

const DEFAULT_FPS = 30;
const PREFERRED_MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

/** Begin recording the renderer canvas. Returns a handle whose stop() returns
 *  the WebM blob (or null on failure). */
export function startTourRecording(opts: { fps?: number } = {}): RecordingHandle | null {
  if (typeof window === 'undefined') return null;
  const renderer = (window as unknown as { __threeRenderer?: { domElement: HTMLCanvasElement } }).__threeRenderer;
  const canvas = renderer?.domElement as (HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }) | undefined;
  if (!canvas?.captureStream) {
    alert('This browser does not support canvas video capture.');
    return null;
  }
  const mimeType = pickMimeType();
  if (!mimeType) {
    alert('This browser does not support WebM video recording.');
    return null;
  }

  const stream = canvas.captureStream(opts.fps ?? DEFAULT_FPS);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  let stopped = false;
  const stopPromise = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start(100); // collect chunks every 100ms

  return {
    isRecording: () => !stopped,
    async stop(): Promise<Blob | null> {
      if (stopped) return null;
      stopped = true;
      recorder.stop();
      await stopPromise;
      stream.getTracks().forEach((t) => t.stop());
      if (!chunks.length) return null;
      return new Blob(chunks, { type: mimeType });
    },
  };
}

/** Convenience: start recording, wait `durationMs`, stop, and download. */
export async function recordTourClip(durationMs = 10_000, opts: { fps?: number } = {}): Promise<void> {
  const handle = startTourRecording(opts);
  if (!handle) return;
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  const blob = await handle.stop();
  if (!blob) {
    alert('Recording produced no data.');
    return;
  }
  downloadBlob(blob, `moduhome-tour-${new Date().toISOString().slice(0, 10)}.webm`);
}

/**
 * Record an auto-tour: switches the view to Walkthrough, programmatically
 * triggers the existing T-key auto-tour, captures the canvas for
 * `durationMs`, then restores the previous view mode.
 *
 * Synthesizing a KeyT keydown rather than calling internal tour state keeps
 * us decoupled from WalkthroughControls' private refs.
 */
export async function recordAutoTourClip(durationMs = 10_000): Promise<void> {
  const { useStore } = await import('@/store/useStore');
  const { ViewMode } = await import('@/types/container');
  const previousMode = useStore.getState().viewMode;

  useStore.getState().setViewMode(ViewMode.Walkthrough);
  // One animation frame for WalkthroughControls to mount + register its
  // keydown listener.
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);

  const dispatchT = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT' }));
  dispatchT(); // start interior auto-tour

  const handle = startTourRecording();
  if (!handle) {
    // Recorder failed to start — restore view + bail.
    useStore.getState().setViewMode(previousMode);
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, durationMs));

  const blob = await handle.stop();
  // Cycle T twice to walk off the tour state machine: first to exterior,
  // second to off. Cheap and avoids a tour-state-reset hook.
  dispatchT();
  dispatchT();
  useStore.getState().setViewMode(previousMode);

  if (!blob) {
    alert('Auto-tour recording produced no data.');
    return;
  }
  downloadBlob(blob, `moduhome-auto-tour-${new Date().toISOString().slice(0, 10)}.webm`);
}
