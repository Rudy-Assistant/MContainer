"use client";

/**
 * Hotbar.tsx — Build tool selector.
 *
 * 4 tool slots: Beam | Panel | Container | Eraser.
 * Press 1-4 or scroll to select. Only visible in Build Mode.
 */

import {
  useFrameStore,
  TOOLS,
  type BuildTool,
} from "@/store/frameStore";

const LABELS: Record<BuildTool, string> = {
  beam: "Beam",
  panel: "Panel",
  container: "40ft",
  eraser: "Erase",
};

const COLORS: Record<BuildTool, string> = {
  beam: "#37474f",
  panel: "#607d8b",
  container: "#1565c0",
  eraser: "#f44336",
};

const DESCS: Record<BuildTool, string> = {
  beam: "Place structural beams",
  panel: "Fill wall/floor panels",
  container: "Stamp 40ft frame",
  eraser: "Remove elements",
};

export default function Hotbar() {
  const buildMode = useFrameStore((s) => s.buildMode);
  const tool = useFrameStore((s) => s.tool);
  const brushRotation = useFrameStore((s) => s.brushRotation);
  const setTool = useFrameStore((s) => s.setTool);

  if (!buildMode) return null;

  return (
    <div
      data-hotbar
      style={{
        position: "fixed",
        bottom: "12px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 45,
        display: "flex",
        alignItems: "center",
        gap: "3px",
        padding: "5px",
        background: "rgba(15, 23, 42, 0.92)",
        backdropFilter: "blur(20px) saturate(180%)",
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        userSelect: "none",
      }}
    >
      {TOOLS.map((t, i) => {
        const active = tool === t;
        return (
          <button
            key={t}
            onClick={() => setTool(t)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "62px",
              height: "58px",
              borderRadius: "10px",
              border: active ? "2px solid #60a5fa" : "2px solid transparent",
              background: active ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.04)",
              cursor: "pointer",
              transition: "all 120ms ease",
              position: "relative",
            }}
            title={`${DESCS[t]} [${i + 1}]`}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "5px",
                background: COLORS[t],
                border: active ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.15)",
                marginBottom: "2px",
              }}
            />
            <span
              style={{
                fontSize: "8px",
                fontWeight: 600,
                color: active ? "#93c5fd" : "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}
            >
              {LABELS[t]}
            </span>
            <span
              style={{
                position: "absolute",
                top: "1px",
                right: "3px",
                fontSize: "8px",
                fontWeight: 700,
                color: "#475569",
                fontFamily: "monospace",
              }}
            >
              {i + 1}
            </span>
          </button>
        );
      })}

      {/* Separator + rotation */}
      <div style={{ width: "1px", height: "40px", background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "44px",
          height: "58px",
        }}
      >
        <span style={{ fontSize: "8px", color: "#475569", fontWeight: 600, textTransform: "uppercase" }}>Rot</span>
        <span style={{ fontSize: "13px", color: "#94a3b8", fontFamily: "monospace", fontWeight: 700 }}>
          {brushRotation}°
        </span>
        <span style={{ fontSize: "7px", color: "#334155" }}>[R]</span>
      </div>
    </div>
  );
}
