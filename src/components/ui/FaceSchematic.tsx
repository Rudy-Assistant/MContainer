"use client";

import type { VoxelFaces, SurfaceType } from "@/types/container";
import { SURFACE_COLORS } from "@/components/ui/MatrixEditor";

const SHORT: Record<string, string> = {
  Open: "Open", Solid_Steel: "Steel", Glass_Pane: "Glass",
  Railing_Glass: "Rail", Railing_Cable: "Cable", Deck_Wood: "Wood",
  Concrete: "Conc", Door: "Door", Window_Standard: "Win",
  Stairs: "Stair", Half_Fold: "½Fold", Gull_Wing: "Gull",
  Window_Sill: "Sill", Window_Clerestory: "Clr", Window_Half: "½Win",
  Stairs_Down: "StDn", Wood_Hinoki: "Hnki", Floor_Tatami: "Tata",
  Wall_Washi: "Washi", Glass_Shoji: "Shoji",
};

function FaceBtn({ face, material, onClick }: {
  face: string; material: SurfaceType; onClick: () => void;
}) {
  const bg = SURFACE_COLORS[material] || "#78909c";
  const label = SHORT[material] || material.slice(0, 4);
  return (
    <button
      onClick={onClick}
      title={`${face.toUpperCase()}: ${material} — click to cycle`}
      style={{
        padding: "2px 6px", fontSize: 9, fontWeight: 600,
        borderRadius: 4, cursor: "pointer",
        border: "1px solid rgba(0,0,0,0.15)",
        background: material === "Open" ? "var(--input-bg, #f1f5f9)" : `${bg}33`,
        color: material === "Open" ? "var(--text-muted, #94a3b8)" : "#1e293b",
        minWidth: 36, textAlign: "center",
      }}
    >
      {label}
    </button>
  );
}

export default function FaceSchematic({ faces, onCycleFace }: {
  faces: VoxelFaces;
  onCycleFace: (face: keyof VoxelFaces) => void;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      gridTemplateRows: "auto auto auto",
      gap: 2, alignItems: "center", justifyItems: "center",
      padding: "6px 8px",
      background: "var(--input-bg, #f8fafc)",
      borderRadius: 8, fontSize: 9,
    }}>
      <div />
      <FaceBtn face="top" material={faces.top} onClick={() => onCycleFace("top")} />
      <div />
      <FaceBtn face="w" material={faces.w} onClick={() => onCycleFace("w")} />
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 1, padding: "2px 8px",
      }}>
        <span style={{ fontSize: 8, color: "var(--text-muted, #94a3b8)" }}>N</span>
        <FaceBtn face="n" material={faces.n} onClick={() => onCycleFace("n")} />
        <div style={{ height: 1, width: 24, background: "var(--border, #e2e8f0)" }} />
        <FaceBtn face="s" material={faces.s} onClick={() => onCycleFace("s")} />
        <span style={{ fontSize: 8, color: "var(--text-muted, #94a3b8)" }}>S</span>
      </div>
      <FaceBtn face="e" material={faces.e} onClick={() => onCycleFace("e")} />
      <div />
      <FaceBtn face="bottom" material={faces.bottom} onClick={() => onCycleFace("bottom")} />
      <div />
    </div>
  );
}
