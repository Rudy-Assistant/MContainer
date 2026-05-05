"use client";

import { type ReactNode, useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * RendererReadyGate — defers child mount until the WebGL context is fully
 * initialized AND not lost. Without this, EffectComposer or CubeCamera can read
 * `renderer.getContext().getContextAttributes()` while the underlying
 * context is still null, throwing "Cannot read properties of null
 * (reading 'alpha')".
 */
export function RendererReadyGate({ children }: { children: ReactNode }) {
  const gl = useThree((s) => s.gl);
  const [ready, setReady] = useState(() => {
    // Best-effort sync check on first render
    try {
      const ctx = gl.getContext();
      const attrs = ctx?.getContextAttributes?.();
      return !!attrs && !ctx.isContextLost();
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    const tryReady = () => {
      if (cancelled) return;
      try {
        const ctx = gl.getContext();
        const attrs = ctx?.getContextAttributes?.();
        if (attrs && !ctx.isContextLost()) {
          setReady(true);
          return;
        }
      } catch { /* keep polling */ }
      requestAnimationFrame(tryReady);
    };
    requestAnimationFrame(tryReady);

    // Also recover from context loss/restored at runtime
    const canvas = gl.domElement;
    const onLost = (e: Event) => { e.preventDefault(); setReady(false); };
    const onRestored = () => setReady(true);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      cancelled = true;
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [ready, gl]);

  if (!ready) return null;
  return <>{children}</>;
}
