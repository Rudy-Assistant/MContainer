"use client";

/**
 * UserLibrary.tsx — Saved blocks + presets browser
 *
 * Renders in the Sidebar's "Saved" tab:
 *   Section A: My Blocks — user-saved VoxelFaces configs
 *   Section B: My Containers — user-saved container templates
 *   Section C: Presets — read-only master library from libraryPresets.ts
 */

import { useState, useCallback, useRef } from "react";
import { useStore, type HotbarSlot } from "@/store/useStore";
import type { VoxelFaces } from "@/types/container";
import { CssVoxelIcon } from "@/components/ui/SmartHotbar";
import { LIBRARY_PRESETS, PRESET_SECTIONS } from "@/config/libraryPresets";
import { MODEL_HOMES } from "@/config/modelHomes";
import { Trash2, Box } from "lucide-react";
import { ContainerSize } from "@/types/container";

const TEXT     = "#1e293b";
const TEXT_DIM = "#64748b";
const BORDER   = "#e2e8f0";
const CARD     = "#ffffff";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "9px", fontWeight: 700, color: TEXT_DIM,
      textTransform: "uppercase", letterSpacing: "0.08em", padding: "6px 0 3px",
    }}>
      {children}
    </div>
  );
}

// ── Block Card (shared between user blocks and presets) ──────

function BlockCard({
  label,
  faces,
  accent,
  isUser,
  onMouseDown,
  onDelete,
}: {
  label: string;
  faces: VoxelFaces;
  accent: string;
  isUser: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onDelete?: () => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "6px 8px", borderRadius: "7px",
        border: `1px solid ${BORDER}`,
        background: CARD,
        cursor: "grab",
        transition: "all 100ms ease",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.background = `${accent}08`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = BORDER;
        e.currentTarget.style.background = CARD;
      }}
    >
      <CssVoxelIcon faces={faces} size={14} />
      <span style={{ fontSize: "11px", fontWeight: 600, color: TEXT, flex: 1 }}>
        {label}
      </span>
      {isUser && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#94a3b8", padding: "2px",
          }}
          title="Remove from library"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

// ── Container Card ──────────────────────────────────────────

function ContainerCard({
  label,
  sizeLabel,
  onMouseDown,
  onDelete,
}: {
  label: string;
  sizeLabel: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onDelete: () => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "6px 8px", borderRadius: "7px",
        border: `1px solid ${BORDER}`,
        background: CARD,
        cursor: "grab",
        transition: "all 100ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#3b82f6";
        e.currentTarget.style.background = "#3b82f608";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = BORDER;
        e.currentTarget.style.background = CARD;
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 26, height: 26, borderRadius: 5,
        background: "#3b82f612",
      }}>
        <Box size={13} style={{ color: "#3b82f6" }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: TEXT }}>{label}</div>
        <div style={{ fontSize: "9px", color: TEXT_DIM }}>{sizeLabel}</div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#94a3b8", padding: "2px",
        }}
        title="Remove from library"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

// ── SIZE LABELS ─────────────────────────────────────────────
const SIZE_LABELS: Record<ContainerSize, string> = {
  [ContainerSize.Standard20]: "20ft",
  [ContainerSize.Standard40]: "40ft",
  [ContainerSize.HighCube40]: "40ft HC",
};

// ── Main Component ──────────────────────────────────────────

