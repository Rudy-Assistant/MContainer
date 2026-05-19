"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/store/useStore";
import { ContainerSize, ViewMode } from "@/types/container";
import Sidebar from "@/components/ui/Sidebar";
import BudgetModal from "@/components/ui/BudgetModal";
import WizardModal from "@/components/ui/WizardModal";
import MobileGate from "@/components/ui/MobileGate";
import StructureEditorModal from "@/components/ui/StructureEditorModal";
import FloorDetailModal from "@/components/ui/FloorDetailModal";
import ContainerContextMenu from "@/components/ui/ContainerContextMenu";
import FaceFilterWidget from "@/components/ui/FaceFilterWidget";
import TopToolbar from "@/components/ui/TopToolbar";
import { DestructiveToast } from "@/components/ui/DestructiveToast";
import { AutoStairsAffordance } from "@/components/ui/AutoStairsAffordance";
import { AdvancedSettingsToggleHotkey } from "@/components/ui/AdvancedSettingsToggleHotkey";
import { SmartRuleToast } from "@/components/ui/SmartRuleToast";
import { FirstLaunchHint } from "@/components/ui/FirstLaunchHint";
import { WelcomeWizard } from "@/components/ui/WelcomeWizard";
import { DragPrecisionOverlay } from "@/components/ui/DragPrecisionOverlay";
import { DuplicateHotkey } from "@/components/ui/DuplicateHotkey";
import { ToastEscapeHotkey } from "@/components/ui/ToastEscapeHotkey";
// import SmartHotbar from "@/components/ui/SmartHotbar"; // replaced by RecentItemsBar (Task 6)
import RecentItemsBar from "@/components/ui/RecentItemsBar";
import CustomHotbar from "@/components/ui/CustomHotbar";
import FaceContextMenu from "@/components/ui/FaceContextMenu";
import MaterialPaletteModal from "@/components/ui/MaterialPaletteModal";
import AIDesignModal from "@/components/ui/AIDesignModal";
// FormCatalog and SkinEditor replaced by unified BottomPanel (Sims-style drawer)
import BottomPanel from "@/components/ui/BottomPanel";
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

    // Apply dark mode from store state
    const dm = useStore.getState().darkMode;
    if (dm) document.documentElement.setAttribute('data-theme', 'dark');

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
      // Fresh state with no containers → open the model-home wizard so the user's
      // first impression is a curated starting-layout picker, not an anonymous
      // empty container they didn't ask for. The wizard falls back to a default
      // container if the user dismisses it.
      const store = useStore.getState();
      if (Object.keys(store.containers).length === 0) {
        store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
        if (!store.wizardOpen) store.openWizard();
      }
    }
  }, [hasHydrated]);
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
  const [aiDesignOpen, setAiDesignOpen] = useState(false);
  const viewMode = useStore((s) => s.viewMode);
  const isWalkthrough = viewMode === ViewMode.Walkthrough;
  const isBlueprint = viewMode === ViewMode.Blueprint;
  const isPreviewMode = useStore((s) => s.isPreviewMode);
  const hasHydrated = useStore((s) => s._hasHydrated);
  const activeHotbarSlot = useStore((s) => s.activeHotbarSlot);
  const showHotbar = useStore((s) => s.showHotbar);
  const sceneFadeActive = useStore((s) => s.sceneFadeActive);
  useHydrationSeed();

  if (!hasHydrated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh', background: 'var(--background, #f4f6f8)', fontFamily: 'system-ui, sans-serif', color: 'var(--text-main, #37474f)' }}>
        Loading project...
      </div>
    );
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-white">
      {/* Top Header Toolbar - Production Light Theme */}
      <TopToolbar
        onOpenBudget={() => setBudgetOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenAiDesign={() => setAiDesignOpen(true)}
      />
      {/* U8: destructive-action toast — fixed-position overlay; renders nothing
          when no recent destructive action. Mounted at app shell so it persists
          across sidebar/canvas toggles. */}
      <DestructiveToast />
      {/* U4: "+ Stairs" inline affordance after a successful stack. */}
      <AutoStairsAffordance />
      {/* U5 second-half: Ctrl+Shift+A toggles showAdvancedSettings — surfaces
          the Smart/Manual pill in the toolbar without requiring DevTools. */}
      <AdvancedSettingsToggleHotkey />
      {/* U6 second-half: contextual smart-rule opt-out toast. Renders below
          DestructiveToast when a smart rule has fired. */}
      <SmartRuleToast />
      {/* Plan deferred #4: first-launch announcement banner explaining where
          the Smart/Manual toggle went + the new keyboard hint. Shows once. */}
      <FirstLaunchHint />
      {/* Sprint B1+B2: first-launch wizard surfacing existing MODEL_HOMES
          so new users skip the blank-canvas problem (Lumion/Sims/Planner 5D
          consumer-app pattern). Suppresses itself when containers already
          exist (returning user). */}
      <WelcomeWizard />
      {/* Sprint C2+C3: type-to-set + axis-lock during container drag */}
      <DragPrecisionOverlay />
      {/* Sprint C4: Ctrl+D duplicates selection */}
      <DuplicateHotkey />
      {/* Global Esc handler — dismisses all active toasts at once. Capture-
          phase so it fires before walkthrough-exit / selection-clear when a
          toast is up. */}
      <ToastEscapeHotkey />

      {/* Workspace: Sidebar + (Canvas + BottomPanel) */}
      <div className="flex flex-1 min-h-0">
        {/* Left Super-Sidebar (Library ↔ Inspector) — hidden in walkthrough and preview */}
        {!isWalkthrough && !isPreviewMode && <Sidebar />}

        {/* Canvas Area — onContextMenu absolutely prevented */}
        <div className="flex-1 relative" style={{ backgroundColor: "var(--background, #f4f6f8)", cursor: activeHotbarSlot !== null && !isWalkthrough ? 'crosshair' : 'default' }} onContextMenu={(e) => e.preventDefault()}>
          <SceneCanvas />
          {/* Scene fade — soft veil during disruptive transitions (Reset, AI replace, view switch) */}
          <div className={`scene-fade-overlay${sceneFadeActive ? ' scene-fade-active' : ''}`} aria-hidden />

          {/* Grab mode overlay */}
          <GrabModeOverlay />

          {/* Face context menu — surface-aware right-click actions */}
          {!isPreviewMode && <FaceContextMenu />}

          {/* Level selector lives in TopToolbar (BlueprintLevelChips). The
              old right-side LevelSlicer + canvas-overlaid chip strip were
              consolidated per Bruce 2026-05-06 round-3 audit. */}

          {/* Face filter widget — restrict pointer events to roof / walls / floor */}
          {/* FaceFilterWidget gates 3D pointer events by face-category. In
              top-down BP the cube is visually inconsistent (no isometric
              context) and pointer-gating doesn't help — clutter only.
              Bruce 2026-05-06 audit. */}
          {!isWalkthrough && !isBlueprint && !isPreviewMode && <FaceFilterWidget />}

          {/* Hotbars — visible when showHotbar enabled (not walkthrough, not preview) */}
          {showHotbar && !isWalkthrough && !isPreviewMode && <CustomHotbar />}
          {/* SmartHotbar replaced by RecentItemsBar (Task 6 — Sims-Style UI Overhaul Plan A)
              SmartHotbar.tsx kept for CssVoxelIcon export used by CustomHotbar and UserLibrary */}
          {showHotbar && !isPreviewMode && <RecentItemsBar />}

          {/* Form picker strip — thin floating bar above status dock (hidden with hotbar) */}
          {showHotbar && !isPreviewMode && <BottomPanel />}

          {/* Bottom dock removed — TOD, cost, compass moved to TopToolbar */}

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

              {/* Polished Instructions */}
              <div
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-6 px-6 py-3 pointer-events-none"
                style={{
                  background: "rgba(15, 23, 42, 0.4)",
                  backdropFilter: "blur(12px)",
                  borderRadius: "100px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white/90">WASD</span>
                  <span className="text-[11px] font-medium text-white/70">Move</span>
                </div>
                <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white/90">MOUSE</span>
                  <span className="text-[11px] font-medium text-white/70">Look</span>
                </div>
                <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white/90">SPACE</span>
                  <span className="text-[11px] font-medium text-white/70">Interact</span>
                </div>
                <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white/90">T</span>
                  <span className="text-[11px] font-medium text-white/70">Auto-Tour</span>
                </div>
                <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-bold text-white/90">ESC</span>
                  <span className="text-[11px] font-medium text-white/70">Exit</span>
                </div>
              </div>            </>
          )}
        </div>
      </div>

      {/* Budget Modal */}
      {!isWalkthrough && (
        <BudgetModal open={budgetOpen} onClose={() => setBudgetOpen(false)} />
      )}

      {/* Material Palette Modal */}
      <MaterialPaletteModal open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* AI Design Modal — opened from primary toolbar button or Settings overflow */}
      <AIDesignModal open={aiDesignOpen} onClose={() => setAiDesignOpen(false)} />

      {/* Detail Editor Modals */}
      <StructureEditorModal />
      <FloorDetailModal />
      <ContainerContextMenu />
      <WizardModal />

      {/* Mobile gate: desktop-first editor doesn't fit sub-tablet layouts. */}
      <MobileGate />
    </div>
  );
}
