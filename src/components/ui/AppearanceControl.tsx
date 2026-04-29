"use client";

import { useEffect, useRef } from "react";
import { Paintbrush } from "lucide-react";
import { useStore } from "@/store/useStore";
import { GROUND_PRESET_IDS, GROUND_PRESETS, type GroundPresetId } from "@/config/groundPresets";
import { QUALITY_PRESET_IDS, type QualityPresetId } from "@/config/qualityPresets";
import { THEMES, THEME_IDS, type ThemeId } from "@/config/themes";

interface AppearanceControlProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onOpen: () => void;
  onOpenPalette: () => void;
  buttonStyle: React.CSSProperties;
}

// Per-theme accent color used in the picker chips. Picked from each theme's
// signature material so the chip telegraphs the look at a glance.
const THEME_COLORS: Record<ThemeId, string> = {
  industrial:   "#607d8b",   // weathered steel grey-blue
  japanese:     "#5d4037",   // charred yakisugi brown
  desert:       "#d4a373",   // sand stucco tan
  scandinavian: "#e8e0cf",   // whitewashed pine cream
  brutalist:    "#3a3a3a",   // raw board-formed concrete
  coastal:      "#86b3a8",   // sea-glass turquoise
  ryokan:       "#c9b070",   // tatami straw gold
  loft:         "#8a4a3a",   // exposed red brick
  midcentury:   "#b8743c",   // redwood siding
};

const GROUND_COLORS: Record<GroundPresetId, string> = {
  grass: "#4a7a30", concrete: "#8a8a88", gravel: "#7a7568", dirt: "#6b5b3e",
};

export default function AppearanceControl({
  open,
  setOpen,
  onOpen,
  onOpenPalette,
  buttonStyle,
}: AppearanceControlProps) {
  const currentTheme = useStore((s) => s.currentTheme);
  const setTheme = useStore((s) => s.setTheme);
  const groundPreset = useStore((s) => s.environment.groundPreset) as GroundPresetId | undefined;
  const setGroundPreset = useStore((s) => s.setGroundPreset);
  const qualityPreset = useStore((s) => s.qualityPreset) as QualityPresetId;
  const setQualityPreset = useStore((s) => s.setQualityPreset);
  const setActivePalette = useStore((s) => s.setActivePalette);
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

  const activeGround = groundPreset && groundPreset in GROUND_PRESETS
    ? groundPreset as GroundPresetId : "grass";

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        data-testid="btn-palette"
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
        style={{
          ...buttonStyle,
          borderColor: open ? "var(--accent)" : undefined,
          color: open ? "var(--accent)" : undefined,
        }}
        title="Theme & Environment"
      >
        <Paintbrush size={14} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "4px",
          background: "var(--modal-bg, #fff)", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          border: "1px solid var(--btn-border, #e5e7eb)", padding: "12px", minWidth: "220px", zIndex: 50,
        }}>
          <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted, #6b7280)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
            Theme
          </div>
          {/* 2-column grid of theme chips. Each chip shows a colour swatch
              (left) + label (right). Wraps cleanly when the theme library
              grows past 6 entries. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
            {THEME_IDS.map((tid) => {
              const active = currentTheme === tid;
              const accent = THEME_COLORS[tid];
              return (
                <button
                  key={tid}
                  data-testid={`theme-${tid}`}
                  onClick={() => { setTheme(tid); setActivePalette(tid); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    height: "36px", padding: "0 10px",
                    borderRadius: "8px",
                    border: `1.5px solid ${active ? accent : "var(--btn-border, #e5e7eb)"}`,
                    cursor: "pointer", fontSize: "11px",
                    fontWeight: active ? 700 : 500,
                    color: active ? "var(--text-main, #111827)" : "var(--text-muted, #6b7280)",
                    background: active ? `${accent}1a` : "var(--btn-bg, #fff)",
                    transition: "all 150ms ease-out",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                  title={THEMES[tid].label}
                >
                  <span
                    aria-hidden
                    style={{
                      flexShrink: 0,
                      width: "18px", height: "18px",
                      borderRadius: "4px",
                      background: accent,
                      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
                    }}
                  />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {THEMES[tid].label}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => { onOpenPalette(); setOpen(false); }}
            style={{
              width: "100%", marginBottom: "12px", padding: "7px 10px", borderRadius: 6,
              border: "1px solid var(--border-subtle, #e5e7eb)", cursor: "pointer",
              background: "var(--input-bg, #f8fafc)", color: "var(--text-main)",
              fontSize: 12, fontWeight: 700,
            }}
          >
            Open Palette
          </button>
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
  );
}