export default function UserLibrary() {
  const libraryBlocks = useStore((s) => s.libraryBlocks);
  const libraryContainers = useStore((s) => s.libraryContainers);
  const libraryHomeDesigns = useStore((s) => s.libraryHomeDesigns);
  const removeLibraryItem = useStore((s) => s.removeLibraryItem);
  const setLibraryDragPayload = useStore((s) => s.setLibraryDragPayload);
  const selectedVoxel = useStore((s) => s.selectedVoxel);
  const containers = useStore((s) => s.containers);
  const saveHomeDesign = useStore((s) => s.saveHomeDesign);
  const loadHomeDesign = useStore((s) => s.loadHomeDesign);
  const [savingHome, setSavingHome] = useState(false);
  const [homeNameInput, setHomeNameInput] = useState('');

  // Start dragging a block (user or preset)
  const startBlockDrag = useCallback((label: string, faces: VoxelFaces) => {
    setLibraryDragPayload({ type: 'block', faces, label });
    // Auto-clear on mouseup
    const up = () => {
      // Stamp on hovered voxel if available
      const store = useStore.getState();
      const target = store.hoveredVoxel ?? store.selectedVoxel;
      // ★ Guard: extension tiles have no grid index — skip grid stamp
      if (target && !target.isExtension && store.libraryDragPayload?.type === 'block') {
        const f = store.libraryDragPayload.faces;
        const c = store.containers[target.containerId];
        if (c?.voxelGrid && !store.lockedVoxels[`${target.containerId}_${target.index}`]) {
          const grid = [...c.voxelGrid];
          const voxel = grid[target.index];
          if (voxel) {
            grid[target.index] = { ...voxel, active: true, faces: { ...f } };
            useStore.setState({
              containers: { ...store.containers, [target.containerId]: { ...c, voxelGrid: grid } },
            });
          }
        }
      }
      setLibraryDragPayload(null);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mouseup", up);
  }, [setLibraryDragPayload]);

  // Start dragging a container template
  const startContainerDrag = useCallback((id: string) => {
    const entry = libraryContainers.find((c) => c.id === id);
    if (!entry) return;
    setLibraryDragPayload({ type: 'container', size: entry.size, voxelGrid: entry.voxelGrid, label: entry.label });
    const up = () => {
      setLibraryDragPayload(null);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mouseup", up);
  }, [libraryContainers, setLibraryDragPayload]);

  const hasBlocks = libraryBlocks.length > 0;
  const hasContainers = libraryContainers.length > 0;

  const placeModelHome = useStore((s) => s.placeModelHome);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {/* ── Model Homes ── */}
      <SectionLabel>Model Homes</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        {MODEL_HOMES.map((model) => (
          <div
            key={model.id}
            data-testid={`model-home-${model.id}`}
            onClick={() => {
              const store = useStore.getState();
              const ids = Object.keys(store.containers);
              if (ids.length > 0 && !window.confirm('This will replace your current design. Continue?')) return;
              ids.forEach(id => store.removeContainer(id));
              placeModelHome(model.id);
            }}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "6px 8px", borderRadius: "7px",
              border: `1px solid ${BORDER}`,
              background: CARD,
              cursor: "pointer",
              transition: "all 100ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#10b981";
              e.currentTarget.style.background = "#10b98108";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = BORDER;
              e.currentTarget.style.background = CARD;
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, borderRadius: 5,
              background: "#10b98112", fontSize: "14px",
            }}>
              {model.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: TEXT }}>{model.label}</div>
              <div style={{ fontSize: "9px", color: TEXT_DIM }}>
                {model.containers.length} container{model.containers.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── My Homes ── */}
      <SectionLabel>My Homes</SectionLabel>
      {libraryHomeDesigns.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {libraryHomeDesigns.map((design) => (
            <div
              key={design.id}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "6px 8px", borderRadius: "7px",
                border: `1px solid ${BORDER}`,
                background: CARD,
              }}
            >
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 26, height: 26, borderRadius: 5,
                background: "#8b5cf612", fontSize: "14px",
              }}>
                {design.icon || '🏠'}
              </div>
              <div
                style={{ flex: 1, cursor: "pointer" }}
                onClick={() => loadHomeDesign(design.id)}
              >
                <div style={{ fontSize: "11px", fontWeight: 600, color: TEXT }}>{design.label}</div>
                <div style={{ fontSize: "9px", color: TEXT_DIM }}>
                  {design.containers.length} container{design.containers.length !== 1 ? 's' : ''}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeLibraryItem(design.id); }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#94a3b8", padding: "2px",
                }}
                title="Remove from library"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {savingHome ? (
        <div style={{ display: "flex", gap: "4px", padding: "2px 0" }}>
          <input
            autoFocus
            value={homeNameInput}
            onChange={(e) => setHomeNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && homeNameInput.trim()) {
                saveHomeDesign(homeNameInput.trim());
                setHomeNameInput('');
                setSavingHome(false);
              } else if (e.key === 'Escape') {
                setSavingHome(false);
              }
            }}
            placeholder="Home name..."
            style={{
              flex: 1, fontSize: "10px", padding: "3px 6px",
              border: `1px solid ${BORDER}`, borderRadius: "4px",
              outline: "none",
            }}
          />
        </div>
      ) : (
        <button
          onClick={() => setSavingHome(true)}
          style={{
            fontSize: "10px", color: "#8b5cf6", background: "none",
            border: `1px dashed #8b5cf640`, borderRadius: "5px",
            padding: "4px 0", cursor: "pointer", width: "100%",
          }}
        >
          + Save Current Home
        </button>
      )}

      {/* ── My Blocks ── */}
      <SectionLabel>My Blocks</SectionLabel>
      {hasBlocks ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {libraryBlocks.map((block) => (
            <BlockCard
              key={block.id}
              label={block.label}
              faces={block.faces}
              accent="#a78bfa"
              isUser
              onMouseDown={() => startBlockDrag(block.label, block.faces)}
              onDelete={() => removeLibraryItem(block.id)}
            />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: "10px", color: "#94a3b8", textAlign: "center", padding: "4px 0" }}>
          Save blocks from the inspector
        </div>
      )}

      {/* ── My Containers ── */}
      <SectionLabel>My Containers</SectionLabel>
      {hasContainers ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {libraryContainers.map((entry) => (
            <ContainerCard
              key={entry.id}
              label={entry.label}
              sizeLabel={SIZE_LABELS[entry.size]}
              onMouseDown={() => startContainerDrag(entry.id)}
              onDelete={() => removeLibraryItem(entry.id)}
            />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: "10px", color: "#94a3b8", textAlign: "center", padding: "4px 0" }}>
          Save containers from the inspector
        </div>
      )}

      {/* ── Presets (read-only) ── */}
      {PRESET_SECTIONS.map((section) => {
        const presets = LIBRARY_PRESETS.filter((p) => p.section === section);
        return (
          <div key={section}>
            <SectionLabel>{section}</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {presets.map((preset) => (
                <BlockCard
                  key={preset.id}
                  label={preset.label}
                  faces={preset.faces}
                  accent={preset.accent}
                  isUser={false}
                  onMouseDown={() => startBlockDrag(preset.label, preset.faces)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
