"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/store/useStore";
import { ContainerSize, ViewMode } from "@/types/container";
import { useFrameStore } from "@/store/frameStore";
import Sidebar from "@/components/ui/Sidebar";
import BayContextMenu from "@/components/ui/BayContextMenu";
import BottomDock from "@/components/ui/BottomDock";
import BudgetModal from "@/components/ui/BudgetModal";
import StructureEditorModal from "@/components/ui/StructureEditorModal";
import FloorDetailModal from "@/components/ui/FloorDetailModal";
import ContainerContextMenu from "@/components/ui/ContainerContextMenu";
import LevelSlicer from "@/components/ui/LevelSlicer";
import TopToolbar from "@/components/ui/TopToolbar";
import SmartHotbar from "@/components/ui/SmartHotbar";
import CustomHotbar from "@/components/ui/CustomHotbar";
import VoxelContextMenu from "@/components/ui/VoxelContextMenu";
import FaceContextMenu from "@/components/ui/FaceContextMenu";
import MaterialPaletteModal from "@/components/ui/MaterialPaletteModal";
// Legacy GameHUD, Hotbar, StyleSelector removed in Phase 7

const SceneCanvas = dynamic(
  () => import("@/components/three/SceneCanvas"),
  { ssr: false }
);

// ── Seed + Hydration ────────────────────────────────────────

/** Hydration hook — seeds a default container on fresh state. Also checks for shared design URL. */
function useHydrationSeed() {
  const hasHydrated = useStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (typeof window === 'undefined') return;

    // Check for shared design URL parameter
    const params = new URLSearchParams(window.location.search);
    const designParam = params.get('d');
    if (designParam) {
      import('@/utils/shareUrl').then(({ decodeDesign }) => {
        const design = decodeDesign(designParam);
        if (design) {
          useStore.getState().importSharedDesign(design);
          window.history.replaceState({}, '', window.location.pathname);
        }
      });
    } else {
      // Fresh state with no containers → seed a default container
      const store = useStore.getState();
      if (Object.keys(store.containers).length === 0) {
        store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
      }
    }
  }, [hasHydrated]);
}

// ── Canvas Hint Overlay ───────────────────────────────────────

function CanvasHintOverlay() {
  const viewMode = useStore((s) => s.viewMode);
  const buildMode = useFrameStore((s) => s.buildMode);
  const hint =
    viewMode === ViewMode.Blueprint    ? "Click=select · Drag=move · Right-click=menu · G=group · Ctrl+Z=undo"
    : viewMode === ViewMode.Walkthrough ? "WASD · Shift=sprint · Space=cycle face · V=exit"
    :                                     "L-drag=orbit · R-drag=pan · Scroll=zoom · 1-9=hotbar · E=apply";
  return (
    <div style={{
      position: 'absolute', bottom: 12, right: 16, zIndex: 30,
      fontSize: 10, color: 'rgba(0,0,0,0.38)',
      fontFamily: 'system-ui, sans-serif',
      pointerEvents: 'none', userSelect: 'none',
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(6px)',
      padding: '3px 8px', borderRadius: 6,
    }}>
      {hint}{buildMode ? ' · BUILD MODE (B)' : ''}
    </div>
  );
}

// ── Grab Mode Overlay ────────────────────────────────────────

function GrabModeOverlay() {
  const active = useStore((s) => s.grabMode.active);
  if (!active) return null;
  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 40,
      background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '6px 16px',
      borderRadius: 8, fontSize: 12, fontWeight: 600, pointerEvents: 'none',
      backdropFilter: 'blur(6px)',
    }}>
      GRAB MODE — Arrow keys to move (Shift=1m) · Enter to confirm · Esc to cancel
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────

export default function Home() {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const viewMode = useStore((s) => s.viewMode);
  const isWalkthrough = viewMode === ViewMode.Walkthrough;
  const isPreviewMode = useStore((s) => s.isPreviewMode);
  const hasHydrated = useStore((s) => s._hasHydrated);
  const activeHotbarSlot = useStore((s) => s.activeHotbarSlot);
  useHydrationSeed();

  if (!hasHydrated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh', background: '#f4f6f8', fontFamily: 'system-ui, sans-serif', color: '#37474f' }}>
        Loading project...
      </div>
    );
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-white">
      {/* Top Header Toolbar - Production Light Theme */}
      <TopToolbar onOpenBudget={() => setBudgetOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />

      {/* Workspace: Sidebar + Canvas */}
      <div className="flex flex-1 min-h-0">
        {/* Left Super-Sidebar (Library ↔ Inspector) — hidden in walkthrough and preview */}
        {!isWalkthrough && !isPreviewMode && <Sidebar />}

        {/* Canvas Area — onContextMenu absolutely prevented */}
        <div className="flex-1 relative" style={{ backgroundColor: "#f4f6f8", cursor: activeHotbarSlot !== null && !isWalkthrough ? 'crosshair' : 'default' }} onContextMenu={(e) => e.preventDefault()}>
          <SceneCanvas />

          {/* Canvas hint overlay — bottom-right, hidden in walkthrough (has its own instructions) */}
          {!isWalkthrough && !isPreviewMode && <CanvasHintOverlay />}

          {/* Grab mode overlay */}
          <GrabModeOverlay />

          {/* Bay context menu — available in all modes except preview */}
          {!isPreviewMode && <BayContextMenu />}

          {/* Voxel context menu — right-click on active voxel faces */}
          {!isPreviewMode && <VoxelContextMenu />}

          {/* Face context menu — surface-aware right-click actions */}
          {!isPreviewMode && <FaceContextMenu />}

          {/* Level Selector — hidden in FPV where level navigation is irrelevant */}
          {!isWalkthrough && <LevelSlicer />}

          {/* Hotbars — visible when container selected (not walkthrough, not preview) */}
          {!isWalkthrough && !isPreviewMode && <CustomHotbar />}
          {/* SmartHotbar: always rendered outside walkthrough (self-hides via opacity when !hasSelection);
              also rendered in walkthrough for FPV targeting feedback */}
          {!isPreviewMode && <SmartHotbar />}

          {/* Bottom dock — persistent in all modes except preview (screenshot) mode */}
          {!isPreviewMode && (
            <BottomDock onOpenBudget={() => setBudgetOpen(true)} />
          )}

          {/* Walkthrough overlay: crosshair + instructions */}
          {isWalkthrough && (

            <>
              {/* Crosshair */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30">
                <div className="w-6 h-6 relative">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-white/60" />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-white/60" />
                </div>
              </div>

              {/* Instructions */}
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 rounded-lg px-4 py-2 pointer-events-none"
                style={{
                  background: "rgba(0, 0, 0, 0.5)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <span className="text-[11px] text-white/80">
                  WASD move · Arrows look · Mouse look · Shift sprint · Q/Z fly up/down · Click/Space cycle panel · E preset · Right-click menu · T tour · ESC exit
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right sidebar removed — Inspector is now part of the unified Sidebar */}
      </div>

      {/* Budget Modal */}
      {!isWalkthrough && (
        <BudgetModal open={budgetOpen} onClose={() => setBudgetOpen(false)} />
      )}

      {/* Material Palette Modal */}
      <MaterialPaletteModal open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Detail Editor Modals */}
      <StructureEditorModal />
      <FloorDetailModal />
      <ContainerContextMenu />
    </div>
  );
}
