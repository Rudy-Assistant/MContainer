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

const THEME_COLORS: Record<ThemeId, string> = {
  industrial: "#607d8b", japanese: "#5d4037", desert: "#d4a373",
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
