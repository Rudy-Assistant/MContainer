"use client";

/**
 * Sidebar.tsx — Unified "Super-Sidebar" (384px, left side)
 *
 * State A (no selection): Library — drag-and-drop container cards + furniture.
 * State B (selection active): Inspector — IsoEditor + MatrixEditor.
 *
 * The "Back to Library" button and clicking the empty canvas both clear selection,
 * returning to State A seamlessly.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import {
  type Container,
  ContainerSize,
  ViewMode,
  FurnitureType,
  FURNITURE_CATALOG,
} from "@/types/container";
import IsoEditor from "@/components/ui/IsoEditor";
import MatrixEditor from "@/components/ui/MatrixEditor";
import { CONTAINER_PRESETS } from "@/config/containerPresets";
import { CONTAINER_ROLES } from "@/config/containerRoles";
import {
  Package, Box, Warehouse, ArrowLeft,
  Armchair, CookingPot, Bed, Bath, Laptop, UtensilsCrossed, Archive, Footprints,
  BookmarkPlus,
  Scan, Ruler, Palette, Mountain, Tag, ChevronDown,
  ChevronLeft, ChevronRight,
  Refrigerator, Flame, Droplets, Microwave,
  Lamp, Monitor, WashingMachine, TreePine, Sofa,
  Tv, BookOpen, Coffee, Shirt,
} from "lucide-react";
import UserLibrary from "@/components/ui/UserLibrary";
import { THEMES, THEME_IDS, type ThemeId } from "@/config/themes";
import { GROUND_PRESET_IDS, GROUND_PRESETS, type GroundPresetId } from "@/config/groundPresets";

// ── BOM formatting ────────────────────────────────────────────

function fmtUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

// ── Constants ────────────────────────────────────────────────

const BG      = "#f8fafc";           // slate-50 — light background
const CARD    = "#ffffff";           // white cards
const BORDER  = "#e2e8f0";          // slate-200
const ACCENT  = "#1565c0";
const TEXT    = "#1e293b";          // slate-800
const TEXT_DIM = "#64748b";         // slate-500

// ── Section header ───────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "10px", fontWeight: 700, color: TEXT_DIM,
      textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 0 5px",
    }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: "1px", background: BORDER, flexShrink: 0 }} />;
}

// ═══════════════════════════════════════════════════════════
// STATE A — LIBRARY
// ═══════════════════════════════════════════════════════════

const STRUCTURE_ITEMS = [
  { size: ContainerSize.Standard20, label: "20' Standard",   dims: "6.06 × 2.44 × 2.59 m", Icon: Package },
  { size: ContainerSize.Standard40, label: "40' Standard",   dims: "12.19 × 2.44 × 2.59 m", Icon: Box },
  { size: ContainerSize.HighCube40, label: "40' High Cube",  dims: "12.19 × 2.44 × 2.90 m", Icon: Warehouse },
];

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
};

function LibraryCard({
  label,
  subtitle,
  Icon,
  accentColor,
  onMouseDown,
}: {
  label: string;
  subtitle: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  accentColor: string;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onMouseDown={onMouseDown}
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "10px 12px", borderRadius: "10px",
        border: `1px solid ${BORDER}`,
        background: CARD,
        cursor: "grab", width: "100%", textAlign: "left",
        transition: "all 120ms ease",
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
  const [activeTab, setActiveTab] = useState<"structure" | "interior" | "saved">("structure");
  const [dragging, setDragging]   = useState<string | null>(null);
  const [dragPos, setDragPos]     = useState({ x: 0, y: 0 });

  const containerCount = Object.keys(containers).length;

  const handleContainerDrag = useCallback(
    (size: ContainerSize, e: React.MouseEvent) => {
      e.preventDefault();
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
    [setDragContainer]
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
              transition: "all 120ms ease",
            }}
          >
            {tab === "structure" ? "Structure" : tab === "interior" ? "Interior" : "Saved"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {activeTab === "structure" &&
          STRUCTURE_ITEMS.map((item) => (
            <LibraryCard
              key={item.size}
              label={item.label}
              subtitle={item.dims}
              Icon={item.Icon}
              accentColor="#3b82f6"
              onMouseDown={(e) => handleContainerDrag(item.size, e)}
            />
          ))}

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
                  subtitle={`${d.length} × ${d.width} × ${d.height} m`}
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

        {activeTab === "saved" && <UserLibrary />}
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

// GlobalTools — always visible, viewport-level toggles ──────

function GlobalTools() {
  const dollhouseActive = useStore((s) => s.dollhouseActive);
  const toggleDollhouse = useStore((s) => s.toggleDollhouse);
  const tapeActive = useStore((s) => s.tapeActive);
  const toggleTape = useStore((s) => s.toggleTape);
  const showFurnitureLabels = useStore((s) => s.showFurnitureLabels);
  const toggleFurnitureLabels = useStore((s) => s.toggleFurnitureLabels);
  const currentTheme = useStore((s) => s.currentTheme);
  const setTheme = useStore((s) => s.setTheme);
  const groundPreset = useStore((s) => s.environment.groundPreset) as GroundPresetId | undefined;
  const setGroundPreset = useStore((s) => s.setGroundPreset);
  const setActivePalette = useStore((s) => s.setActivePalette);

  const toolBtn = (active: boolean, accent: string): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: "6px",
    flex: 1, height: "32px", padding: "0 10px",
    borderRadius: "6px", border: `1px solid ${active ? accent : BORDER}`,
    cursor: "pointer", fontSize: "11px", fontWeight: 600,
    color: active ? accent : TEXT_DIM,
    background: active ? `${accent}12` : CARD,
    transition: "all 150ms ease",
  });

  const THEME_COLORS: Record<ThemeId, string> = {
    industrial: "#607d8b",
    japanese:   "#5d4037",
    desert:     "#d4a373",
  };

  const GROUND_COLORS: Record<GroundPresetId, string> = {
    grass:    "#4a7a30",
    concrete: "#8a8a88",
    gravel:   "#7a7568",
    dirt:     "#6b5b3e",
  };

  const activeGround = groundPreset && groundPreset in GROUND_PRESETS
    ? groundPreset as GroundPresetId
    : "grass";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "0 0 4px" }}>
      {/* Tool toggles */}
      <div style={{ display: "flex", gap: "6px" }}>
        <button onClick={toggleDollhouse} style={toolBtn(dollhouseActive, "#2563eb")} title="Dollhouse Cutaway (X-Ray)">
          <Scan size={13} /> Cutaway
        </button>
        <button onClick={toggleTape} style={toolBtn(tapeActive, "#d97706")} title="Tape Measure">
          <Ruler size={13} /> Measure
        </button>
        <button onClick={toggleFurnitureLabels} style={toolBtn(showFurnitureLabels, "#059669")} title="Furniture Labels">
          <Tag size={13} /> Labels
        </button>
      </div>
      {/* Theme selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Palette size={13} style={{ color: TEXT_DIM, flexShrink: 0 }} />
        <div style={{
          display: "flex", flex: 1, borderRadius: "6px",
          border: `1px solid ${BORDER}`, overflow: "hidden",
        }}>
          {THEME_IDS.map((tid) => {
            const active = currentTheme === tid;
            return (
              <button
                key={tid}
                data-testid={`theme-${tid}`}
                onClick={() => { setTheme(tid); setActivePalette(tid); }}
                style={{
                  flex: 1, height: "28px", border: "none", cursor: "pointer",
                  fontSize: "10px", fontWeight: active ? 700 : 500,
                  color: active ? "#fff" : TEXT_DIM,
                  background: active ? THEME_COLORS[tid] : CARD,
                  borderRight: tid !== THEME_IDS[THEME_IDS.length - 1] ? `1px solid ${BORDER}` : "none",
                  transition: "all 150ms ease",
                }}
                title={THEMES[tid].label}
              >
                {THEMES[tid].label}
              </button>
            );
          })}
        </div>
      </div>
      {/* Ground preset selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Mountain size={13} style={{ color: TEXT_DIM, flexShrink: 0 }} />
        <div style={{
          display: "flex", flex: 1, borderRadius: "6px",
          border: `1px solid ${BORDER}`, overflow: "hidden",
        }}>
          {GROUND_PRESET_IDS.map((gid) => {
            const active = activeGround === gid;
            return (
              <button
                key={gid}
                data-testid={`ground-${gid}`}
                onClick={() => setGroundPreset(gid)}
                style={{
                  flex: 1, height: "28px", border: "none", cursor: "pointer",
                  fontSize: "10px", fontWeight: active ? 700 : 500,
                  color: active ? "#fff" : TEXT_DIM,
                  background: active ? GROUND_COLORS[gid] : CARD,
                  borderRight: gid !== GROUND_PRESET_IDS[GROUND_PRESET_IDS.length - 1] ? `1px solid ${BORDER}` : "none",
                  transition: "all 150ms ease",
                }}
                title={GROUND_PRESETS[gid].label}
              >
                {GROUND_PRESETS[gid].label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Inspector ─────────────────────────────────────────────────

function Inspector({
  container,
  containerId,
  prevContainerId,
}: {
  container: Container;
  containerId: string;
  prevContainerId: string | null;
}) {
  const saveContainerToLibrary = useStore((s) => s.saveContainerToLibrary);
  const renameContainer = useStore((s) => s.renameContainer);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(container.name || "");

  // Sync local name when selection changes
  useEffect(() => {
    setNameValue(container.name || "");
    setEditingName(false);
  }, [containerId, container.name]);

  const commitName = useCallback(() => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== container.name) {
      renameContainer(containerId, trimmed);
    }
    setEditingName(false);
  }, [nameValue, container.name, containerId, renameContainer]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Container badge */}
      <div style={{
        padding: "8px 10px", borderRadius: "8px",
        background: CARD, border: `1px solid ${BORDER}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex", alignItems: "flex-start", gap: "8px",
      }}>
        <div style={{ flex: 1 }}>
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
                width: "100%", fontSize: "13px", fontWeight: 700, color: TEXT,
                background: "#fff", border: `1px solid #3b82f6`, borderRadius: "4px",
                padding: "1px 4px", outline: "none", boxSizing: "border-box",
              }}
            />
          ) : (
            <div
              onClick={() => { setEditingName(true); setNameValue(container.name || SIZE_LABEL[container.size]); }}
              style={{
                fontSize: "13px", fontWeight: 700, color: TEXT, cursor: "text",
                padding: "1px 4px", borderRadius: "4px", border: "1px solid transparent",
                transition: "border-color 100ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
              title="Click to rename"
            >
              {container.name || SIZE_LABEL[container.size]}
            </div>
          )}
          <div style={{ fontSize: "9px", color: TEXT_DIM, marginTop: "2px", paddingLeft: "4px" }}>
            {SIZE_LABEL[container.size]}
            {" · "}Level {container.level}
            {" · "}
            {Object.values(container.walls).reduce((n, w) => n + w.bays.length, 0)} bays
          </div>
        </div>
        <button
          onClick={() => saveContainerToLibrary(containerId, container.name || SIZE_LABEL[container.size])}
          title="Save container to library"
          style={{
            background: "none", border: "1px solid #e2e8f0", borderRadius: "5px",
            cursor: "pointer", padding: "4px 5px",
            color: "#64748b", display: "flex", alignItems: "center",
            transition: "all 100ms ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#f59e0b"; e.currentTarget.style.borderColor = "#f59e0b"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
        >
          <BookmarkPlus size={13} />
        </button>
      </div>

      {/* Applied Template badge */}
      {container.appliedPreset && (() => {
        const preset = CONTAINER_PRESETS.find(p => p.id === container.appliedPreset);
        return preset ? (
          <div style={{
            padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 600,
            background: "rgba(139, 92, 246, 0.12)", border: "1px solid rgba(139, 92, 246, 0.3)",
            color: "#c4b5fd", display: "flex", alignItems: "center", gap: "4px",
          }}>
            {preset.icon} {preset.label}
          </div>
        ) : null;
      })()}

      {/* Applied Role badge */}
      {container.appliedRole && (() => {
        const role = CONTAINER_ROLES.find(r => r.id === container.appliedRole);
        return role ? (
          <div style={{
            padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 600,
            background: "rgba(34, 197, 94, 0.12)", border: "1px solid rgba(34, 197, 94, 0.3)",
            color: "#86efac", display: "flex", alignItems: "center", gap: "4px",
          }}>
            {role.icon} {role.label}
          </div>
        ) : null;
      })()}

      {/* Interior Finish */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: TEXT_DIM }}>Finish:</span>
        <select
          value={container.interiorFinish ?? 'raw'}
          onChange={(e) => {
            useStore.getState().setInteriorFinish(containerId, e.target.value as any);
          }}
          style={{
            flex: 1, fontSize: 10, padding: "3px 6px", borderRadius: 4,
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

      {/* IsoEditor — interactive 3D mini-view (reads from store for live sync) */}
      <IsoEditor containerId={container.id} />

      <Divider />

      {/* MatrixEditor — Voxel Cube Inspector */}
      <div>
        <MatrixEditor container={container} containerId={containerId} />
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BOM FOOTER
// ═══════════════════════════════════════════════════════════

function SidebarBOMFooter() {
  const containerCount = useStore((s) => Object.keys(s.containers).length);
  const getEstimate    = useStore((s) => s.getEstimate);
  if (containerCount === 0) return null;
  const est = getEstimate();
  const bd  = est.breakdown;

  return (
    <div style={{
      flexShrink: 0,
      padding: "8px 14px",
      borderTop: `1px solid #334155`,
      background: "#1e293b",
      display: "flex", alignItems: "center", gap: "0",
    }}>
      <span style={{
        fontSize: "8px", fontWeight: 800, color: "#64748b",
        textTransform: "uppercase", letterSpacing: "0.1em", marginRight: "10px",
      }}>
        BOM
      </span>

      {[
        { label: "Steel", value: bd.containers, color: "#78909c" },
        { label: "Glass", value: bd.modules,    color: "#4fc3f7" },
        { label: "Cuts",  value: bd.cuts,        color: "#ff8a65" },
      ].map(({ label, value, color }, i) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: "0" }}>
          {i > 0 && <div style={{ width: "1px", height: "24px", background: "#334155", margin: "0 10px" }} />}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "8px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
            <span style={{ fontSize: "11px", fontWeight: 600, color }}>{fmtUSD(value)}</span>
          </div>
        </div>
      ))}

      <div style={{ width: "1px", height: "24px", background: "#334155", margin: "0 10px" }} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: "8px", color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Total</span>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#93c5fd" }}>{fmtUSD(bd.total)}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DESIGN MODE PANEL — Compact panel for 3D mode
// ═══════════════════════════════════════════════════════════

function DesignModePanel() {
  const addContainer = useStore((s) => s.addContainer);
  const setAllExtensions = useStore((s) => s.setAllExtensions);
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);

  const handleAdd = (size: ContainerSize) => {
    const id = addContainer(size, { x: 0, y: 0, z: 0 });
    setAllExtensions(id, 'all_deck', false);
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
            transition: "all 120ms ease",
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
                  display: "block", width: "100%", padding: "8px 14px", textAlign: "left",
                  border: "none", borderBottom: `1px solid #f3f4f6`,
                  background: "none", cursor: "pointer", fontSize: 12,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${ACCENT}08`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              >
                <div style={{ fontWeight: 600, color: TEXT }}>{item.label}</div>
                <div style={{ fontSize: 10, color: TEXT_DIM, marginTop: 2 }}>{item.dims}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      <GlobalTools />
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
  const selectedVoxel = useStore((s) => s.selectedVoxel);
  const viewMode      = useStore((s) => s.viewMode);

  // Primary selected container — from explicit selection OR from voxel selection (auto-switch)
  const selectionId = selection.length > 0 ? selection[selection.length - 1] : null;
  const voxelContainerId = selectedVoxel?.containerId ?? null;
  const selectedId  = selectionId ?? voxelContainerId;
  const container   = selectedId ? containers[selectedId] : null;

  // Track previously selected container for "Match Style"
  const prevIdRef = useRef<string | null>(null);
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedId && selectedId !== prevIdRef.current) {
      setPrevSelectedId(prevIdRef.current);
      prevIdRef.current = selectedId;
    }
  }, [selectedId]);

  // ★ Inspector auto-switch: show whenever a container is selected OR any voxel is selected
  const isInspecting = !!(container && selectedId);

  return (
    <div
      style={{
        width: "384px",
        height: "100%",
        background: "rgba(248, 250, 252, 0.82)",
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
        borderRight: "1px solid rgba(255,255,255,0.35)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
        boxShadow: "4px 0 24px rgba(0,0,0,0.08), 1px 0 2px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px 10px",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        background: "rgba(255,255,255,0.5)",
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
      </div>

      {/* ── Scrollable body ─────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: "12px 16px",
        display: "flex", flexDirection: "column", gap: "12px",
      }}>
        {isInspecting && container ? (
          <>
            <GlobalTools />
            <Inspector
              container={container}
              containerId={selectedId!}
              prevContainerId={prevSelectedId}
            />
          </>
        ) : viewMode === ViewMode.Realistic3D ? (
          <DesignModePanel />
        ) : (
          <>
            <GlobalTools />
            <Library />
          </>
        )}
      </div>

      {/* ── BOM Footer ──────────────────────────────────── */}
      <SidebarBOMFooter />
    </div>
  );
}
