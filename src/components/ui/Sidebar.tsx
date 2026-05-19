"use client";

/**
 * Sidebar.tsx — Unified "Super-Sidebar" (440px, left side)
 *
 * State A (no selection): Library — drag-and-drop container cards + furniture.
 * State B (selection active): Inspector — IsoEditor + MatrixEditor.
 *
 * The "Back to Library" button and clicking the empty canvas both clear selection,
 * returning to State A seamlessly.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import {
  type Container,
  ContainerSize,
  ViewMode,
  FurnitureType,
  FURNITURE_CATALOG,
  CONTAINER_DIMENSIONS,
} from "@/types/container";
import { formatLengthShort } from "@/utils/unitFormat";
import IsoEditor from "@/components/ui/IsoEditor";
import MatrixEditor from "@/components/ui/MatrixEditor";
import { FrameInspector } from "@/components/ui/FrameInspector";
import FinishesPanel from "@/components/ui/finishes/FinishesPanel";
import SkinEditor from "@/components/ui/SkinEditor";
import { useSelectionTarget } from "@/hooks/useSelectionTarget";
import {
  Package, Box, Warehouse, ArrowLeft,
  Armchair, CookingPot, Bed, Bath, Laptop, UtensilsCrossed, Archive, Footprints,
  BookmarkPlus,
  ChevronDown,
  ChevronLeft, ChevronRight,
  Refrigerator, Flame, Droplets, Microwave,
  Lamp, Monitor, WashingMachine, TreePine, Sofa,
  Tv, BookOpen, Coffee, Shirt,
  Palette, Scan, Grid3x3,
} from "lucide-react";
import UserLibrary from "@/components/ui/UserLibrary";
import { PrefabsPanel } from "@/components/ui/PrefabsPanel";
import { useTabletDrawer } from "@/hooks/useTabletDrawer";
import { WIZARD_PRESETS } from "@/config/wizardPresets";
// Theme/Ground imports removed — selectors moved to TopToolbar Appearance popover

// ── Constants ────────────────────────────────────────────────

// Theme-adaptive via CSS variables (set in globals.css :root / [data-theme="dark"])
const CARD     = "var(--btn-bg, #ffffff)";
const BORDER   = "var(--border, #e2e8f0)";
const ACCENT   = "var(--accent, #2563eb)";
const TEXT     = "var(--text-main, #1e293b)";
const TEXT_DIM  = "var(--text-muted, #64748b)";

// ═══════════════════════════════════════════════════════════
// STATE A — LIBRARY
// ═══════════════════════════════════════════════════════════

const STRUCTURE_ITEMS = [
  { size: ContainerSize.Standard20, label: "20' Standard",   Icon: Package },
  { size: ContainerSize.Standard40, label: "40' Standard",   Icon: Box },
  { size: ContainerSize.HighCube40, label: "40' High Cube",  Icon: Warehouse },
];

/**
 * Build the dimension subtitle (length × width × height) for a Library tile.
 * Uses the active units setting so labels match the rest of the UI
 * (BlueprintRenderer dimensions, voxel preview, etc.).
 */
function formatContainerDims(size: ContainerSize, units: 'imperial' | 'metric'): string {
  const d = CONTAINER_DIMENSIONS[size];
  return `${formatLengthShort(d.length, units)} × ${formatLengthShort(d.width, units)} × ${formatLengthShort(d.height, units)}`;
}

