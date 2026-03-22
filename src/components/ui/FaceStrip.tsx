"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import type { SurfaceType, VoxelFaces } from "@/types/container";
import { SURFACE_COLORS, SURFACE_SHORT_LABELS, QUICK_MATERIALS, FLOOR_MATERIALS, CEILING_MATERIALS } from "@/config/surfaceLabels";
import { BookmarkPlus } from "lucide-react";

const FACE_KEYS: (keyof VoxelFaces)[] = ['n', 's', 'e', 'w', 'top', 'bottom'];
const FACE_LABELS: Record<keyof VoxelFaces, string> = {
  n: 'N', s: 'S', e: 'E', w: 'W', top: 'Top', bottom: 'Bot',
};
const FACE_FULL_LABELS: Record<keyof VoxelFaces, string> = {
  n: 'North', s: 'South', e: 'East', w: 'West', top: 'Top', bottom: 'Bottom',
};

/** Resolve face material across selected voxels. Returns material if unanimous, null if mixed. */
export function resolvedFaceMaterial(
  grid: { faces: VoxelFaces; active: boolean }[],
  indices: number[],
  face: keyof VoxelFaces,
): SurfaceType | null {
  const materials = new Set<SurfaceType>();
  for (const i of indices) {
    const v = grid[i];
    if (v?.active) materials.add(v.faces[face]);
  }
  return materials.size === 1 ? [...materials][0] : null;
}

function batchSetFace(containerId: string, indices: number[], face: keyof VoxelFaces, material: SurfaceType) {
  const store = useStore.getState();
  for (const idx of indices) {
    store.paintFace(containerId, idx, face, material);
  }
}

function batchSetFaces(containerId: string, indices: number[], faceUpdates: Partial<VoxelFaces>) {
  const store = useStore.getState();
  for (const idx of indices) {
    for (const [face, mat] of Object.entries(faceUpdates)) {
      store.paintFace(containerId, idx, face as keyof VoxelFaces, mat as SurfaceType);
    }
  }
}

