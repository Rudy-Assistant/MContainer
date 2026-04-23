"use client";

/**
 * TOP TOOLBAR - Responsive Production Release
 *
 * - w-full, max-w-[100vw], overflow-hidden — NEVER triggers horizontal scrollbar
 * - Icon-only buttons on <1024px, icon+label on wider screens
 * - View pill always visible, center tools shrink/wrap gracefully
 */

import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { ViewMode } from "@/types/container";
import {
  Grid2x2,
  Box,
  Footprints,
  Undo2,
  Redo2,
  Wand2,
} from "lucide-react";
import WarningBadge from './WarningBadge';
import { useNarrowToolbar } from '@/hooks/useNarrowToolbar';
import TimeOfDayControl from "./TimeOfDayControl";
import CompassControl from "./CompassControl";
import CostControl from "./CostControl";
import AppearanceControl from "./AppearanceControl";
import SettingsMenuControl from "./SettingsMenuControl";

interface TopToolbarProps {
  onOpenBudget: () => void;
  onOpenPalette: () => void;
}

export default function TopToolbar({ onOpenBudget, onOpenPalette }: TopToolbarProps) {
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const designMode = useStore((s) => s.designMode);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const openWizard = useStore((s) => s.openWizard);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  useEffect(() => {
    const check = () => {
      const t = useStore.temporal.getState();
      setCanUndo(t.pastStates.length > 0);
      setCanRedo(t.futureStates.length > 0);
    };
    check();
    // Poll temporal state on a reasonable interval (store subscribe doesn't cover temporal)
    const id = setInterval(check, 500);
    return () => clearInterval(id);
  }, []);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [todOpen, setTodOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);

  const narrow = useNarrowToolbar();

  // ── Shared button styles ──────────────────────────────────

  const btn = (enabled: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    height: "40px",
    padding: "0 12px",
    borderRadius: "8px",
    border: `1px solid var(--btn-border, #e5e7eb)`,
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: "13px",
    fontWeight: 500,
    color: enabled ? "var(--text-main, #374151)" : "var(--text-dim, #9ca3af)",
    background: enabled ? "var(--btn-bg, #fff)" : "var(--surface-alt, #f9fafb)",
    transition: "all 150ms ease",
    whiteSpace: "nowrap",
    flexShrink: 0,
  });

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        maxWidth: "100vw",
        height: "56px",
        padding: "0 12px",
        background: "var(--panel-bg)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "var(--panel-shadow)",
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
        overflow: "visible",
        flexShrink: 0,
        position: "relative",
        zIndex: 50,
      }}
    >
      {/* ═══ ZONE A: Logo ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main, #111827)" }}>ModuHome</span>
        <span style={{ fontSize: "9px", fontWeight: 600, padding: "2px 6px", borderRadius: "9999px", background: "var(--accent, #2563eb)", color: "#fff" }}>
          PRO
        </span>
      </div>

      {/* ═══ ZONE B: Undo/Redo + View Mode (center, prominent) ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 auto" }}>
        {/* Undo / Redo */}
        <button onClick={undo} style={btn(canUndo)} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 size={15} />
        </button>
        <button onClick={redo} style={btn(canRedo)} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo2 size={15} />
        </button>

        <button onClick={openWizard} style={btn(true)} title="Quick Setup">
          <Wand2 size={15} />
        </button>

        <div style={{ width: "1px", height: "20px", background: "var(--border, #e5e7eb)", flexShrink: 0 }} />

        {/* ── View Mode Tabs (prominent, Sims-style) ── */}
        <div style={{
          display: "flex", alignItems: "center",
          background: "var(--input-bg, #f3f4f6)", borderRadius: "10px", padding: "3px",
          border: "1px solid var(--btn-border, #e5e7eb)", flexShrink: 0,
        }}>
          {([
            { mode: ViewMode.Blueprint, label: "Blueprint", kbd: "Alt+4", icon: <Grid2x2 size={14} /> },
            { mode: ViewMode.Realistic3D, label: "Design", kbd: "Alt+3", icon: <Box size={14} /> },
            { mode: ViewMode.Walkthrough, label: "Walk", kbd: "F", icon: <Footprints size={14} /> },
          ] as const).map(({ mode, label, kbd, icon }) => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                data-testid={`view-${mode}`}
                onClick={() => setViewMode(mode)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                  padding: "6px 10px", borderRadius: "8px", border: "none", cursor: "pointer",
                  color: active ? "#fff" : "var(--text-muted, #6b7280)",
                  background: active ? "var(--accent, #2563eb)" : "transparent",
                  boxShadow: active ? "0 1px 3px rgba(37,99,235,0.3)" : "none",
                  transition: "all 150ms ease", fontSize: "12px", fontWeight: active ? 600 : 500,
                }}
                title={`${label} (${kbd})`}
              >
                {icon}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ ZONE C: Right — Floor/Roof + Wall Vis + Overflow ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>

        {/* ── Smart/Manual pill ── */}
        <div style={{
          display: "flex", background: "var(--input-bg, #f3f4f6)", borderRadius: 6, overflow: "hidden",
          border: "1px solid var(--btn-border, #e5e7eb)", fontSize: 11, fontWeight: 600,
        }}>
          {(['smart', 'manual'] as const).map((m) => (
            <button key={m} onClick={() => useStore.getState().setDesignMode(m)} style={{
              padding: "5px 10px", border: "none", cursor: "pointer",
              background: designMode === m ? "var(--accent, #2563eb)" : "transparent",
              color: designMode === m ? "#fff" : "var(--text-muted, #6b7280)",
              transition: "all 100ms",
            }}>
              {narrow ? (m === 'smart' ? 'S' : 'M') : (m === 'smart' ? 'Smart' : 'Manual')}
            </button>
          ))}
        </div>

        {/* Floor/Ceiling/Frame view toggle moved to MatrixEditor header (Phase 2 declutter) */}

        {/* Wall Visibility, Roof, Skin moved to Settings dropdown (Phase 1 declutter) */}

        <CostControl
          open={costOpen}
          setOpen={setCostOpen}
          onOpen={() => {
            setTodOpen(false);
            setCompassOpen(false);
          }}
          onOpenBudget={onOpenBudget}
        />

        <TimeOfDayControl
          open={todOpen}
          setOpen={setTodOpen}
          onOpen={() => {
            setCostOpen(false);
            setCompassOpen(false);
          }}
        />

        <CompassControl
          open={compassOpen}
          setOpen={setCompassOpen}
          onOpen={() => {
            setTodOpen(false);
            setCostOpen(false);
          }}
        />

        {/* Warning badge */}
        <WarningBadge />

        <AppearanceControl
          open={appearanceOpen}
          setOpen={setAppearanceOpen}
          onOpen={() => setDevToolsOpen(false)}
          onOpenPalette={onOpenPalette}
          buttonStyle={btn(true)}
        />

        <SettingsMenuControl
          open={devToolsOpen}
          setOpen={setDevToolsOpen}
          onOpen={() => setAppearanceOpen(false)}
          buttonStyle={btn(true)}
        />

        {/* Old View Pill removed — now prominent tabs in ZONE B center */}

        {/* Old Settings dropdown removed — functionality merged into overflow ⋯ menu */}
      </div>
    </header>
  );
}
