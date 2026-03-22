"use client";

import { useStore } from "@/store/useStore";
import type { SurfaceType } from "@/types/container";

const QUICK_MATERIALS: Array<{ label: string; material: SurfaceType; color: string }> = [
  { label: "Steel", material: "Solid_Steel", color: "#78909c" },
  { label: "Glass", material: "Glass_Pane", color: "#60a5fa" },
  { label: "Window", material: "Window_Standard", color: "#7dd3fc" },
  { label: "Wood", material: "Deck_Wood", color: "#8d6e63" },
  { label: "Railing", material: "Railing_Glass", color: "#93c5fd" },
  { label: "Open", material: "Open", color: "#e2e8f0" },
];

function MaterialBtn({ label, color, onClick }: {
  label: string; color: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "3px 8px", fontSize: 10, fontWeight: 600,
      borderRadius: 5, cursor: "pointer",
      border: `1px solid ${color}`, background: `${color}22`, color: "#1e293b",
    }}>
      {label}
    </button>
  );
}

export default function BatchFaceControls({ containerId, indices }: {
  containerId: string; indices: number[];
}) {
  const setVoxelFace = useStore((s) => s.setVoxelFace);
  const stampAreaSmart = useStore((s) => s.stampAreaSmart);

  const applyToAllExterior = (material: SurfaceType) => {
    stampAreaSmart(containerId, indices, {
      top: "Solid_Steel", bottom: "Deck_Wood",
      n: material, s: material, e: material, w: material,
    });
  };

  const applyToAllInterior = (material: SurfaceType) => {
    for (const idx of indices) {
      for (const face of ["n", "s", "e", "w"] as const) {
        setVoxelFace(containerId, idx, face, material);
      }
    }
  };

  const applyFloor = (material: SurfaceType) => {
    for (const idx of indices) {
      setVoxelFace(containerId, idx, "bottom", material);
    }
  };

  const applyCeiling = (material: SurfaceType) => {
    for (const idx of indices) {
      setVoxelFace(containerId, idx, "top", material);
    }
  };

  return (
    <div style={{
      padding: "8px 10px", background: "var(--input-bg, #f8fafc)",
      borderRadius: 8, display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted, #64748b)", textTransform: "uppercase" }}>
        {indices.length} blocks selected
      </div>
      <div>
        <div style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginBottom: 3 }}>Exterior walls:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {QUICK_MATERIALS.map(m => (
            <MaterialBtn key={m.material + "-ext"} label={m.label} color={m.color} onClick={() => applyToAllExterior(m.material)} />
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginBottom: 3 }}>Interior walls:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          <MaterialBtn label="Open" color="#e2e8f0" onClick={() => applyToAllInterior("Open")} />
          <MaterialBtn label="Steel" color="#78909c" onClick={() => applyToAllInterior("Solid_Steel")} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginBottom: 3 }}>Floors:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          <MaterialBtn label="Wood" color="#8d6e63" onClick={() => applyFloor("Deck_Wood")} />
          <MaterialBtn label="Concrete" color="#9e9e9e" onClick={() => applyFloor("Concrete")} />
          <MaterialBtn label="Open" color="#e2e8f0" onClick={() => applyFloor("Open")} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginBottom: 3 }}>Ceilings:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          <MaterialBtn label="Steel" color="#78909c" onClick={() => applyCeiling("Solid_Steel")} />
          <MaterialBtn label="Open" color="#e2e8f0" onClick={() => applyCeiling("Open")} />
        </div>
      </div>
    </div>
  );
}