const FURNITURE_ICONS: Record<FurnitureType, React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>> = {
  [FurnitureType.Stairs]:       Footprints,
  [FurnitureType.Kitchen]:      CookingPot,
  [FurnitureType.Bed]:          Bed,
  [FurnitureType.Bathroom]:     Bath,
  [FurnitureType.Sofa]:         Sofa,
  [FurnitureType.Desk]:         Laptop,
  [FurnitureType.DiningTable]:  UtensilsCrossed,
  [FurnitureType.Storage]:      Archive,
  [FurnitureType.Fridge]:       Refrigerator,
  [FurnitureType.Stove]:        Flame,
  [FurnitureType.KitchenSink]:  Droplets,
  [FurnitureType.Microwave]:    Microwave,
  [FurnitureType.BedSingle]:    Bed,
  [FurnitureType.Nightstand]:   Archive,
  [FurnitureType.Dresser]:      Shirt,
  [FurnitureType.Bathtub]:      Bath,
  [FurnitureType.Shower]:       Droplets,
  [FurnitureType.BathroomSink]: Droplets,
  [FurnitureType.Armchair]:     Armchair,
  [FurnitureType.CoffeeTable]:  Coffee,
  [FurnitureType.Bookshelf]:    BookOpen,
  [FurnitureType.TVUnit]:       Tv,
  [FurnitureType.Television]:   Tv,
  [FurnitureType.OfficeChair]:  Armchair,
  [FurnitureType.Monitor]:      Monitor,
  [FurnitureType.Washer]:       WashingMachine,
  [FurnitureType.Dryer]:        WashingMachine,
  [FurnitureType.Plant]:        TreePine,
  [FurnitureType.FloorLamp]:    Lamp,
  [FurnitureType.Rug]:          Palette,
  [FurnitureType.DiningChair]:  Armchair,
  [FurnitureType.BarStool]:     Armchair,
  [FurnitureType.Sectional]:    Sofa,
  [FurnitureType.Loveseat]:     Sofa,
  [FurnitureType.Ottoman]:      Armchair,
  [FurnitureType.SideTable]:    Coffee,
  [FurnitureType.ConsoleTable]: Coffee,
  [FurnitureType.BedKing]:      Bed,
  [FurnitureType.Wardrobe]:     Shirt,
  [FurnitureType.Vanity]:       Archive,
  [FurnitureType.KitchenIsland]: CookingPot,
};

function LibraryCard({
  label,
  subtitle,
  Icon,
  accentColor,
  onMouseDown,
  testId,
}: {
  label: string;
  subtitle: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  accentColor: string;
  onMouseDown: (e: React.MouseEvent) => void;
  testId?: string;
}) {
  return (
    <button
      data-testid={testId}
      onMouseDown={onMouseDown}
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "10px 12px", borderRadius: "10px",
        border: `1px solid ${BORDER}`,
        background: CARD,
        cursor: "grab", width: "100%", textAlign: "left",
        transition: "all 150ms ease-out",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accentColor;
        e.currentTarget.style.background = `${accentColor}0f`;
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = BORDER;
        e.currentTarget.style.background = CARD;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0,
        background: `${accentColor}12`,
      }}>
        <Icon size={18} strokeWidth={1.5} style={{ color: accentColor }} />
      </div>
      <div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: TEXT }}>{label}</div>
        <div style={{ fontSize: "10px", color: TEXT_DIM, marginTop: "1px" }}>{subtitle}</div>
      </div>
    </button>
  );
}

