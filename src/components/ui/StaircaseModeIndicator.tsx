"use client";

/**
 * StaircaseModeIndicator — Banner shown at canvas top-center during staircase placement mode.
 * Shows "Click a wall face to place stairs (Esc to cancel)".
 * Positioned absolute over the 3D canvas.
 */

import { useStore } from "@/store/useStore";
import { Footprints } from "lucide-react";

export default function StaircaseModeIndicator() {
  const active = useStore((s) => s.staircasePlacementMode);

  if (!active) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          borderRadius: 10,
          background: "rgba(0, 188, 212, 0.9)",
          backdropFilter: "blur(8px)",
          color: "white",
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
          whiteSpace: "nowrap",
        }}
      >
        <Footprints size={16} />
        Click a wall face to place stairs
        <span style={{ opacity: 0.7, fontWeight: 400, fontSize: 12 }}>
          (Esc to cancel)
        </span>
      </div>
    </div>
  );
}
