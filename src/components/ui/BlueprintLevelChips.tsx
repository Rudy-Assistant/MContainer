"use client";

/**
 * BlueprintLevelChips — always-visible level navigator for Blueprint Mode.
 *
 * Multi-level designs (Resort House, Glass Atrium Showcase) need a one-click
 * level switcher in plan view because top-down rendering causes stacked
 * containers to occlude each other. The pre-existing LevelSlicer pill is a
 * click-to-expand dropdown — fine for casual use but adds friction when
 * navigating four or more levels back-to-back.
 *
 * Mounted outside the R3F Canvas in page.tsx so React's normal DOM
 * reconciler handles it (R3F's reconciler interprets `<span>` and
 * other intrinsics as THREE primitives — see BlueprintRenderer.tsx history
 * for the failed inline-portal attempt).
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

  // Build chip list: All → topmost level → ground → subterranean → Pool
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

  return (
    <div
      data-testid="bp-level-chips"
      style={{
        position: "fixed",
        top: 68,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        pointerEvents: "auto",
        display: "flex",
        gap: 6,
        padding: "4px 6px",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        border: "1px solid #cfd8dc",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
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
            title={isPool ? "Pool basin (subterranean)" : `${chip.label} — ${chip.count} container${chip.count === 1 ? "" : "s"}`}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "system-ui",
              borderRadius: 6,
              border: "1.5px solid",
              borderColor: isActive ? "#1565c0" : isPool ? "#0288d1" : "#cfd8dc",
              background: isActive ? "#1565c0" : isPool ? "rgba(2,136,209,0.08)" : "#ffffff",
              color: isActive ? "#ffffff" : isEmpty ? "#b0bec5" : isPool ? "#0277bd" : "#37474f",
              cursor: isPool || isEmpty ? "default" : "pointer",
              opacity: isEmpty ? 0.5 : 1,
              transition: "all 0.15s",
              display: "flex",
              alignItems: "baseline",
              gap: 4,
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