function Library() {
  const containers  = useStore((s) => s.containers);
  const selection   = useStore((s) => s.selection);
  const setDragContainer = useStore((s) => s.setDragContainer);
  const addFurniture     = useStore((s) => s.addFurniture);
  const viewMode         = useStore((s) => s.viewMode);
  const setBpvActiveContainerSize = useStore((s) => s.setBpvActiveContainerSize);
  const bpvActiveContainerSize    = useStore((s) => s.bpvActiveContainerSize);
  const units = useStore((s) => s.units);
  const [activeTab, setActiveTab] = useState<"structure" | "interior" | "saved">("structure");
  const [dragging, setDragging]   = useState<string | null>(null);
  const [dragPos, setDragPos]     = useState({ x: 0, y: 0 });

  const containerCount = Object.keys(containers).length;

  const handleContainerDrag = useCallback(
    (size: ContainerSize, e: React.MouseEvent) => {
      e.preventDefault();
      // Blueprint mode: click-to-arm instead of drag-to-place. Top-down
      // canvas has no clean drop target during drag, and the user already
      // sees the grid cell they want to fill — clicking the tile arms the
      // active size, then clicking the empty grid cell places it.
      if (viewMode === ViewMode.Blueprint) {
        // Toggle: click again with the same size armed = clear (cancel).
        setBpvActiveContainerSize(bpvActiveContainerSize === size ? null : size);
        return;
      }
      setDragging(size);
      setDragPos({ x: e.clientX, y: e.clientY });
      setDragContainer(size);
      const handleMove = (ev: MouseEvent) => setDragPos({ x: ev.clientX, y: ev.clientY });
      const handleUp = () => {
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
        setDragging(null);
      };
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [setDragContainer, viewMode, bpvActiveContainerSize, setBpvActiveContainerSize]
  );

  const handleFurnitureDrop = useCallback(
    (type: FurnitureType) => {
      const id = selection[0];
      if (!id) return;
      addFurniture(id, type);
    },
    [selection, addFurniture]
  );

  return (
    <>
      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", padding: "0 0 12px" }}>
        {(["structure", "interior", "saved"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: "6px 0", borderRadius: "8px",
              fontSize: "11px", fontWeight: 600, cursor: "pointer",
              border: `1px solid ${activeTab === tab ? ACCENT : BORDER}`,
              background: activeTab === tab ? `${ACCENT}10` : "transparent",
              color: activeTab === tab ? ACCENT : TEXT_DIM,
              transition: "all 150ms ease-out",
            }}
          >
            {tab === "structure" ? "Structure" : tab === "interior" ? "Interior" : "Saved"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {activeTab === "structure" && (
          <>
            {STRUCTURE_ITEMS.map((item) => (
              <LibraryCard
                key={item.size}
                label={item.label}
                subtitle={formatContainerDims(item.size, units)}
                Icon={item.Icon}
                accentColor="#3b82f6"
                onMouseDown={(e) => handleContainerDrag(item.size, e)}
              />
            ))}
            {/* Pool Container — subterranean 40' HC. Click to place; the action
                creates the container at Y = -height (top flush with ground). */}
            <LibraryCard
              label="Pool Container"
              subtitle="Subterranean 40' HC — concrete basin"
              Icon={Droplets}
              accentColor="#2563eb"
              onMouseDown={(e) => {
                e.preventDefault();
                useStore.getState().addPoolContainer();
              }}
              testId="library-pool-container"
            />
          </>
        )}

        {activeTab === "interior" && (
          <>
            {selection.length === 0 && (
              <div style={{ fontSize: "11px", color: TEXT_DIM, textAlign: "center", padding: "8px 0" }}>
                Select a container first
              </div>
            )}
            {FURNITURE_CATALOG.map((entry) => {
              const Icon = FURNITURE_ICONS[entry.type];
              const d = entry.dims;
              return (
                <LibraryCard
                  key={entry.type}
                  label={entry.label}
                  subtitle={`${formatLengthShort(d.length, units)} × ${formatLengthShort(d.width, units)} × ${formatLengthShort(d.height, units)}`}
                  Icon={Icon}
                  accentColor="#22c55e"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleFurnitureDrop(entry.type);
                  }}
                />
              );
            })}
          </>
        )}

        {activeTab === "saved" && (
          <>
            <UserLibrary />
            <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: `1px solid ${BORDER}` }}>
              <PrefabsPanel />
            </div>
          </>
        )}
      </div>

      {containerCount > 0 && (
        <div style={{
          marginTop: "12px", paddingTop: "10px",
          borderTop: `1px solid ${BORDER}`,
          fontSize: "10px", color: TEXT_DIM, textAlign: "center",
        }}>
          {containerCount} container{containerCount !== 1 ? "s" : ""} on canvas
        </div>
      )}

      {/* Drag ghost */}
      {dragging && (
        <div
          style={{
            position: "fixed", zIndex: 200, pointerEvents: "none",
            left: dragPos.x - 32, top: dragPos.y - 16,
          }}
        >
          <div style={{
            padding: "6px 12px", borderRadius: "8px",
            border: `2px dashed ${ACCENT}`,
            background: `${ACCENT}12`,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            fontSize: "12px", fontWeight: 700, color: ACCENT,
          }}>
            {STRUCTURE_ITEMS.find((p) => p.size === dragging)?.label ?? dragging}
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// STATE B — INSPECTOR
// ═══════════════════════════════════════════════════════════

// Container size label helper
const SIZE_LABEL: Record<ContainerSize, string> = {
  [ContainerSize.Standard20]: "20ft Standard",
  [ContainerSize.Standard40]: "40ft Standard",
  [ContainerSize.HighCube40]: "40ft High-Cube",
};

// GlobalTools moved to TopToolbar (Appearance popover + Dev Tools dropdown) in Sprint 14.
// Theme/Ground selectors → TopToolbar Appearance button
// Cutaway/Measure/Labels → TopToolbar Dev Tools (Bug icon) dropdown

// Inspector ─────────────────────────────────────────────────

function Inspector({
  container,
  containerId,
}: {
  container: Container;
  containerId: string;
}) {
  const saveContainerToLibrary = useStore((s) => s.saveContainerToLibrary);
  const renameContainer = useStore((s) => s.renameContainer);
  const frameMode = useStore((s) => s.frameMode);
  const previewCollapsed = useStore((s) => s.previewCollapsed);
  const setPreviewCollapsed = useStore((s) => s.setPreviewCollapsed);
  const gridCollapsed = useStore((s) => s.gridCollapsed);
  const setGridCollapsed = useStore((s) => s.setGridCollapsed);
  const addContainer = useStore((s) => s.addContainer);
  const units = useStore((s) => s.units);
  const stackContainer = useStore((s) => s.stackContainer);
  const unstackContainer = useStore((s) => s.unstackContainer);
  const removeContainer = useStore((s) => s.removeContainer);
  // Primitive selector — only re-renders when the boolean flips, not on every voxel paint
  const hasContainerAbove = useStore((s) =>
    Object.values(s.containers).some((c) => c.stackedOn === containerId)
  );

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(container.name || "");

  const selectedObjectId = useStore((s) => s.selectedObjectId);
  const target = useSelectionTarget();

  const commitName = useCallback(() => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== container.name) {
      renameContainer(containerId, trimmed);
    }
    setEditingName(false);
  }, [nameValue, container.name, containerId, renameContainer]);

  const containerName = container.name || SIZE_LABEL[container.size];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Compact container header: editable name + icon row + S/D toggle */}
      <div style={{
        padding: "6px 10px 4px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") { setNameValue(container.name || ""); setEditingName(false); }
              }}
              style={{
                flex: 1, fontSize: "15px", fontWeight: 700, color: TEXT,
                background: "#fff", border: `1px solid #3b82f6`, borderRadius: "4px",
                padding: "1px 4px", outline: "none", boxSizing: "border-box",
              }}
            />
          ) : (
            <div
              onClick={() => { setEditingName(true); setNameValue(container.name || SIZE_LABEL[container.size]); }}
              style={{
                flex: 1, fontSize: "15px", fontWeight: 700, color: TEXT, cursor: "text",
                padding: "1px 4px", borderRadius: "4px", border: "1px solid transparent",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
              className="hover-rename"
              title="Click to rename"
            >
              {containerName}
            </div>
          )}
          {/* Icon row: save, preview toggle, grid toggle, stack/unstack */}
          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            <button
              onClick={() => saveContainerToLibrary(containerId, containerName)}
              title="Save to library"
              style={{
                background: "none", border: "1px solid #e2e8f0", borderRadius: "4px",
                cursor: "pointer", padding: "3px 4px",
                color: "#64748b", display: "flex", alignItems: "center",
              }}
            >
              <BookmarkPlus size={12} />
            </button>
            <button
              onClick={() => setPreviewCollapsed(!previewCollapsed)}
              title={previewCollapsed ? "Show container preview" : "Hide container preview"}
              style={{
                background: previewCollapsed ? "none" : "rgba(59,130,246,0.1)",
                border: "1px solid #e2e8f0", borderRadius: "4px",
                cursor: "pointer", padding: "3px 4px",
                color: previewCollapsed ? "#64748b" : "#3b82f6", display: "flex", alignItems: "center",
              }}
            >
              <Scan size={12} />
            </button>
            <button
              onClick={() => setGridCollapsed(!gridCollapsed)}
              title={gridCollapsed ? "Show grid" : "Hide grid"}
              style={{
                background: gridCollapsed ? "none" : "rgba(59,130,246,0.1)",
                border: "1px solid #e2e8f0", borderRadius: "4px",
                cursor: "pointer", padding: "3px 4px",
                color: gridCollapsed ? "#64748b" : "#3b82f6", display: "flex", alignItems: "center",
              }}
            >
              <Grid3x3 size={12} />
            </button>
            {container.level === 0 && !hasContainerAbove && (
              <button
                onClick={() => {
                  const newId = addContainer(container.size);
                  if (newId) stackContainer(newId, containerId);
                }}
                title="Stack container above"
                style={{
                  background: "var(--btn-bg, #fff)", border: "1px solid #e2e8f0", borderRadius: "6px",
                  cursor: "pointer", padding: "6px 8px", minWidth: 32, height: 28,
                  color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, transition: "all 150ms ease-out",
                }}
              >
                ⬆
              </button>
            )}
            {container.level > 0 && container.stackedOn && (
              <button
                onClick={() => { unstackContainer(containerId); removeContainer(containerId); }}
                title="Unstack and remove"
                style={{
                  background: "var(--btn-bg, #fff)", border: "1px solid #fca5a5", borderRadius: "6px",
                  cursor: "pointer", padding: "6px 8px", minWidth: 32, height: 28,
                  color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, transition: "all 150ms ease-out",
                }}
              >
                ✕
              </button>
            )}
            {/* Simple/Detail toggle moved to Settings dropdown in TopToolbar */}
          </div>
        </div>
      </div>

      {/* Preview — collapsed by default, toggle via icon button above */}
      {!previewCollapsed && (
        <div style={{ flexShrink: 0, marginBottom: "4px" }}>
          <IsoEditor containerId={container.id} />
        </div>
      )}

      {/* Grid — collapsed by default, toggle via icon button above */}
      {!gridCollapsed && (
        <div style={{ flexShrink: 0, marginBottom: "4px" }}>
          <MatrixEditor container={container} containerId={containerId} />
          {frameMode && <FrameInspector containerId={containerId} />}
        </div>
      )}

      {/* ── Contextual area — fills remaining space ── */}
      <div style={{ flex: 1, overflowY: "auto", borderTop: "1px solid #1e293b", marginTop: "4px" }}>
        {selectedObjectId ? (
          <SkinEditor />
        ) : (target.type === "voxel" || target.type === "bay" || target.type === "face" || target.type === "bay-face") ? (
          <FinishesPanel />
        ) : (
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              Container Properties
            </div>

            {/* Applied Wizard Preset (read-only) — surfaces appliedPreset so users
                can see which Quick Setup preset shaped this container. */}
            {container.appliedPreset && (() => {
              const preset = WIZARD_PRESETS.find((p) => p.id === container.appliedPreset);
              const label = preset?.label ?? container.appliedPreset;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, width: 92, flexShrink: 0 }}>Preset</span>
                  <span
                    data-testid="inspector-applied-preset"
                    title={preset?.description ?? ''}
                    style={{
                      flex: 1, fontSize: 12, padding: "6px 8px", borderRadius: 6,
                      border: `1px solid ${BORDER}`, background: `${ACCENT}10`, color: ACCENT,
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })()}

            {/* Interior Finish */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, width: 92, flexShrink: 0 }}>Finish</span>
              <select
                value={container.interiorFinish ?? "raw"}
                onChange={(e) => {
                  useStore.getState().setInteriorFinish(
                    containerId,
                    e.target.value as NonNullable<Container["interiorFinish"]>
                  );
                }}
                style={{
                  flex: 1, fontSize: 12, padding: "6px 8px", borderRadius: 6,
                  border: `1px solid ${BORDER}`, background: CARD, color: TEXT,
                  cursor: "pointer",
                }}
              >
                <option value="raw">Raw Steel</option>
                <option value="plywood">Plywood</option>
                <option value="drywall">Drywall</option>
                <option value="painted">Painted</option>
              </select>
            </div>

            {/* Rooftop Deck toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, width: 92, flexShrink: 0 }}>Rooftop Deck</span>
              <button
                data-testid="btn-toggle-deck"
                onClick={() => {
                  const s = useStore.getState();
                  const c = s.containers[containerId];
                  // Detect if deck is already applied by checking body voxel top faces
                  const bodyIdx = 1 * 8 + 1; // row=1, col=1
                  const hasDeck = c?.voxelGrid?.[bodyIdx]?.faces?.top === "Deck_Wood";
                  if (hasDeck) {
                    s.removeRooftopDeck(containerId);
                  } else {
                    s.generateRooftopDeck(containerId);
                  }
                }}
                style={{
                  flex: 1, fontSize: 12, padding: "7px 10px", borderRadius: 6,
                  border: `1px solid ${BORDER}`, background: CARD, color: TEXT,
                  cursor: "pointer", fontWeight: 600, transition: "all 150ms ease-out",
                }}
              >
                {container.voxelGrid?.[1 * 8 + 1]?.faces?.top === "Deck_Wood" ? "✓ Remove Deck" : "+ Add Deck"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DESIGN MODE PANEL — Compact panel for 3D mode
// ═══════════════════════════════════════════════════════════

function DesignModePanel() {
  const setDragContainer = useStore((s) => s.setDragContainer);
  const units = useStore((s) => s.units);
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);

  // Click-to-equip: clicking a size starts ghost placement (Sims pattern)
  // The ghost follows the cursor, click to place at the target location
  const handleAdd = (size: ContainerSize) => {
    setDragContainer(size);
    setSizeMenuOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ position: "relative" }}>
        <button
          data-testid="btn-add-container"
          onClick={() => setSizeMenuOpen(!sizeMenuOpen)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, padding: "10px 0", borderRadius: 8, width: "100%",
            border: `1px solid ${ACCENT}`,
            background: `${ACCENT}10`, color: ACCENT,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            transition: "all 150ms ease-out",
          }}
        >
          + Add Container
          <ChevronDown size={14} style={{ transform: sizeMenuOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
        </button>
        {sizeMenuOpen && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
            background: CARD, borderRadius: 8, border: `1px solid ${BORDER}`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 200, overflow: "hidden",
          }}>
            {STRUCTURE_ITEMS.map((item) => (
              <button
                key={item.size}
                data-testid={`add-container-${item.size}`}
                onClick={() => handleAdd(item.size)}
                style={{
                  display: "block", width: "100%", padding: "10px 16px", textAlign: "left",
                  border: "none", borderBottom: `1px solid ${BORDER}`,
                  background: "none", cursor: "pointer", fontSize: 13, transition: "background 150ms ease-out",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${ACCENT}08`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              >
                <div style={{ fontWeight: 600, color: TEXT }}>{item.label}</div>
                <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 3, lineHeight: 1.4 }}>{formatContainerDims(item.size, units)}</div>
              </button>
            ))}
            {/* Pool container — subterranean HighCube40 */}
            <button
              data-testid="add-pool-container"
              onClick={() => {
                useStore.getState().addPoolContainer();
                setSizeMenuOpen(false);
              }}
              style={{
                display: "block", width: "100%", padding: "10px 16px", textAlign: "left",
                border: "none", borderTop: `1px solid #e2e8f0`,
                background: "none", cursor: "pointer", fontSize: 13, transition: "background 150ms ease-out",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${ACCENT}08`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              <div style={{ fontWeight: 600, color: "#2563eb" }}>Pool Container</div>
              <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 3, lineHeight: 1.4 }}>Subterranean 40&apos; HC — concrete basin</div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT — Super-Sidebar
// ═══════════════════════════════════════════════════════════

export default function Sidebar() {
  const selection     = useStore((s) => s.selection);
  const containers    = useStore((s) => s.containers);
  const clearSelection = useStore((s) => s.clearSelection);
  const selectContainer = useStore((s) => s.select);
  const viewMode      = useStore((s) => s.viewMode);
  const collapsed     = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  // Below 1024px the sidebar becomes a slide-in drawer that overlays the canvas.
  const isDrawer = useTabletDrawer();

  // When the viewport first crosses into drawer mode (tablet-width), collapse
  // the sidebar so the canvas isn't immediately covered by an open drawer.
  const autoCollapsedRef = useRef(false);
  useEffect(() => {
    if (isDrawer && !autoCollapsedRef.current && !collapsed) {
      autoCollapsedRef.current = true;
      toggleSidebar();
    }
    if (!isDrawer) autoCollapsedRef.current = false;
  }, [isDrawer, collapsed, toggleSidebar]);

  const selectedElements = useStore((s) => s.selectedElements);

  // Primary selected container — from explicit selection OR from voxel selection (auto-switch)
  const selectionId = selection.length > 0 ? selection[selection.length - 1] : null;
  const voxelContainerId = selectedElements?.items[0]?.containerId ?? null;
  const selectedId  = selectionId ?? voxelContainerId;
  const container   = selectedId ? containers[selectedId] : null;

  // ★ Inspector auto-switch: show whenever a container is selected OR any voxel is selected
  const isInspecting = !!(container && selectedId);

  // ── Collapsed state: thin strip with expand button ──
  if (collapsed) {
    return (
      <div
        data-testid="sidebar-collapsed"
        style={{
          width: "48px",
          height: "100%",
          background: "var(--panel-bg)",
          backdropFilter: "blur(16px) saturate(1.4)",
          WebkitBackdropFilter: "blur(16px) saturate(1.4)",
          borderRight: `1px solid ${BORDER}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexShrink: 0,
          boxShadow: "4px 0 24px rgba(0,0,0,0.08), 1px 0 2px rgba(0,0,0,0.04)",
          paddingTop: "10px",
          gap: "8px",
          // In drawer mode the collapsed strip also floats over the canvas so it doesn't
          // reserve layout width on tablets — the canvas gets the full viewport.
          ...(isDrawer && {
            position: "absolute" as const,
            top: 0,
            left: 0,
            zIndex: 39,
          }),
        }}
      >
        <button
          onClick={toggleSidebar}
          title="Expand sidebar ( [ )"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 6,
            background: "none", border: `1px solid ${BORDER}`,
            cursor: "pointer", color: TEXT_DIM,
            transition: "all 150ms ease-out",
          }}
          className="hover-accent-icon"
        >
          <ChevronRight size={16} />
        </button>
        {/* Quick add container button */}
        <button
          onClick={() => {
            const store = useStore.getState();
            store.setDragContainer(ContainerSize.HighCube40);
          }}
          title="Place 40' High Cube (click to position)"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 6,
            background: `${ACCENT}10`, border: `1px solid ${ACCENT}40`,
            cursor: "pointer", color: ACCENT, fontSize: 16, fontWeight: 700,
          }}
        >
          +
        </button>
        {/* Inspector indicator when container selected */}
        {isInspecting && (
          <button
            onClick={toggleSidebar}
            title="Open inspector"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 6,
              background: "rgba(21, 101, 192, 0.12)", border: `1px solid ${ACCENT}40`,
              cursor: "pointer", color: ACCENT,
            }}
          >
            <Scan size={14} />
          </button>
        )}
      </div>
    );
  }

  // ── Expanded state ──
  return (
    <>
      {/* Backdrop for drawer mode — clicking it collapses the sidebar back. */}
      {isDrawer && (
        <div
          aria-hidden
          onClick={toggleSidebar}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(15,23,42,0.32)",
            zIndex: 40,
            animation: "drawer-fade 150ms ease-out",
          }}
        />
      )}
      <style>{`@keyframes drawer-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes drawer-slide-in { from { transform: translateX(-100%) } to { transform: translateX(0) } }`}</style>
      <div
      data-testid="sidebar-expanded"
      style={{
        width: isDrawer ? "min(380px, 90vw)" : "440px",
        height: "100%",
        background: "var(--panel-bg, rgba(248,250,252,0.82))",
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
        borderRight: "1px solid var(--border, rgba(255,255,255,0.35))",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
        boxShadow: "var(--panel-shadow, 4px 0 24px rgba(0,0,0,0.08))",
        color: "var(--text-main, #374151)",
        ...(isDrawer && {
          position: "absolute" as const,
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 41,
          animation: "drawer-slide-in 220ms ease-out",
        }),
      }}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px 10px",
        borderBottom: `1px solid ${BORDER}`,
        background: "var(--surface-alt, rgba(255,255,255,0.5))",
        flexShrink: 0,
      }}>
        {isInspecting ? (
          <>
            <button
              onClick={clearSelection}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                background: "none", border: "none", color: ACCENT,
                cursor: "pointer", fontSize: "12px", fontWeight: 600,
                padding: "2px 0",
              }}
            >
              <ArrowLeft size={13} />
              Library
            </button>
            <span style={{ fontSize: "11px", color: TEXT_DIM, fontWeight: 600 }}>
              Inspector
            </span>
            {/* Container prev/next navigation */}
            {(() => {
              const containerIds = Object.keys(containers);
              const currentIdx = containerIds.indexOf(selectedId ?? '');
              const canNav = containerIds.length > 1;
              const goPrev = () => {
                if (!canNav) return;
                selectContainer(containerIds[(currentIdx - 1 + containerIds.length) % containerIds.length]);
              };
              const goNext = () => {
                if (!canNav) return;
                selectContainer(containerIds[(currentIdx + 1) % containerIds.length]);
              };
              return (
                <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#9ca3af", userSelect: "none" }}>
                    {currentIdx + 1}/{containerIds.length}
                  </span>
                  <button onClick={goPrev} disabled={!canNav} title="Previous container" style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 20, height: 20, borderRadius: 4,
                    background: "none", border: "1px solid #e2e8f0",
                    color: canNav ? ACCENT : "#9ca3af",
                    cursor: canNav ? "pointer" : "default", padding: 0,
                  }}>
                    <ChevronLeft size={12} />
                  </button>
                  <button onClick={goNext} disabled={!canNav} title="Next container" style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 20, height: 20, borderRadius: 4,
                    background: "none", border: "1px solid #e2e8f0",
                    color: canNav ? ACCENT : "#9ca3af",
                    cursor: canNav ? "pointer" : "default", padding: 0,
                  }}>
                    <ChevronRight size={12} />
                  </button>
                </div>
              );
            })()}
          </>
        ) : (
          <>
            <span style={{ fontSize: "13px", fontWeight: 700, color: TEXT }}>Library</span>
            <span style={{ fontSize: "10px", color: TEXT_DIM }}>Drag to canvas</span>
          </>
        )}
        {/* Collapse button */}
        <button
          onClick={toggleSidebar}
          title="Collapse sidebar ( [ )"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 24, height: 24, borderRadius: 4, marginLeft: 6,
            background: "none", border: `1px solid ${BORDER}`,
            cursor: "pointer", color: TEXT_DIM, flexShrink: 0,
            transition: "all 150ms ease-out",
          }}
          className="hover-accent-icon"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: "12px 16px",
        display: "flex", flexDirection: "column",
      }}>
        {isInspecting && container ? (
          <Inspector
            key={selectedId}
            container={container}
            containerId={selectedId!}
          />
        ) : (
          <>
            {viewMode === ViewMode.Realistic3D && (
              <div style={{ marginBottom: 12 }}>
                <DesignModePanel />
              </div>
            )}
            <Library />
          </>
        )}
      </div>

      {/* BOM Footer removed — cost total moved to TopToolbar */}
    </div>
    </>
  );
}
