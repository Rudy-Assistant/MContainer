"use client";

/**
 * BlueprintLevelChips — always-visible level navigator pill strip.
 *
 * Originally rendered as a fixed top-center overlay only in Blueprint mode,
 * alongside the older right-side LevelSlicer dropdown. The two selectors
 * occupied different positions and confused users; per Bruce 2026-05-06
 * round-3 audit ("the Level is selectable twice (once on top, once on the
 * side)") the chip strip was consolidated into a single topbar element and
 * the right-side LevelSlicer was removed.
 *
 * Rendered inline inside TopToolbar.tsx (ZONE B) so it sits in the topbar
 * row along with Undo/Redo and the view-mode tabs. No fixed positioning.
 *
 * The strip auto-hides when there are no containers and only one level
 * (typical fresh project) so the empty "All (0)" pill doesn't add noise.
 *
 * Atomic Zustand selectors only — useShallow on the parallel level/sub
 * arrays keeps the component out of the render loop on paint/drag changes.
 */

import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";

export default function BlueprintLevelChips() {
  // Atomic primitive selectors — useShallow compares array contents but
  // requires the inner values to be primitives (not freshly-allocated
  // objects). Two parallel arrays let us reconstruct (level, subterranean)
  // pairs in useMemo without violating Zustand's reference-equality contract.
  const containerLevels = useStore(
    useShallow((s) => Object.values(s.containers).map((c) => c.level)),
  );
  const containerSubFlags = useStore(
    useShallow((s) => Object.values(s.containers).map((c) => !!c.subterranean)),
  );
  const viewLevel = useStore((s) => s.viewLevel);
  const setViewLevel = useStore((s) => s.setViewLevel);

  const { minLevel, maxLevel, perLevel, hasPool, totalCount } = useMemo(() => {
    let lo = 0, hi = 0;
    const counts: Record<number, number> = {};
    let pool = false;
    let total = 0;
    for (let i = 0; i < containerLevels.length; i++) {
      total++;
      if (containerSubFlags[i]) { pool = true; continue; }
      const lvl = containerLevels[i];
      if (lvl < lo) lo = lvl;
      if (lvl > hi) hi = lvl;
      counts[lvl] = (counts[lvl] || 0) + 1;
    }
    return { minLevel: lo, maxLevel: Math.max(hi, 0), perLevel: counts, hasPool: pool, totalCount: total };
  }, [containerLevels, containerSubFlags]);

  // Build chip list: All -> topmost level -> ground -> subterranean -> Pool
  type Chip = { key: string; label: string; value: number | null; count: number; tone: "default" | "pool" | "all" };
  const chips: Chip[] = [
    { key: "all", label: "All", value: null, count: totalCount, tone: "all" },
  ];
  for (let i = maxLevel; i >= minLevel; i--) {
    chips.push({ key: `L${i}`, label: `L${i + 1}`, value: i, count: perLevel[i] || 0, tone: "default" });
  }
  if (hasPool) {
    chips.push({ key: "pool", label: "Pool", value: null, count: 1, tone: "pool" });
  }

  // Hide when there's nothing to navigate: empty project, or a single
  // level with no pool. Reappears as soon as a basement/L2/Pool exists.
  // Keeps the topbar uncluttered for the typical fresh / single-level
  // workflow without sacrificing the consolidated single-selector role.
  const hasMultipleSlices = maxLevel > minLevel || hasPool;
  if (totalCount === 0 || !hasMultipleSlices) return null;

  return (
    <div
      data-testid="bp-level-chips"
      style={{
        display: "flex",
        gap: 4,
        padding: "3px 4px",
        background: "var(--input-bg, #f3f4f6)",
        border: "1px solid var(--btn-border, #e5e7eb)",
        borderRadius: 8,
        flexShrink: 0,
        alignItems: "center",
      }}
    >
      {chips.map((chip) => {
        const isActive = chip.tone !== "pool" && chip.value === viewLevel;
        const isEmpty = chip.tone === "default" && chip.count === 0;
        const isPool = chip.tone === "pool";
        return (
          <button
            key={chip.key}
            data-testid={`bp-level-chip-${chip.key}`}
            onClick={() => { if (!isPool) setViewLevel(chip.value); }}
            disabled={isPool || isEmpty}
            title={isPool ? "Pool basin (subterranean)" : `${chip.label} - ${chip.count} container${chip.count === 1 ? "" : "s"}`}
            style={{
              padding: "4px 9px",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "system-ui",
              borderRadius: 6,
              border: "none",
              background: isActive
                ? "var(--accent, #2563eb)"
                : isPool
                  ? "rgba(2,136,209,0.10)"
                  : "transparent",
              color: isActive
                ? "#ffffff"
                : isEmpty
                  ? "var(--text-muted, #94a3b8)"
                  : isPool
                    ? "#0277bd"
                    : "var(--text-muted, #6b7280)",
              cursor: isPool || isEmpty ? "default" : "pointer",
              opacity: isEmpty ? 0.5 : 1,
              transition: "all 150ms ease",
              display: "flex",
              alignItems: "baseline",
              gap: 4,
              boxShadow: isActive ? "0 1px 3px rgba(37,99,235,0.3)" : "none",
            }}
          >
            <span>{chip.label}</span>
            {!isPool && (
              <span style={{ fontSize: 9, opacity: 0.7, fontWeight: 500 }}>
                ({chip.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
