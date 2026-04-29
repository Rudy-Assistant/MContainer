"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/store/useStore";
import type { MaterialPalette } from "@/store/slices/librarySlice";
import { GROUND_PRESET_IDS } from "@/config/groundPresets";

function hexToInput(hex: number): string {
  return "#" + hex.toString(16).padStart(6, "0");
}

function inputToHex(val: string): number {
  return parseInt(val.replace("#", ""), 16);
}

function paletteToDraft(p: MaterialPalette): Omit<MaterialPalette, "id"> {
  const rest: Partial<MaterialPalette> = { ...p };
  delete rest.id;
  return rest as Omit<MaterialPalette, "id">;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MaterialPaletteModal({ open, onClose }: Props) {
  const palettes = useStore((s) => s.palettes);
  const activePaletteId = useStore((s) => s.activePaletteId);
  const savePalette = useStore((s) => s.savePalette);
  const updatePalette = useStore((s) => s.updatePalette);
  const deletePalette = useStore((s) => s.deletePalette);
  const setActivePalette = useStore((s) => s.setActivePalette);

  const activePalette = palettes.find((p) => p.id === activePaletteId) ?? palettes[0];

  const [draft, setDraft] = useState<Omit<MaterialPalette, "id">>(() => paletteToDraft(activePalette));

  const selectPalette = useCallback((p: MaterialPalette) => {
    setDraft(paletteToDraft(p));
    setActivePalette(p.id);
  }, [setActivePalette]);

  const handleNew = () => {
    setDraft(paletteToDraft({ ...palettes[0], id: '', name: "My Palette", isBuiltIn: false }));
  };

  const handleSaveAsNew = () => {
    const id = savePalette({ ...draft, isBuiltIn: false });
    setActivePalette(id);
  };

  const handleApply = () => {
    if (!activePalette.isBuiltIn) {
      updatePalette(activePaletteId, draft);
    }
    setActivePalette(activePaletteId);
    onClose();
  };

  const handleDelete = () => {
    if (activePalette.isBuiltIn) return;
    deletePalette(activePaletteId);
    setActivePalette("industrial");
    onClose();
  };

  if (!open) return null;

  const labelStyle: React.CSSProperties = {
    fontSize: "13px", fontWeight: 600, color: "#374151", width: "84px", flexShrink: 0,
  };
  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "10px", padding: "6px 0",
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(2px)",
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          background: "#fff", borderRadius: "16px", padding: "24px 28px",
          width: "540px", maxWidth: "92vw", maxHeight: "88vh", overflow: "auto",
          boxShadow: "0 24px 80px rgba(15,23,42,0.25), 0 0 0 1px rgba(15,23,42,0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>Material Palette</h2>
            <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>Pick or customize the colour set used for new materials.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "transparent", border: "1px solid #e2e8f0",
              cursor: "pointer", fontSize: "16px", color: "#6b7280",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Palette tabs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "18px" }}>
          {palettes.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPalette(p)}
              style={{
                padding: "7px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                border: p.id === activePaletteId ? "2px solid #2563eb" : "1px solid #e5e7eb",
                background: p.id === activePaletteId ? "#eff6ff" : "#fff",
                color: p.id === activePaletteId ? "#2563eb" : "#374151",
                cursor: "pointer",
                transition: "all 150ms ease-out",
              }}
            >
              {p.name}{p.isBuiltIn ? "" : " *"}
            </button>
          ))}
          <button
            onClick={handleNew}
            style={{
              padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
              border: "1px dashed #9ca3af", background: "#f9fafb", color: "#6b7280", cursor: "pointer",
            }}
          >
            + New
          </button>
        </div>

        {/* Editor */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={rowStyle}>
            <span style={labelStyle}>Name</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              disabled={draft.isBuiltIn}
              style={{ flex: 1, padding: "4px 8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px" }}
            />
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Steel</span>
            <input type="color" value={hexToInput(draft.steelColor)} onChange={(e) => setDraft({ ...draft, steelColor: inputToHex(e.target.value) })} disabled={draft.isBuiltIn} />
            <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600 }}>M</span>
            <input type="number" step={0.01} min={0} max={1} value={draft.steelMetalness} onChange={(e) => setDraft({ ...draft, steelMetalness: +e.target.value })} disabled={draft.isBuiltIn} style={{ width: "62px", padding: "4px 6px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px" }} />
            <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600 }}>R</span>
            <input type="number" step={0.01} min={0} max={1} value={draft.steelRoughness} onChange={(e) => setDraft({ ...draft, steelRoughness: +e.target.value })} disabled={draft.isBuiltIn} style={{ width: "62px", padding: "4px 6px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px" }} />
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Frame</span>
            <input type="color" value={hexToInput(draft.frameColor)} onChange={(e) => setDraft({ ...draft, frameColor: inputToHex(e.target.value) })} disabled={draft.isBuiltIn} />
            <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600 }}>M</span>
            <input type="number" step={0.01} min={0} max={1} value={draft.frameMetalness} onChange={(e) => setDraft({ ...draft, frameMetalness: +e.target.value })} disabled={draft.isBuiltIn} style={{ width: "62px", padding: "4px 6px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px" }} />
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Glass</span>
            <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600 }}>Transmission</span>
            <input type="number" step={0.01} min={0} max={1} value={draft.glassTransmission} onChange={(e) => setDraft({ ...draft, glassTransmission: +e.target.value })} disabled={draft.isBuiltIn} style={{ width: "60px", padding: "2px 4px", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "11px" }} />
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Wood</span>
            <input type="color" value={hexToInput(draft.woodColor)} onChange={(e) => setDraft({ ...draft, woodColor: inputToHex(e.target.value) })} disabled={draft.isBuiltIn} />
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Ground</span>
            <select
              value={draft.groundPreset}
              onChange={(e) => setDraft({ ...draft, groundPreset: e.target.value })}
              disabled={draft.isBuiltIn}
              style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px" }}
            >
              {GROUND_PRESET_IDS.map((g) => (
                <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
          {!draft.isBuiltIn && (
            <button
              onClick={handleSaveAsNew}
              style={{
                padding: "9px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                border: "1px solid #d1d5db", background: "#f9fafb", color: "#374151", cursor: "pointer",
                transition: "background 150ms ease-out",
              }}
            >
              Save as New
            </button>
          )}
          <button
            onClick={handleApply}
            style={{
              padding: "10px 22px", borderRadius: "8px", fontSize: "14px", fontWeight: 700,
              border: "none", background: "#2563eb", color: "#fff", cursor: "pointer",
              boxShadow: "0 1px 3px rgba(37,99,235,0.4)",
            }}
          >
            Apply
          </button>
          <button
            onClick={handleDelete}
            disabled={activePalette.isBuiltIn}
            style={{
              padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
              border: "1px solid #e5e7eb", background: activePalette.isBuiltIn ? "#f3f4f6" : "#fef2f2",
              color: activePalette.isBuiltIn ? "#9ca3af" : "#dc2626",
              cursor: activePalette.isBuiltIn ? "not-allowed" : "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
