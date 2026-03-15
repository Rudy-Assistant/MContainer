"use client";

import { useStore } from "@/store/useStore";

/**
 * LevelSlicer — Floating vertical level navigation widget.
 *
 * Always visible. Shows predefined levels: L2, L1, G (ground), B1 (basement).
 * Additional levels dynamically added if containers exist above L2.
 * Active level = 100% interactive; above = 15% ghost; below = hidden.
 * "All" shows everything at full opacity.
 */

// Level accent colors
const LEVEL_ACCENTS: Record<string, { bg: string; border: string; text: string }> = {
  B1:      { bg: "#78350f", border: "#92400e", text: "#fbbf24" },
  "Level 1": { bg: "#1565c0", border: "#1e88e5", text: "#ffffff" },
  "Level 2": { bg: "#15803d", border: "#16a34a", text: "#ffffff" },
  "Level 3": { bg: "#7e22ce", border: "#9333ea", text: "#ffffff" },
  All:     { bg: "#334155", border: "#475569", text: "#ffffff" },
};

export default function LevelSlicer() {
  const containers = useStore((s) => s.containers);
  const viewLevel = useStore((s) => s.viewLevel);
  const setViewLevel = useStore((s) => s.setViewLevel);

  // Determine extent of levels in the scene
  let maxLevel = 0;
  let minLevel = 0;
  for (const c of Object.values(containers)) {
    if (c.level > maxLevel) maxLevel = c.level;
    if (c.level < minLevel) minLevel = c.level;
  }

  // Build level buttons top-down: highest first, always include B1/G/L1/L2
  const topLevel = Math.max(maxLevel, 2);
  const levels: { label: string; value: number | null }[] = [
    { label: "All", value: null },
  ];

  for (let i = topLevel; i >= -1; i--) {
    levels.push({
      label: i < 0 ? `B${Math.abs(i)}` : `Level ${i + 1}`,
      value: i,
    });
  }

  const handleUp = () => {
    if (viewLevel === null) return;
    if (viewLevel >= topLevel) {
      setViewLevel(null);
    } else {
      setViewLevel(viewLevel + 1);
    }
  };

  const handleDown = () => {
    if (viewLevel === null) {
      setViewLevel(topLevel);
    } else if (viewLevel > -1) {
      setViewLevel(viewLevel - 1);
    }
  };

  return (
    <div
      className="absolute right-3 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1 rounded-xl px-2 py-2.5"
      style={{
        background: "rgba(255, 255, 255, 0.82)",
        backdropFilter: "blur(16px) saturate(1.6)",
        WebkitBackdropFilter: "blur(16px) saturate(1.6)",
        border: "1px solid rgba(255, 255, 255, 0.45)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <span
        className="text-[9px] font-bold uppercase tracking-[0.1em] text-center mb-0.5"
        style={{ color: "#64748b" }}
      >
        Level
      </span>

      {/* Up arrow */}
      <button
        onClick={handleUp}
        className="w-10 h-5 rounded text-[11px] font-bold transition-all hover:bg-black/[0.06] flex items-center justify-center"
        style={{ color: viewLevel === null ? "#cbd5e1" : "#475569" }}
        disabled={viewLevel === null}
        title="Show higher level (PgUp)"
      >
        ▲
      </button>

      {levels.map((lvl) => {
        const isActive = viewLevel === lvl.value;
        const accent = LEVEL_ACCENTS[lvl.label] ?? LEVEL_ACCENTS["Level 2"];
        // Check if any container exists at this level
        const hasContainer = lvl.value !== null && Object.values(containers).some((c) => c.level === lvl.value);

        return (
          <button
            key={lvl.label}
            onClick={() => setViewLevel(lvl.value)}
            className="w-10 h-7 rounded-md text-[11px] font-bold transition-all"
            style={{
              background: isActive ? accent.bg : "transparent",
              color: isActive ? accent.text : hasContainer ? "#334155" : "#94a3b8",
              border: isActive ? `1.5px solid ${accent.border}` : "1.5px solid transparent",
              boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
              opacity: hasContainer || isActive || lvl.value === null ? 1 : 0.5,
            }}
            title={
              lvl.value === null
                ? "Show all levels"
                : `Focus level ${lvl.label} — active containers ${isActive ? "fully interactive" : "will be focused"}`
            }
          >
            {lvl.label}
          </button>
        );
      })}

      {/* Down arrow */}
      <button
        onClick={handleDown}
        className="w-10 h-5 rounded text-[11px] font-bold transition-all hover:bg-black/[0.06] flex items-center justify-center"
        style={{ color: viewLevel === -1 ? "#cbd5e1" : "#475569" }}
        disabled={viewLevel === -1}
        title="Show lower level (PgDn)"
      >
        ▼
      </button>

      <span
        className="text-[8px] text-center mt-0.5"
        style={{ color: "#94a3b8" }}
      >
        PgUp/Dn
      </span>
    </div>
  );
}
