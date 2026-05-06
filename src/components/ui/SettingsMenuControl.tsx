"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useExitTransition } from "@/hooks/useExitTransition";
import {
  Activity,
  Bug,
  Camera,
  Download,
  FileText,
  Glasses,
  Code2,
  Mail,
  Ruler,
  Sparkles,
  Video,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  Moon,
  Printer,
  RotateCcw,
  RotateCw,
  Share2,
  SlidersHorizontal,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { ContainerSize, ViewMode } from "@/types/container";
import { buildShareUrl, buildEmbedSnippet } from "@/utils/shareUrl";
import { downloadBlob } from "@/utils/downloadBlob";
import QuoteRequestModal from "./QuoteRequestModal";
import BuildingPerformanceModal from "./BuildingPerformanceModal";

// Heavy utilities are lazy-imported on first click — keeps them out of the
// initial bundle for users who never open the settings menu (most sessions).
const lazyDownloadBomCSV = () => import("@/utils/constructionDocs").then((m) => m.downloadBomCSV());
const lazyOpenPrintableReport = () => import("@/utils/constructionDocs").then((m) => m.openPrintableReport());
const lazyDownloadPhotorealPNG = () => import("@/utils/photorealCapture").then((m) => m.downloadPhotorealPNG());
const lazyRecordTourClip = (durationMs: number) => import("@/utils/tourVideoRecorder").then((m) => m.recordTourClip(durationMs));
const lazyRecordAutoTourClip = (durationMs: number) => import("@/utils/tourVideoRecorder").then((m) => m.recordAutoTourClip(durationMs));
const lazyEnterVR = () => import("@/utils/webXR").then((m) => m.enterVR());

interface SettingsMenuControlProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onOpen: () => void;
  buttonStyle: CSSProperties;
  /** Opens the AI Designer modal — owned by page.tsx so the primary toolbar
   *  button and the Settings overflow entry share a single mount. */
  onOpenAiDesign: () => void;
}