export default function FaceStrip({ containerId, indices }: {
  containerId: string;
  indices: number[];
}) {
  const grid = useStore((s) => s.containers[containerId]?.voxelGrid);
  const saveBlockToLibrary = useStore((s) => s.saveBlockToLibrary);
  const setSelectedVoxel = useStore((s) => s.setSelectedVoxel);
  const setSelectedVoxels = useStore((s) => s.setSelectedVoxels);
  const [expandedFace, setExpandedFace] = useState<keyof VoxelFaces | null>(null);

  if (!grid || indices.length === 0) return null;

  const isSingle = indices.length === 1;

  const faceMaterials = useMemo(() => {
    const result: Record<keyof VoxelFaces, SurfaceType | null> = {} as Record<keyof VoxelFaces, SurfaceType | null>;
    for (const face of FACE_KEYS) {
      result[face] = resolvedFaceMaterial(grid, indices, face);
    }
    return result;
  }, [grid, indices]);

  const handleDeselect = () => {
    setSelectedVoxel(null);
    setSelectedVoxels(null);
  };

  const handleSaveToLibrary = () => {
    if (!isSingle) return;
    const v = grid[indices[0]];
    if (!v?.active) return;
    const f = v.faces;
    const label = `${f.n === 'Glass_Pane' || f.s === 'Glass_Pane' ? 'Glass' : f.n === 'Open' ? 'Open' : 'Steel'} Block`;
    saveBlockToLibrary(label, f);
  };

  const renderFaceButton = (face: keyof VoxelFaces) => {
    const mat = faceMaterials[face];
    const isMix = mat === null;
    const color = isMix ? "#94a3b8" : (SURFACE_COLORS[mat] || "#78909c");
    const label = `${FACE_LABELS[face]}·${isMix ? 'Mix' : (SURFACE_SHORT_LABELS[mat] || mat.slice(0, 4))}`;
    const isExpanded = expandedFace === face;
    return (
      <button
        key={face}
        onClick={() => setExpandedFace(isExpanded ? null : face)}
        title={`${FACE_FULL_LABELS[face]}: ${isMix ? 'Mixed' : mat} — click to edit`}
        style={{
          padding: "3px 7px", fontSize: 10, fontWeight: 600,
          borderRadius: 5, cursor: "pointer",
          border: isExpanded ? "2px solid var(--accent, #2563eb)" : "1px solid rgba(0,0,0,0.12)",
          background: isMix
            ? "repeating-linear-gradient(45deg, #e2e8f0, #e2e8f0 3px, #f1f5f9 3px, #f1f5f9 6px)"
            : mat === "Open" ? "var(--input-bg, #f1f5f9)" : `${color}33`,
          color: isMix ? "#64748b" : mat === "Open" ? "var(--text-muted, #94a3b8)" : "#1e293b",
          minWidth: 48, textAlign: "center",
        }}
      >
        {label}
      </button>
    );
  };

  const renderMaterialBtn = (m: { type: SurfaceType; label: string; color: string }, prefix: string, onClick: () => void) => (
    <button key={`${prefix}-${m.type}`} onClick={onClick} style={{
      padding: "2px 6px", fontSize: 9, fontWeight: 600,
      borderRadius: 4, cursor: "pointer",
      border: `1px solid ${m.color}`, background: `${m.color}18`, color: "#374151",
    }}>
      {m.label}
    </button>
  );

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 6,
      padding: "8px 10px",
      background: "var(--input-bg, #f8fafc)",
      borderRadius: 8,
    }}>
      {/* Face buttons: row 1 (walls) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
        {FACE_KEYS.slice(0, 4).map(renderFaceButton)}
      </div>
      {/* Face buttons: row 2 (top/bottom) + count + controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
        {FACE_KEYS.slice(4).map(renderFaceButton)}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", fontWeight: 600 }}>
            {indices.length} sel
          </span>
          {isSingle && (
            <button
              onClick={handleSaveToLibrary}
              style={{
                background: "none", border: "1px solid var(--border, #e2e8f0)", borderRadius: 4,
                cursor: "pointer", padding: "2px 4px",
                color: "var(--text-muted, #64748b)", display: "flex", alignItems: "center",
              }}
              title="Save block to library"
            >
              <BookmarkPlus size={11} />
            </button>
          )}
          <button
            onClick={handleDeselect}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#94a3b8", padding: "0 2px" }}
            title="Deselect"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Expanded picker for selected face */}
      {expandedFace && (
        <div style={{
          padding: "6px 8px", background: "var(--btn-bg, #fff)",
          borderRadius: 6, border: "1px solid var(--border, #e2e8f0)",
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted, #64748b)", textTransform: "uppercase", marginBottom: 4 }}>
            {FACE_FULL_LABELS[expandedFace]} Face
            {faceMaterials[expandedFace] ? ` · ${faceMaterials[expandedFace]}` : ' · Mixed'}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {QUICK_MATERIALS.map((m) => {
              const isActive = faceMaterials[expandedFace] === m.type;
              return (
                <button
                  key={m.type}
                  onClick={() => batchSetFace(containerId, indices, expandedFace, m.type)}
                  style={{
                    padding: "3px 8px", fontSize: 10, fontWeight: 600,
                    borderRadius: 5, cursor: "pointer",
                    border: isActive ? `2px solid ${m.color}` : `1px solid ${m.color}`,
                    background: isActive ? `${m.color}44` : `${m.color}22`,
                    color: "#1e293b",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Batch shortcuts (always visible) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div>
          <span style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginRight: 4 }}>All walls:</span>
          <span style={{ display: "inline-flex", gap: 2, flexWrap: "wrap" }}>
            {QUICK_MATERIALS.map((m) =>
              renderMaterialBtn(m, 'walls', () => batchSetFaces(containerId, indices, { n: m.type, s: m.type, e: m.type, w: m.type }))
            )}
          </span>
        </div>
        <div>
          <span style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginRight: 4 }}>Floors:</span>
          <span style={{ display: "inline-flex", gap: 2, flexWrap: "wrap" }}>
            {FLOOR_MATERIALS.map((m) =>
              renderMaterialBtn(m, 'floor', () => batchSetFaces(containerId, indices, { bottom: m.type }))
            )}
          </span>
        </div>
        <div>
          <span style={{ fontSize: 9, color: "var(--text-muted, #94a3b8)", marginRight: 4 }}>Ceilings:</span>
          <span style={{ display: "inline-flex", gap: 2, flexWrap: "wrap" }}>
            {CEILING_MATERIALS.map((m) =>
              renderMaterialBtn(m, 'ceil', () => batchSetFaces(containerId, indices, { top: m.type }))
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
