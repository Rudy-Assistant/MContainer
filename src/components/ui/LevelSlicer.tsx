"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";

/**
 * LevelSlicer — Compact floating level selector.
 *
 * Shows current level as a single pill. Click to expand dropdown with all levels.
 * PgUp/PgDn keyboard shortcuts still work (handled by useAppHotkeys).
 */

export default function LevelSlicer() {
  // Only re-render when container levels change, not on paint/drag/etc.
  const containerLevels = useStore(useShallow((s) => Object.values(s.containers).map((c) => c.level)));
  const viewLevel = useStore((s) => s.viewLevel);
  const setViewLevel = useStore((s) => s.setViewLevel);
  const [expanded, setExpanded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    // Delay to avoid catching the triggering click
    const id = setTimeout(() => document.addEventListener("pointerdown", handlePointerDown), 50);
    return () => { clearTimeout(id); document.removeEventListener("pointerdown", handlePointerDown); };
  }, [expanded]);

  // Derive level extents from the shallow-compared level array
  const { maxLevel, minLevel, occupiedLevels } = useMemo(() => {
    let max = 0, min = 0;
    const occupied = new Set<number>();
    for (const lvl of containerLevels) {
      if (lvl > max) max = lvl;
      if (lvl < min) min = lvl;
      occupied.add(lvl);
    }
    return { maxLevel: max, minLevel: min, occupiedLevels: occupied };
  }, [containerLevels]);

  const topLevel = Math.max(maxLevel, 1);

  // Build level options
  const levels: { label: string; short: string; value: number | null }[] = [
    { label: "All Levels", short: "All", value: null },
  ];
  for (let i = topLevel; i >= -1; i--) {
    const label = i < 0 ? `Basement ${Math.abs(i)}` : `Level ${i + 1}`;
    const short = i < 0 ? `B${Math.abs(i)}` : `L${i + 1}`;
    levels.push({ label, short, value: i });
  }

  const activeLabel = viewLevel === null
    ? "All"
    : viewLevel < 0
      ? `B${Math.abs(viewLevel)}`
      : `L${viewLevel + 1}`;

  return (
    <div
      ref={wrapperRef}
      className="absolute right-3 top-1/2 -translate-y-1/2 z-50"
      style={{ pointerEvents: "auto" }}
    >
      {/* Compact pill — shows current level */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
        style={{
          background: "var(--panel-bg)",
          backdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          boxShadow: "0 2px 8px var(--border)",
          color: "var(--text-main)",
          minWidth: 44,
          justifyContent: "center",
        }}
        title={`Level: ${activeLabel} — Click to change`}
      >
        {activeLabel}
        <span style={{ fontSize: 8, opacity: 0.5, marginLeft: 2 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded dropdown */}
      {expanded && (
        <div
          className="absolute right-0 mt-1 rounded-lg overflow-hidden"
          style={{
            background: "var(--modal-bg, #fff)",
            backdropFilter: "blur(16px)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            minWidth: 120,
          }}
        >
          {levels.map((lvl) => {
            const isActive = viewLevel === lvl.value;
            const hasContainer = lvl.value !== null && occupiedLevels.has(lvl.value);

            return (
              <button
                key={lvl.short}
                onClick={() => {
                  setViewLevel(lvl.value);
                  setExpanded(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-all${isActive ? '' : ' hover-row-subtle'}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  ...(isActive ? { background: "#2563eb" } : {}),
                  color: isActive ? "#fff" : hasContainer ? "var(--text-main)" : "#94a3b8",
                  fontWeight: isActive ? 700 : 500,
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                <span>{lvl.label}</span>
                {hasContainer && !isActive && (
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#2563eb", opacity: 0.5 }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