export default function SettingsMenuControl({ open, setOpen, onOpen, buttonStyle, onOpenAiDesign }: SettingsMenuControlProps) {
  const selection = useStore((s) => s.selection);
  const containers = useStore((s) => s.containers);
  const removeContainer = useStore((s) => s.removeContainer);
  const clearSelection = useStore((s) => s.clearSelection);
  const viewMode = useStore((s) => s.viewMode);
  const exportState = useStore((s) => s.exportState);
  const importState = useStore((s) => s.importState);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [perfOpen, setPerfOpen] = useState(false);
  // Keep the settings dropdown mounted briefly after `open` flips false so
  // the dropdown-out CSS animation can play before unmount.
  const dropdown = useExitTransition(open, 140);
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
  const showFloorGrid = useStore((s) => s.showFloorGrid);
  const toggleFloorGrid = useStore((s) => s.toggleFloorGrid);
  const units = useStore((s) => s.units);
  const setUnits = useStore((s) => s.setUnits);
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
    downloadBlob(
      new Blob([json], { type: "application/json" }),
      `moduhome-design-${new Date().toISOString().slice(0, 10)}.json`,
    );
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        importState(text);
      } catch (e) {
        alert(`Could not import: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
    input.click();
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
      {dropdown.mounted && (
        <div data-state={dropdown.state} className="dropdown-menu" style={{
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

          {/* Units — Imperial by default (US construction); switchable to Metric.
              Affects dimension labels in BP, Library tiles, and voxel previews. */}
          <button
            data-testid="btn-units-toggle"
            onClick={() => setUnits(units === "imperial" ? "metric" : "imperial")}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, marginBottom: 4,
              color: "var(--text-main)",
              background: "transparent",
              transition: "all 100ms",
            }}
            title={units === "imperial" ? "Switch to Metric" : "Switch to Imperial"}
          >
            <Ruler size={13} />
            Units
            <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em" }}>
              {units === "imperial" ? "FT/IN" : "M"}
            </span>
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

          <button onClick={toggleFloorGrid} style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600, marginBottom: 4,
            color: showFloorGrid ? "var(--accent)" : "var(--text-main)",
            background: showFloorGrid ? "rgba(37,99,235,0.10)" : "transparent",
            transition: "all 100ms",
          }}>
            <LayoutGrid size={13} />
            Floor Grid
            <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700 }}>{showFloorGrid ? "ON" : "OFF"}</span>
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
            { label: "AI Design…", action: () => { onOpenAiDesign(); setOpen(false); }, enabled: !isWalkthrough, Icon: Sparkles, testId: "btn-ai-design" },
            { label: "Delete Selected", action: handleDelete, enabled: hasSelection && !isWalkthrough, Icon: Trash2 },
            { label: "Rotate 90°", action: () => selection.forEach((id) => { const c = containers[id]; if (c) updateContainerRotation(id, (c.rotation ?? 0) + Math.PI / 2); }), enabled: hasSelection && !isWalkthrough, Icon: RotateCw },
            { label: "Share URL", action: () => { const url = buildShareUrl(containers); navigator.clipboard.writeText(url).then(() => alert("Copied!")); }, enabled: Object.keys(containers).length > 0, Icon: Share2 },
            { label: "Copy Embed Code", action: () => { const html = buildEmbedSnippet(containers); navigator.clipboard.writeText(html).then(() => alert("Embed iframe copied to clipboard!")); }, enabled: Object.keys(containers).length > 0, Icon: Code2, testId: "btn-embed-code" },
            { label: "Export JSON", action: () => { handleExport(); setOpen(false); }, enabled: true, Icon: Download, testId: "btn-export" },
            { label: "Import JSON", action: () => { handleImport(); setOpen(false); }, enabled: true, Icon: Upload, testId: "btn-import" },
            { label: "BOM (CSV)", action: () => { void lazyDownloadBomCSV(); setOpen(false); }, enabled: Object.keys(containers).length > 0, Icon: FileText, testId: "btn-bom-csv" },
            { label: "Construction Docs (PDF)", action: () => { void lazyOpenPrintableReport(); setOpen(false); }, enabled: Object.keys(containers).length > 0, Icon: Printer, testId: "btn-print-docs" },
            { label: "Performance (Energy/Solar/Code)", action: () => { setPerfOpen(true); setOpen(false); }, enabled: Object.keys(containers).length > 0, Icon: Activity, testId: "btn-performance" },
            { label: "Request Quote…", action: () => { setQuoteOpen(true); setOpen(false); }, enabled: Object.keys(containers).length > 0, Icon: Mail, testId: "btn-request-quote" },
            { label: "Photoreal Snapshot", action: () => { void lazyDownloadPhotorealPNG(); setOpen(false); }, enabled: Object.keys(containers).length > 0, Icon: Camera, testId: "btn-photoreal" },
            { label: "Record 10s Tour Video", action: () => { void lazyRecordTourClip(10000); setOpen(false); }, enabled: Object.keys(containers).length > 0, Icon: Video, testId: "btn-record-tour" },
            { label: "Record Auto-Tour (20s)", action: () => { void lazyRecordAutoTourClip(20000); setOpen(false); }, enabled: Object.keys(containers).length > 0, Icon: Video, testId: "btn-record-auto-tour" },
            { label: "Enter VR (WebXR)", action: () => { void lazyEnterVR(); setOpen(false); }, enabled: Object.keys(containers).length > 0, Icon: Glasses, testId: "btn-enter-vr" },
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
              // Trigger the scene-fade veil first so the swap happens behind
              // a soft wash instead of as a jarring jump-cut. The actual
              // state change happens at ~150ms (mid-fade).
              useStore.getState().triggerSceneFade();
              setTimeout(() => {
                Object.keys(useStore.getState().containers).forEach((id) => removeContainer(id));
                clearSelection();
                addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
              }, 150);
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
      <QuoteRequestModal open={quoteOpen} onClose={() => setQuoteOpen(false)} />
      <BuildingPerformanceModal open={perfOpen} onClose={() => setPerfOpen(false)} />
    </div>
  );
}
