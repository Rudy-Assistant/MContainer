"use client";

/**
 * TOP TOOLBAR - Responsive Production Release
 *
 * - w-full, max-w-[100vw], overflow-hidden — NEVER triggers horizontal scrollbar
 * - Icon-only buttons on <1024px, icon+label on wider screens
 * - View pill always visible, center tools shrink/wrap gracefully
 */

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { ContainerSize, ViewMode } from "@/types/container";
import {
  Trash2,
  Group,
  Download,
  Grid2x2,
  Grid3x3,
  Box,
  Footprints,
  PanelTop,
  ChevronDown,
  Layers,
  Palette,
  Share2,
  RotateCcw,
  RotateCw,
  Undo2,
  Redo2,
  Paintbrush,
  Scan,
  Ruler,
  Tag,
  Mountain,
  Bug,
  SlidersHorizontal,
  Moon,
  Sun,
  Wand2,
} from "lucide-react";
import WarningBadge from './WarningBadge';
import { useNarrowToolbar } from '@/hooks/useNarrowToolbar';
import { Clock, Compass, DollarSign } from "lucide-react";
import { formatUSD as fmtUSD } from "@/utils/formatters";
import { THEMES, THEME_IDS, type ThemeId } from "@/config/themes";
import { GROUND_PRESET_IDS, GROUND_PRESETS, type GroundPresetId } from "@/config/groundPresets";
import { QUALITY_PRESET_IDS, type QualityPresetId } from "@/config/qualityPresets";
import { buildShareUrl } from "@/utils/shareUrl";
import { exportSceneToGLB } from "@/utils/exportGLB";

interface TopToolbarProps {
  onOpenBudget: () => void;
  onOpenPalette: () => void;
}

