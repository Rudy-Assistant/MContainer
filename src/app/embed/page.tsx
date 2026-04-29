"use client";

/**
 * /embed — Chromeless 3D viewer for embedding ModuHome designs in third-party
 * sites (realtor pages, builder portfolios, blog posts).
 *
 * Query params:
 *   ?d=<lz-encoded design>   pre-loaded design (same encoding as share URL)
 *   ?walk=1                  start in Walkthrough mode (FPV showroom)
 *
 * postMessage protocol (window.parent):
 *   { type: 'moduhome-ready' }                emitted when canvas is ready
 *   { type: 'moduhome-set-design', design }   parent → iframe to swap designs
 *
 * No sidebar, hotbar, toolbar, or modals are mounted — the canvas owns the
 * full viewport. The user can orbit / walk through but cannot edit (no UI
 * affordances for it).
 */

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useStore } from '@/store/useStore';
import { ViewMode } from '@/types/container';
import { decodeDesign, type SharedDesign } from '@/utils/shareUrl';

const SceneCanvas = dynamic(
  () => import('@/components/three/SceneCanvas'),
  { ssr: false },
);

export default function EmbedPage() {
  const hasHydrated = useStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const designParam = params.get('d');
    if (designParam) {
      const design = decodeDesign(designParam);
      if (design) useStore.getState().importSharedDesign(design);
    }
    if (params.get('walk') === '1') {
      useStore.getState().setViewMode(ViewMode.Walkthrough);
    }

    // postMessage handshake with parent frame
    const onMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'moduhome-set-design') {
        const design = e.data.design as SharedDesign;
        if (design) useStore.getState().importSharedDesign(design);
      }
    };
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'moduhome-ready' }, '*');

    return () => window.removeEventListener('message', onMessage);
  }, [hasHydrated]);

  if (!hasHydrated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh', background: 'var(--background, #f4f6f8)', fontFamily: 'system-ui, sans-serif', color: 'var(--text-main, #37474f)', fontSize: 13 }}>
        Loading viewer…
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <SceneCanvas />
    </div>
  );
}
