import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useStore } from '../../store/useStore';
import { detectQualityPreset, extractGPUInfo } from '../../config/gpuDetect';

/**
 * Runs once on first launch to detect GPU capability and set quality preset.
 * Waits for IndexedDB hydration to complete before checking whether the user
 * already has a persisted preference. Must be mounted inside <Canvas>.
 */
export function QualityAutoDetect() {
  const gl = useThree((s) => s.gl);
  const hasHydrated = useStore((s) => s._hasHydrated);
  const didRun = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (didRun.current) return;
    didRun.current = true;

    const alreadyDetected = localStorage.getItem('moduhome-gpu-detected');
    if (alreadyDetected) return;

    const glContext = gl.getContext();
    const gpuInfo = extractGPUInfo(glContext);
    const preset = detectQualityPreset(gpuInfo);

    console.log(`[QualityAutoDetect] GPU: ${gpuInfo.rendererName ?? 'unknown'}, maxTex: ${gpuInfo.maxTextureSize} → ${preset}`);

    useStore.getState().setQualityPreset(preset);
    localStorage.setItem('moduhome-gpu-detected', 'true');
  }, [gl, hasHydrated]);

  return null;
}
