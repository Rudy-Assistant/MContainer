"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import {
  Bug,
  Download,
  Grid2x2,
  Grid3x3,
  Moon,
  RotateCcw,
  RotateCw,
  Share2,
  SlidersHorizontal,
  Sun,
  Trash2,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { ContainerSize, ViewMode } from "@/types/container";
import { buildShareUrl } from "@/utils/shareUrl";

interface SettingsMenuControlProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onOpen: () => void;
  buttonStyle: CSSProperties;
}

export default function SettingsMenuControl({ open, setOpen, onOpen, buttonStyle }: SettingsMenuControlProps) {
  const selection = useStore((s) => s.selection);
  const containers = useStore((s) => s.containers);
  const removeContainer = useStore((s) => s.removeContainer);
  const clearSelection = useStore((s) => s.clearSelection);
  const viewMode = useStore((s) => s.viewMode);
  const exportState = useStore((s) => s.exportState);
  const updateContainerRotation = useStore((s) => s.updateContainerRotation);
  const addContainer = useStore((s) => s.addContainer);
  const debugMode = useStore((s) => s.debugMode);
  const toggleDebugMode = useStore((s) => s.toggleDebugMode);
  const darkMode = useStore((s) => s.darkMode);
  const toggleDarkMode = useStore((s) => s.toggleDarkMode);
  const designComplexity = useStore((s) => s.designComplexity);
  const setDesignComplexity = useStore((s) => s.setDesignComplexity);
  const wallCutMode = useStore((s) => s.wallCutMode);
  const setWallCutMode = useStore((s) => s.setWallCutMode);
  const hideRoof = useStore((s) => s.hideRoof);
  const toggleHideRoof = useStore((s) => s.toggleHideRoof);
  const hideSkin = useStore((s) => s.hideSkin);
  const toggleHideSkin = useStore((s) => s.toggleHideSkin);
  const showHotbar = useStore((s) => s.showHotbar);
  const toggleHotbar = useStore((s) => s.toggleHotbar);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, setOpen]);

  const hasSelection = selection.length > 0;
  const isWalkthrough = viewMode === ViewMode.Walkthrough;

  const handleDelete = () => {
    selection.forEach((id) => removeContainer(id));
    clearSelection();
  };

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

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        data-testid="btn-more"
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
        style={buttonStyle}
        title="Settings"
      >
        <SlidersHorizontal size={14} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "4px",
          background: "var(--modal-bg, #fff)", borderRadius: "10px",
          boxShadow: "var(--panel-shadow, 0 8px 24px rgba(0,0,0,0.15))",
          border: "1px solid var(--border, #e5e7eb)", padding: "6px", minWidth: "220px", zIndex: 50,
          color: "var(--text-main)",
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 10px 2px" }}>Visibility</div>
          <div style={{ display: "flex", gap: 2, padding: "2px 6px 4px" }}>
            {([
              { mode: "full" as const, label: "▮", title: "Full Walls" },
              { mode: "half" as const, label: "▄", title: "Half Walls" },
              { mode: "down" as const, label: "▁", title: "Walls Down" },
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

          <button onClick={() => setDesignComplexity(designComplexity === "simple" ? "detailed" : "simple")} style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600, marginBottom: 4,
            color: designComplexity === "detailed" ? "var(--accent)" : "var(--text-main)",
            background: designComplexity === "detailed" ? "rgba(37,99,235,0.12)" : "transparent",
            transition: "all 100ms",
          }}>
            {designComplexity === "detailed" ? <Grid3x3 size={13} /> : <Grid2x2 size={13} />}
            {designComplexity === "detailed" ? "Detail Mode" : "Simple Mode"}
            <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700 }}>{designComplexity === "detailed" ? "D" : "S"}</span>
          </button>

          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 10px 2px" }}>Actions</div>
          {[
            { label: "Delete Selected", action: handleDelete, enabled: hasSelection && !isWalkthrough, Icon: Trash2 },
            { label: "Rotate 90°", action: () => selection.forEach((id) => { const c = containers[id]; if (c) updateContainerRotation(id, (c.rotation ?? 0) + Math.PI / 2); }), enabled: hasSelection && !isWalkthrough, Icon: RotateCw },
            { label: "Share URL", action: () => { const url = buildShareUrl(containers); navigator.clipboard.writeText(url).then(() => alert("Copied!")); }, enabled: Object.keys(containers).length > 0, Icon: Share2 },
            { label: "Export JSON", action: () => { handleExport(); setOpen(false); }, enabled: true, Icon: Download, testId: "btn-export" },
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

          <button data-testid="btn-reset" onClick={() => {
            if (confirm("Reset to empty canvas?")) {
              Object.keys(containers).forEach((id) => removeContainer(id));
              clearSelection();
              addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
              setOpen(false);
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
  );
}
