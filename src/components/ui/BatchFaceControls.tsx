"use client";

import { useStore } from "@/store/useStore";
import type { SurfaceType, VoxelFaces } from "@/types/container";
import { QUICK_MATERIALS } from "@/config/surfaceLabels";

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
  const stampAreaSmart = useStore((s) => s.stampAreaSmart);

  /** Batch-set specific faces on all selected voxels in a single store mutation */
  const batchSetFaces = (faceUpdates: Partial<VoxelFaces>) => {
    useStore.setState((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return s;
      const indexSet = new Set(indices);
      const grid = c.voxelGrid.map((v, i) => {
        if (!indexSet.has(i) || !v.active) return v;
        const faces = { ...v.faces };
        for (const [face, mat] of Object.entries(faceUpdates)) {
          faces[face as keyof VoxelFaces] = mat as SurfaceType;
        }
        return { ...v, faces };
      });
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  };

  const applyToAllExterior = (material: SurfaceType) => {
    stampAreaSmart(containerId, indices, {
      top: "Solid_Steel", bottom: "Deck_Wood",
      n: material, s: material, e: material, w: material,
    });
  };

  const applyToAllInterior = (material: SurfaceType) => {
    batchSetFaces({ n: material, s: material, e: material, w: material });
  };

  const applyFloor = (material: SurfaceType) => {
    batchSetFaces({ bottom: material });
  };

  const applyCeiling = (material: SurfaceType) => {
    batchSetFaces({ top: material });
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
            <MaterialBtn key={m.type + "-ext"} label={m.label} color={m.color} onClick={() => applyToAllExterior(m.type)} />
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
