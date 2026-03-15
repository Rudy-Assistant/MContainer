"use client";

/**
 * TOP TOOLBAR - Responsive Production Release
 *
 * - w-full, max-w-[100vw], overflow-hidden — NEVER triggers horizontal scrollbar
 * - Icon-only buttons on <1024px, icon+label on wider screens
 * - View pill always visible, center tools shrink/wrap gracefully
 */

import { useState } from "react";
import { useStore } from "@/store/useStore";
import { ViewMode } from "@/types/container";
import {
  Trash2,
  Group,
  DollarSign,
  Download,
  Grid2x2,
  Box,
  Footprints,
  PanelTop,
  ChevronDown,
  Layers,
  Palette,
  Share2,
  RotateCcw,
  RotateCw,
} from "lucide-react";
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
  const [wallMenuOpen, setWallMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

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

  const btn = (enabled: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    height: "40px",
    padding: "0 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: "13px",
    fontWeight: 500,
    color: enabled ? "#374151" : "#9ca3af",
    background: enabled ? "#fff" : "#f9fafb",
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
        background: "rgba(255, 255, 255, 0.78)",
        borderBottom: "1px solid rgba(255,255,255,0.3)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* ═══ ZONE A: Logo ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <span style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>ModuHome</span>
        <span style={{ fontSize: "9px", fontWeight: 600, padding: "2px 6px", borderRadius: "9999px", background: "#dbeafe", color: "#2563eb" }}>
          PRO
        </span>
      </div>

      {/* ═══ ZONE B: Center Tools (flex-wrap, shrink gracefully) ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "0 auto", flexWrap: "wrap", justifyContent: "center", overflow: "hidden", maxHeight: "56px" }}>
        <button onClick={handleDelete} style={btn(hasSelection && !isWalkthrough)} disabled={!hasSelection || isWalkthrough} title="Delete (Del)">
          <Trash2 size={15} />
          <span className="hidden lg:inline">Delete</span>
        </button>

        <button onClick={() => {
          selection.forEach((id) => {
            const c = containers[id];
            if (c) updateContainerRotation(id, (c.rotation ?? 0) + Math.PI / 2);
          });
        }} style={btn(hasSelection && !isWalkthrough)} disabled={!hasSelection || isWalkthrough} title="Rotate 90° (R)">
          <RotateCw size={15} />
          <span className="hidden lg:inline">Rotate</span>
        </button>

        <button onClick={() => selection.forEach((id) => toggleRoof(id))} style={btn(hasSelection && !isWalkthrough)} disabled={!hasSelection || isWalkthrough} title="Toggle Roof">
          <Layers size={15} />
          <span className="hidden lg:inline">Roof</span>
        </button>

        <button onClick={() => {
          if (confirm('Clear all containers? This cannot be undone.')) {
            const ids = Object.keys(containers);
            ids.forEach((id) => removeContainer(id));
            clearSelection();
          }
        }} style={btn(Object.keys(containers).length > 0)} disabled={Object.keys(containers).length === 0} title="Reset Canvas">
          <RotateCcw size={15} />
          <span className="hidden lg:inline">Reset</span>
        </button>

        {/* Group/Ungroup — contextual single button */}
        {hasSelection && !isWalkthrough && (
          hasGrouped ? (
            <button onClick={handleUngroup} style={btn(true)} title="Ungroup (U)">
              <Group size={15} style={{ transform: "rotate(180deg)" }} />
              <span className="hidden lg:inline">Ungroup</span>
            </button>
          ) : selection.length >= 2 ? (
            <button onClick={handleGroup} style={btn(true)} title="Group (G)">
              <Group size={15} />
              <span className="hidden lg:inline">Group</span>
            </button>
          ) : null
        )}

        <div style={{ width: "1px", height: "20px", background: "#e5e7eb", flexShrink: 0 }} />

        {/* Outer Walls dropdown */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={() => setWallMenuOpen(!wallMenuOpen)} style={btn(hasSelection && !isWalkthrough)} disabled={!hasSelection || isWalkthrough} title="Outer Walls">
            <PanelTop size={15} />
            <span className="hidden lg:inline">Walls</span>
            <ChevronDown size={12} style={{ transform: wallMenuOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
          </button>

          {wallMenuOpen && hasSelection && !isWalkthrough && (
            <div style={{
              position: "absolute", top: "100%", left: 0, marginTop: "4px",
              background: "#fff", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              border: "1px solid #e5e7eb", padding: "4px 0", minWidth: "160px", zIndex: 50,
            }}>
              {[
                { label: "All Solid", value: "solid" as const },
                { label: "All Glass", value: "glass" as const },
                { label: "Fold Down", value: "fold_down" as const },
                { label: "Fold Up", value: "fold_up" as const },
                { label: "Gull Wing", value: "gull" as const },
                { label: "All Open", value: "open" as const },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => { setAllOuterWalls(p.value); setWallMenuOpen(false); }}
                  style={{ display: "block", width: "100%", padding: "6px 12px", textAlign: "left", fontSize: "12px", color: "#374151", background: "transparent", border: "none", cursor: "pointer" }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#eff6ff"; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
                >
                  {p.label}
                </button>
              ))}
              <div style={{ height: "1px", background: "#e5e7eb", margin: "4px 0" }} />
              <button
                onClick={() => { selection.forEach((id) => toggleRoof(id)); setWallMenuOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", padding: "6px 12px", textAlign: "left", fontSize: "12px", color: "#374151", background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#eff6ff"; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
              >
                <Layers size={13} /> Toggle Roof
              </button>
              <button
                onClick={() => { selection.forEach((id) => generateRooftopDeck(id)); setWallMenuOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", padding: "6px 12px", textAlign: "left", fontSize: "12px", color: "#374151", background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#eff6ff"; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
              >
                <Layers size={13} /> Rooftop Deck
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ ZONE C: Right — Actions + View Pill ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
        <button onClick={onOpenBudget} style={btn(true)} title="Budget">
          <DollarSign size={15} />
          <span className="hidden xl:inline">Budget</span>
        </button>

        {/* Share button */}
        <button
          onClick={() => {
            const url = buildShareUrl(containers);
            navigator.clipboard.writeText(url).then(() => {
              alert('Share URL copied to clipboard!');
            });
          }}
          style={btn(Object.keys(containers).length > 0)}
          disabled={Object.keys(containers).length === 0}
          title="Copy Share URL"
        >
          <Share2 size={15} />
          <span className="hidden xl:inline">Share</span>
        </button>

        {/* Export dropdown */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={() => setExportMenuOpen(!exportMenuOpen)} style={btn(true)} title="Export">
            <Download size={15} />
            <span className="hidden xl:inline">Export</span>
            <ChevronDown size={12} style={{ transform: exportMenuOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
          </button>
          {exportMenuOpen && (
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: "4px",
              background: "#fff", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              border: "1px solid #e5e7eb", padding: "4px 0", minWidth: "140px", zIndex: 50,
            }}>
              <button
                onClick={() => { handleExport(); setExportMenuOpen(false); }}
                style={{ display: "block", width: "100%", padding: "6px 12px", textAlign: "left", fontSize: "12px", color: "#374151", background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#eff6ff"; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
              >
                Export JSON
              </button>
              <button
                onClick={() => { exportSceneToGLB(); setExportMenuOpen(false); }}
                style={{ display: "block", width: "100%", padding: "6px 12px", textAlign: "left", fontSize: "12px", color: "#374151", background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#eff6ff"; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
              >
                Export GLB
              </button>
            </div>
          )}
        </div>

        <button onClick={onOpenPalette} style={btn(true)} title="Material Palette">
          <Palette size={15} />
        </button>

        <div style={{ width: "1px", height: "20px", background: "#e5e7eb", flexShrink: 0 }} />

        {/* View Pill */}
        <div style={{
          display: "flex", alignItems: "center",
          background: "#f3f4f6", borderRadius: "9999px", padding: "3px",
          border: "1px solid #e5e7eb", flexShrink: 0,
        }}>
          {([
            { mode: ViewMode.Blueprint, label: "Build", kbd: "Alt+4", icon: <Grid2x2 size={13} /> },
            { mode: ViewMode.Realistic3D, label: "Design", kbd: "Alt+3", icon: <Box size={13} /> },
            { mode: ViewMode.Walkthrough, label: "Walk", kbd: "F", icon: <Footprints size={13} /> },
          ] as const).map(({ mode, label, kbd, icon }) => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "5px 10px", borderRadius: "9999px", border: "none", cursor: "pointer",
                  fontSize: "12px", fontWeight: active ? 600 : 500,
                  color: active ? "#fff" : "#6b7280",
                  background: active ? "#2563eb" : "transparent",
                  boxShadow: active ? "0 1px 3px rgba(37,99,235,0.3)" : "none",
                  transition: "all 150ms ease",
                }}
                title={`${label} View`}
              >
                {icon}
                <span>{label}</span>
                <kbd aria-hidden="true" style={{ fontSize: 9, opacity: 0.45, fontFamily: "monospace", marginLeft: 2 }}>{kbd}</kbd>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