export default function TopToolbar({ onOpenBudget, onOpenPalette }: TopToolbarProps) {
  const selection = useStore((s) => s.selection);
  const containers = useStore((s) => s.containers);
  const removeContainer = useStore((s) => s.removeContainer);
  const clearSelection = useStore((s) => s.clearSelection);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const exportState = useStore((s) => s.exportState);
  const createZone = useStore((s) => s.createZone);
  const setAllOuterWalls = useStore((s) => s.setAllOuterWalls);
  const toggleRoof = useStore((s) => s.toggleRoof);
  const zones = useStore((s) => s.zones);
  const removeZone = useStore((s) => s.removeZone);
  const removeContainerFromZone = useStore((s) => s.removeContainerFromZone);
  const generateRooftopDeck = useStore((s) => s.generateRooftopDeck);
  const updateContainerRotation = useStore((s) => s.updateContainerRotation);
  const addContainer = useStore((s) => s.addContainer);
  const debugMode = useStore((s) => s.debugMode);
  const toggleDebugMode = useStore((s) => s.toggleDebugMode);
  const dollhouseActive = useStore((s) => s.dollhouseActive);
  const toggleDollhouse = useStore((s) => s.toggleDollhouse);
  const tapeActive = useStore((s) => s.tapeActive);
  const toggleTape = useStore((s) => s.toggleTape);
  const showFurnitureLabels = useStore((s) => s.showFurnitureLabels);
  const toggleFurnitureLabels = useStore((s) => s.toggleFurnitureLabels);
  const currentTheme = useStore((s) => s.currentTheme);
  const darkMode = useStore((s) => s.darkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);
  const setTheme = useStore((s) => s.setTheme);
  const groundPreset = useStore((s) => s.environment.groundPreset) as GroundPresetId | undefined;
  const setGroundPreset = useStore((s) => s.setGroundPreset);
  const qualityPreset = useStore((s) => s.qualityPreset) as QualityPresetId;
  const setQualityPreset = useStore((s) => s.setQualityPreset);
  const setActivePalette = useStore((s) => s.setActivePalette);
  const designComplexity = useStore((s) => s.designComplexity);
  const setDesignComplexity = useStore((s) => s.setDesignComplexity);
  const inspectorView = useStore((s) => s.inspectorView);
  const setInspectorView = useStore((s) => s.setInspectorView);
  const frameMode = useStore((s) => s.frameMode);
  const toggleFrameMode = useStore((s) => s.toggleFrameMode);
  const designMode = useStore((s) => s.designMode);
  const wallCutMode = useStore((s) => s.wallCutMode);
  const setWallCutMode = useStore((s) => s.setWallCutMode);
  const hideRoof = useStore((s) => s.hideRoof);
  const toggleHideRoof = useStore((s) => s.toggleHideRoof);
  const hideSkin = useStore((s) => s.hideSkin);
  const toggleHideSkin = useStore((s) => s.toggleHideSkin);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const openWizard = useStore((s) => s.openWizard);
  const showHotbar = useStore((s) => s.showHotbar);
  const toggleHotbar = useStore((s) => s.toggleHotbar);
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
  const timeOfDay = useStore((s) => s.environment.timeOfDay);
  const setTimeOfDay = useStore((s) => s.setTimeOfDay);
  const northOffset = useStore((s) => s.environment.northOffset);
  const setNorthOffset = useStore((s) => s.setNorthOffset);
  const getEstimate = useStore((s) => s.getEstimate);
  const containerCount = useStore((s) => Object.keys(s.containers).length);

  const [wallMenuOpen, setWallMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [todOpen, setTodOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);

  const todRef = useRef<HTMLDivElement>(null);
  const costRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLDivElement>(null);

  // Close popups on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (todOpen && todRef.current && !todRef.current.contains(e.target as Node)) setTodOpen(false);
      if (costOpen && costRef.current && !costRef.current.contains(e.target as Node)) setCostOpen(false);
      if (compassOpen && compassRef.current && !compassRef.current.contains(e.target as Node)) setCompassOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [todOpen, costOpen, compassOpen]);

  const formatTime = (h: number) => {
    const hr = Math.floor(h);
    const mn = Math.floor((h - hr) * 60);
    return `${hr.toString().padStart(2, '0')}:${mn.toString().padStart(2, '0')}`;
  };

  const appearanceRef = useRef<HTMLDivElement>(null);
  const devToolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!appearanceOpen) return;
    const handler = (e: MouseEvent) => {
      if (appearanceRef.current && !appearanceRef.current.contains(e.target as Node)) {
        setAppearanceOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [appearanceOpen]);

  useEffect(() => {
    if (!devToolsOpen) return;
    const handler = (e: MouseEvent) => {
      if (devToolsRef.current && !devToolsRef.current.contains(e.target as Node)) {
        setDevToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [devToolsOpen]);

  const activeGround = groundPreset && groundPreset in GROUND_PRESETS
    ? groundPreset as GroundPresetId : "grass";

  const THEME_COLORS: Record<ThemeId, string> = {
    industrial: "#607d8b", japanese: "#5d4037", desert: "#d4a373",
  };
  const GROUND_COLORS: Record<GroundPresetId, string> = {
    grass: "#4a7a30", concrete: "#8a8a88", gravel: "#7a7568", dirt: "#6b5b3e",
  };

  const narrow = useNarrowToolbar();
  const hasSelection = selection.length > 0;
  const isWalkthrough = viewMode === ViewMode.Walkthrough;

  const handleDelete = () => {
    selection.forEach((id) => removeContainer(id));
    clearSelection();
  };

  const handleGroup = () => {
    if (selection.length < 2) return;
    createZone(`Group ${Date.now() % 1000}`, [...selection]);
  };

  const handleUngroup = () => {
    if (selection.length === 0) return;
    for (const zoneId of Object.keys(zones)) {
      const zone = zones[zoneId];
      const hits = selection.filter((cid) => zone.containerIds.includes(cid));
      if (hits.length === 0) continue;
      if (hits.length >= zone.containerIds.length) {
        removeZone(zoneId);
      } else {
        for (const cid of hits) removeContainerFromZone(zoneId, cid);
      }
    }
  };

  const hasGrouped = selection.some((id) =>
    Object.values(zones).some((z) => z.containerIds.includes(id))
  );

  const handleExport = () => {
    const json = exportState();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "moduhome-project.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Shared button styles ──────────────────────────────────

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    padding: "5px 10px",
    border: `1px solid ${active ? 'var(--accent, #2563eb)' : 'var(--btn-border, #e5e7eb)'}`,
    borderRadius: 6,
    cursor: "pointer",
    background: active ? "var(--accent, #2563eb)" : "transparent",
    color: active ? "#fff" : "var(--text-muted, #6b7280)",
    fontSize: 11,
    fontWeight: 600,
    transition: "all 100ms",
  });

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

        {/* ── Cost Total (frameless, green hover) ── */}
        {containerCount > 0 && (
          <div ref={costRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => { setCostOpen(!costOpen); setTodOpen(false); setCompassOpen(false); }}
              onMouseEnter={(e) => { if (!costOpen) e.currentTarget.style.color = '#16a34a'; }}
              onMouseLeave={(e) => { if (!costOpen) e.currentTarget.style.color = 'var(--text-muted)'; }}
              style={{
                display: 'flex', alignItems: 'center', gap: '3px',
                background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px',
                fontSize: '13px', fontWeight: 700, fontFamily: 'monospace',
                color: costOpen ? '#16a34a' : 'var(--text-muted)',
                transition: 'color 120ms',
              }}
              title="Cost breakdown"
            >
              {fmtUSD(getEstimate().breakdown.total)}
            </button>
            {costOpen && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: "6px",
                background: "var(--modal-bg, #fff)", borderRadius: "14px",
                boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
                border: "none", padding: "16px 20px", minWidth: "240px", zIndex: 50,
                color: "var(--text-main)",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Cost Breakdown</div>
                {(() => {
                  const est = getEstimate();
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { label: "Containers", val: est.breakdown.containers, color: "#64748b" },
                        { label: "Glass & Windows", val: est.breakdown.modules, color: "#64748b" },
                        { label: "Structural Cuts", val: est.breakdown.cuts, color: "#64748b" },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12 }}>
                          <span style={{ color }}>{label}</span>
                          <span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 13 }}>{fmtUSD(val)}</span>
                        </div>
                      ))}
                      <div style={{ height: 1, background: "var(--border-subtle, #e5e7eb)", margin: "4px 0" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 14 }}>
                        <span style={{ fontWeight: 700 }}>Total</span>
                        <span style={{ fontWeight: 800, fontFamily: "monospace", color: "#16a34a", fontSize: 16 }}>{fmtUSD(est.breakdown.total)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── Time of Day (frameless, blue hover) ── */}
        <div ref={todRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => { setTodOpen(!todOpen); setCostOpen(false); setCompassOpen(false); }}
            onMouseEnter={(e) => { if (!todOpen) e.currentTarget.style.color = '#3b82f6'; }}
            onMouseLeave={(e) => { if (!todOpen) e.currentTarget.style.color = 'var(--text-muted)'; }}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px',
              fontSize: '13px', fontWeight: 600, fontFamily: 'monospace',
              color: todOpen ? '#3b82f6' : 'var(--text-muted)',
              transition: 'color 120ms',
            }}
            title="Time of Day"
          >
            <Clock size={13} />
            {formatTime(timeOfDay)}
          </button>
          {todOpen && (
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: "6px",
              background: "linear-gradient(135deg, rgba(16,24,44,0.92), rgba(30,41,59,0.95))",
              borderRadius: "16px",
              boxShadow: "0 16px 48px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08)",
              border: "none", padding: "20px 24px", minWidth: "280px", zIndex: 50,
              color: "#f4f8ff", backdropFilter: "blur(20px) saturate(140%)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(220,229,255,0.7)", textTransform: "uppercase", letterSpacing: "0.14em" }}>Time of Day</span>
                <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", letterSpacing: "-0.04em", textShadow: "0 0 18px rgba(140,208,255,0.18)" }}>
                  {formatTime(timeOfDay)}
                </span>
              </div>
              <div style={{ position: "relative", padding: "10px 0 6px" }}>
                {/* Ambient glow behind track */}
                <div style={{
                  position: "absolute", left: 0, right: 0, top: "50%", height: 32, transform: "translateY(-50%)",
                  borderRadius: 999, filter: "blur(10px)", pointerEvents: "none",
                  background: `radial-gradient(circle at ${((timeOfDay / 24) * 100)}% 50%, rgba(123,211,255,0.25), rgba(139,92,246,0.15) 30%, transparent 60%)`,
                }} />
                {/* Track background */}
                <div style={{
                  position: "absolute", left: 0, right: 0, top: "50%", height: 10, transform: "translateY(-50%)",
                  borderRadius: 999, background: "rgba(10,16,34,0.6)", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12), inset 0 -1px 2px rgba(0,0,0,0.3)",
                }} />
                {/* Filled portion */}
                <div style={{
                  position: "absolute", left: 0, top: "50%", width: `${(timeOfDay / 24) * 100}%`, height: 10, transform: "translateY(-50%)",
                  borderRadius: 999, pointerEvents: "none",
                  background: "linear-gradient(90deg, #6ee7ff, #8b5cf6, #ff7cc8, #ffd166)",
                  boxShadow: "0 0 8px rgba(110,231,255,0.35), 0 0 20px rgba(139,92,246,0.2)",
                }} />
                <input type="range" min={0} max={24} step={0.25} value={timeOfDay}
                  onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
                  style={{
                    width: '100%', height: 30, appearance: 'none', background: 'transparent',
                    cursor: 'pointer', position: 'relative', zIndex: 2, margin: 0,
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(233,239,255,0.5)", marginTop: 6, fontFamily: "monospace" }}>
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Compass (frameless, purple hover) ── */}
        <div ref={compassRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => { setCompassOpen(!compassOpen); setTodOpen(false); setCostOpen(false); }}
            onMouseEnter={(e) => { if (!compassOpen) e.currentTarget.style.color = '#8b5cf6'; }}
            onMouseLeave={(e) => { if (!compassOpen) e.currentTarget.style.color = 'var(--text-muted)'; }}
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px',
              fontSize: '13px', fontWeight: 600, fontFamily: 'monospace',
              color: compassOpen ? '#8b5cf6' : 'var(--text-muted)',
              transition: 'color 120ms',
            }}
            title="North Direction"
          >
            <Compass size={13} />
            {Math.round(northOffset)}°
          </button>
          {compassOpen && (
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: "6px",
              background: "var(--modal-bg, #fff)", borderRadius: "14px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
              border: "none", padding: "16px 20px", minWidth: "220px", zIndex: 50,
              color: "var(--text-main)",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>North Direction</div>
              <input type="range" min={0} max={360} step={1} value={northOffset}
                onChange={(e) => setNorthOffset(parseFloat(e.target.value))}
                style={{
                  width: '100%', height: 8, borderRadius: 4, appearance: 'none', cursor: 'pointer',
                  background: `linear-gradient(90deg, #8b5cf6 0%, #c084fc ${(northOffset / 360) * 100}%, var(--border-subtle, #e5e7eb) ${(northOffset / 360) * 100}%)`,
                }}
              />
              <div style={{ textAlign: "center", marginTop: 8, fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: "#8b5cf6" }}>
                {Math.round(northOffset)}°
              </div>
            </div>
          )}
        </div>

        {/* Warning badge */}
        <WarningBadge />

        {/* Theme & Environment button (first) */}
        <div ref={appearanceRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            data-testid="btn-palette"
            onClick={() => { setAppearanceOpen(!appearanceOpen); setDevToolsOpen(false); }}
            style={{
              ...btn(true),
              borderColor: appearanceOpen ? "var(--accent)" : undefined,
              color: appearanceOpen ? "var(--accent)" : undefined,
            }}
            title="Theme & Environment"
          >
            <Paintbrush size={14} />
          </button>
          {appearanceOpen && (
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: "4px",
              background: "var(--modal-bg, #fff)", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              border: "1px solid var(--btn-border, #e5e7eb)", padding: "12px", minWidth: "220px", zIndex: 50,
            }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted, #6b7280)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                Theme
              </div>
              <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
                {THEME_IDS.map((tid) => {
                  const active = currentTheme === tid;
                  return (
                    <button
                      key={tid}
                      data-testid={`theme-${tid}`}
                      onClick={() => { setTheme(tid); setActivePalette(tid); }}
                      style={{
                        flex: 1, height: "32px", borderRadius: "6px", border: "1px solid",
                        borderColor: active ? THEME_COLORS[tid] : "#e5e7eb",
                        cursor: "pointer", fontSize: "10px", fontWeight: active ? 700 : 500,
                        color: active ? "#fff" : "#6b7280",
                        background: active ? THEME_COLORS[tid] : "#f9fafb",
                        transition: "all 150ms ease",
                      }}
                      title={THEMES[tid].label}
                    >
                      {THEMES[tid].label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted, #6b7280)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                Ground
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                {GROUND_PRESET_IDS.map((gid) => {
                  const active = activeGround === gid;
                  return (
                    <button
                      key={gid}
                      data-testid={`ground-${gid}`}
                      onClick={() => setGroundPreset(gid)}
                      style={{
                        flex: 1, height: "32px", borderRadius: "6px", border: "1px solid",
                        borderColor: active ? GROUND_COLORS[gid] : "#e5e7eb",
                        cursor: "pointer", fontSize: "10px", fontWeight: active ? 700 : 500,
                        color: active ? "#fff" : "#6b7280",
                        background: active ? GROUND_COLORS[gid] : "#f9fafb",
                        transition: "all 150ms ease",
                      }}
                      title={GROUND_PRESETS[gid].label}
                    >
                      {GROUND_PRESETS[gid].label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted, #6b7280)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "12px 0 8px" }}>
                Quality
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                {QUALITY_PRESET_IDS.map((qid) => {
                  const active = qualityPreset === qid;
                  return (
                    <button
                      key={qid}
                      data-testid={`quality-${qid}`}
                      onClick={() => setQualityPreset(qid)}
                      style={{
                        flex: 1, height: "32px", borderRadius: "6px", border: "1px solid",
                        borderColor: active ? "var(--accent, #2563eb)" : "#e5e7eb",
                        cursor: "pointer", fontSize: "10px", fontWeight: active ? 700 : 500,
                        color: active ? "#fff" : "#6b7280",
                        background: active ? "var(--accent, #2563eb)" : "#f9fafb",
                        transition: "all 150ms ease",
                        textTransform: "capitalize",
                      }}
                      title={`${qid.charAt(0).toUpperCase() + qid.slice(1)} quality`}
                    >
                      {qid.charAt(0).toUpperCase() + qid.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Settings menu (second) */}
        <div ref={devToolsRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            data-testid="btn-more"
            onClick={() => { setDevToolsOpen(!devToolsOpen); setAppearanceOpen(false); }}
            style={btn(true)}
            title="Settings"
          >
            <SlidersHorizontal size={14} />
          </button>
          {devToolsOpen && (
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: "4px",
              background: "var(--modal-bg, #fff)", borderRadius: "10px",
              boxShadow: "var(--panel-shadow, 0 8px 24px rgba(0,0,0,0.15))",
              border: "1px solid var(--border, #e5e7eb)", padding: "6px", minWidth: "220px", zIndex: 50,
              color: "var(--text-main)",
            }}>
              {/* Visibility */}
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 10px 2px" }}>Visibility</div>
              <div style={{ display: "flex", gap: 2, padding: "2px 6px 4px" }}>
                {([
                  { mode: 'full' as const, label: '▮', title: 'Full Walls' },
                  { mode: 'half' as const, label: '▄', title: 'Half Walls' },
                  { mode: 'down' as const, label: '▁', title: 'Walls Down' },
                ] as const).map(({ mode, label, title }) => (
                  <button key={mode} onClick={() => setWallCutMode(mode)} title={title} style={{
                    flex: 1, padding: "5px 0", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                    background: wallCutMode === mode ? "var(--accent)" : "var(--input-bg, #f3f4f6)",
                    color: wallCutMode === mode ? "#fff" : "var(--text-muted)", transition: "all 100ms",
                  }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 2, padding: "0 6px 6px" }}>
                <button onClick={toggleHideRoof} style={{
                  flex: 1, padding: "5px 0", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: hideRoof ? "var(--accent)" : "var(--input-bg, #f3f4f6)",
                  color: hideRoof ? "#fff" : "var(--text-muted)", transition: "all 100ms",
                }}>
                  {hideRoof ? "Roof Hidden" : "Hide Roof"}
                </button>
                <button onClick={toggleHideSkin} style={{
                  flex: 1, padding: "5px 0", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: hideSkin ? "var(--accent)" : "var(--input-bg, #f3f4f6)",
                  color: hideSkin ? "#fff" : "var(--text-muted)", transition: "all 100ms",
                }}>
                  {hideSkin ? "Skin Hidden" : "Hide Skin"}
                </button>
              </div>

              <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />

              {/* Dark Mode */}
              <button onClick={toggleDarkMode} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, marginBottom: 4,
                color: darkMode ? "#60a5fa" : "var(--text-main)",
                background: darkMode ? "rgba(59,130,246,0.12)" : "transparent",
                transition: "all 100ms", borderBottom: "1px solid var(--border-subtle, #f3f4f6)",
              }}>
                {darkMode ? <Moon size={13} /> : <Sun size={13} />}
                {darkMode ? "Dark Mode" : "Light Mode"}
                <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700 }}>{darkMode ? "ON" : "OFF"}</span>
              </button>

              {/* Debug wireframe overlay */}
              <button onClick={toggleDebugMode} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, marginBottom: 4,
                color: debugMode ? "#f59e0b" : "var(--text-main)",
                background: debugMode ? "rgba(245,158,11,0.12)" : "transparent",
                transition: "all 100ms",
              }}>
                <Bug size={13} />
                Wireframe
                <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700 }}>{debugMode ? "ON" : "OFF"}</span>
              </button>

              {/* Hotbar toggle */}
              <button onClick={toggleHotbar} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, marginBottom: 4,
                color: showHotbar ? "#f59e0b" : "var(--text-main)",
                background: showHotbar ? "rgba(245,158,11,0.12)" : "transparent",
                transition: "all 100ms",
              }}>
                <SlidersHorizontal size={13} />
                Hotbar
                <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700 }}>{showHotbar ? "ON" : "OFF"}</span>
              </button>

              {/* Grid complexity: Simple/Detail toggle */}
              <button onClick={() => setDesignComplexity(designComplexity === 'simple' ? 'detailed' : 'simple')} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, marginBottom: 4,
                color: designComplexity === 'detailed' ? "var(--accent)" : "var(--text-main)",
                background: designComplexity === 'detailed' ? "rgba(37,99,235,0.12)" : "transparent",
                transition: "all 100ms",
              }}>
                {designComplexity === 'detailed' ? <Grid3x3 size={13} /> : <Grid2x2 size={13} />}
                {designComplexity === 'detailed' ? 'Detail Mode' : 'Simple Mode'}
                <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700 }}>{designComplexity === 'detailed' ? 'D' : 'S'}</span>
              </button>

              {/* Container Actions */}
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 10px 2px" }}>Actions</div>
              {[
                { label: "Delete Selected", action: handleDelete, enabled: hasSelection && !isWalkthrough, Icon: Trash2 },
                { label: "Rotate 90°", action: () => selection.forEach((id) => { const c = containers[id]; if (c) updateContainerRotation(id, (c.rotation ?? 0) + Math.PI / 2); }), enabled: hasSelection && !isWalkthrough, Icon: RotateCw },
                { label: "Share URL", action: () => { const url = buildShareUrl(containers); navigator.clipboard.writeText(url).then(() => alert('Copied!')); }, enabled: Object.keys(containers).length > 0, Icon: Share2 },
                { label: "Export JSON", action: () => { handleExport(); setDevToolsOpen(false); }, enabled: true, Icon: Download, testId: "btn-export" },
              ].map(({ label, action, enabled, Icon, testId }) => (
                <button key={label} data-testid={testId} onClick={() => { if (enabled) action(); }} disabled={!enabled} style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "6px 10px", borderRadius: 6, border: "none", cursor: enabled ? "pointer" : "not-allowed",
                  fontSize: 11, fontWeight: 500, color: enabled ? "var(--text-main)" : "var(--text-dim)",
                  background: "transparent", transition: "all 100ms", opacity: enabled ? 1 : 0.5,
                }}
                  className={enabled ? "hover-toolbar-btn" : ""}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}

              <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />

              {/* Danger Zone */}
              <button data-testid="btn-reset" onClick={() => {
                if (confirm('Reset to empty canvas?')) {
                  Object.keys(containers).forEach((id) => removeContainer(id));
                  clearSelection();
                  addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
                  setDevToolsOpen(false);
                }
              }} disabled={Object.keys(containers).length === 0} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 500, color: "#ef4444", background: "transparent", transition: "all 100ms",
              }}
                className="hover-danger"
              >
                <RotateCcw size={12} /> Reset Canvas
              </button>
            </div>
          )}
        </div>

        {/* Old View Pill removed — now prominent tabs in ZONE B center */}

        {/* Old Settings dropdown removed — functionality merged into overflow ⋯ menu */}
      </div>
    </header>
  );
}
