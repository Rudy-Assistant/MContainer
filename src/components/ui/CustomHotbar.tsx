"use client";

/**
 * CustomHotbar.tsx — Secondary hotbar (Shift+1-0)
 *
 * 10 user-assignable slots above the SmartHotbar. Users drag blocks
 * from the library or presets into slots, then activate with Shift+number.
 * Light theme matching SmartHotbar.
 */

import { useEffect, useCallback } from "react";
import { useStore, type HotbarSlot } from "@/store/useStore";
import { CssVoxelIcon } from "@/components/ui/SmartHotbar";
import { Plus, X } from "lucide-react";

const SLOT_SIZE = 44;

function CustomSlot({
  slot,
  index,
  isActive,
  onSelect,
  onRemove,
  onDrop,
}: {
  slot: HotbarSlot | null;
  index: number;
  isActive: boolean;
  onSelect: (i: number) => void;
  onRemove: (i: number) => void;
  onDrop: (i: number) => void;
}) {
  const displayKey = `S+${index === 9 ? 0 : index + 1}`;
  const isEmpty = !slot;

  return (
    <button
      onClick={() => { if (!isEmpty) onSelect(index); }}
      onMouseUp={() => onDrop(index)}
      title={slot ? `${slot.label} (${displayKey})` : `Empty slot (${displayKey}) — drag a block here`}
      style={{
        width: SLOT_SIZE,
        height: SLOT_SIZE,
        borderRadius: 6,
        border: isActive
          ? "2px solid #f59e0b"
          : isEmpty
            ? "1.5px dashed #d1d5db"
            : "1.5px solid #e5e7eb",
        borderTop: isActive ? "3px solid #f59e0b" : undefined,
        background: isActive ? "#fffbeb" : "#ffffff",
        cursor: isEmpty ? "default" : "pointer",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        transition: "all 100ms ease",
        opacity: isEmpty ? 0.5 : 1,
        boxShadow: isActive
          ? "0 0 0 1px #fbbf2440, 0 2px 8px #fbbf2420"
          : "0 1px 2px rgba(0,0,0,0.05)",
        outline: "none",
        overflow: "hidden",
      }}
    >
      {/* Key badge */}
      <span style={{
        position: "absolute", top: 1, left: 3,
        fontSize: 7, fontWeight: 800,
        color: isActive ? "#d97706" : "#9ca3af",
        lineHeight: 1, fontFamily: "monospace", zIndex: 2,
      }}>
        {displayKey}
      </span>

      {/* Content */}
      {slot?.faces ? (
        <CssVoxelIcon faces={slot.faces} size={14} />
      ) : (
        <Plus size={10} style={{ color: "#d1d5db" }} />
      )}

      {/* Label */}
      {slot?.label && (
        <span style={{
          position: "absolute", bottom: 1,
          fontSize: 6, fontWeight: 700,
          color: isActive ? "#92400e" : "#6b7280",
          lineHeight: 1, letterSpacing: 0.3,
          textTransform: "uppercase", zIndex: 2,
          maxWidth: SLOT_SIZE - 4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {slot.label}
        </span>
      )}

      {/* Remove button on hover */}
      {slot && (
        <div
          onClick={(e) => { e.stopPropagation(); onRemove(index); }}
          style={{
            position: "absolute", top: -1, right: -1, zIndex: 3,
            width: 12, height: 12, borderRadius: "50%",
            background: "#ef4444", display: "flex",
            alignItems: "center", justifyContent: "center",
            opacity: 0, transition: "opacity 100ms",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}
        >
          <X size={7} style={{ color: "#fff" }} />
        </div>
      )}
    </button>
  );
}

export default function CustomHotbar() {
  const customHotbar = useStore((s) => s.customHotbar);
  const activeCustomSlot = useStore((s) => s.activeCustomSlot);
  const setActiveCustomSlot = useStore((s) => s.setActiveCustomSlot);
  const setCustomHotbarSlot = useStore((s) => s.setCustomHotbarSlot);
  const libraryDragPayload = useStore((s) => s.libraryDragPayload);
  const setLibraryDragPayload = useStore((s) => s.setLibraryDragPayload);
  const selection = useStore((s) => s.selection);

  const hasSelection = selection.length > 0;
  const hasAnySlot = customHotbar.some((s) => s !== null);

  const handleSelect = useCallback((index: number) => {
    setActiveCustomSlot(activeCustomSlot === index ? null : index);
  }, [activeCustomSlot, setActiveCustomSlot]);

  const handleRemove = useCallback((index: number) => {
    setCustomHotbarSlot(index, null);
    if (activeCustomSlot === index) setActiveCustomSlot(null);
  }, [setCustomHotbarSlot, activeCustomSlot, setActiveCustomSlot]);

  const handleDrop = useCallback((index: number) => {
    if (!libraryDragPayload) return;
    if (libraryDragPayload.type === 'block' || libraryDragPayload.type === 'hotbarSlot') {
      const faces = libraryDragPayload.type === 'block'
        ? libraryDragPayload.faces
        : libraryDragPayload.slot.faces;
      const label = libraryDragPayload.type === 'block'
        ? libraryDragPayload.label
        : libraryDragPayload.slot.label;
      if (!faces) return;
      const digit = index === 9 ? 0 : index + 1;
      const slot: HotbarSlot = {
        key: digit,
        category: 'prefab',
        label,
        color: '#f59e0b',
        icon: '',
        faces,
      };
      setCustomHotbarSlot(index, slot);
      setLibraryDragPayload(null);
    }
  }, [libraryDragPayload, setCustomHotbarSlot, setLibraryDragPayload]);

  // Keyboard: Shift+1-9,0
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const digitMatch = e.code.match(/^Digit(\d)$/);
      if (!digitMatch) return;

      const digit = parseInt(digitMatch[1]);
      const idx = digit === 0 ? 9 : digit - 1;

      if (idx >= 0 && idx < 10 && customHotbar[idx]) {
        e.preventDefault();
        e.stopPropagation();
        setActiveCustomSlot(activeCustomSlot === idx ? null : idx);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [customHotbar, activeCustomSlot, setActiveCustomSlot]);

  if (!hasAnySlot) return null;

  return (
    <div style={{
      position: "absolute", bottom: 52, left: "50%",
      transform: hasSelection ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(10px)",
      zIndex: 24, display: "flex", alignItems: "center", gap: 3,
      padding: "5px 8px", borderRadius: 8,
      background: "rgba(255, 255, 255, 0.92)",
      border: "1px solid #e5e7eb",
      boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
      backdropFilter: "blur(8px)",
      pointerEvents: hasSelection ? "auto" : "none",
      opacity: hasSelection ? 1 : 0,
      transition: "opacity 150ms ease, transform 150ms ease",
    }}>
      <span style={{
        fontSize: 8, fontWeight: 700, color: "#9ca3af",
        textTransform: "uppercase", letterSpacing: "0.06em",
        writingMode: "vertical-lr", transform: "rotate(180deg)",
        marginRight: 2,
      }}>
        Custom
      </span>
      {customHotbar.map((slot, i) => (
        <CustomSlot
          key={i}
          slot={slot}
          index={i}
          isActive={activeCustomSlot === i}
          onSelect={handleSelect}
          onRemove={handleRemove}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
