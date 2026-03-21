"use client";

import { useState, useRef, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";
import type { DesignWarning, WarningCategory, WarningSeverity } from "@/types/validation";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { SEVERITY_COLORS } from "@/config/severityColors";

const CATEGORY_ORDER: WarningCategory[] = ['safety', 'accessibility', 'weather', 'structural', 'budget'];
const CATEGORY_LABELS: Record<WarningCategory, string> = {
  safety: 'Safety', accessibility: 'Accessibility', weather: 'Weather',
  structural: 'Structural', budget: 'Budget',
};

function WarningIcon({ severity }: { severity: WarningSeverity }) {
  const color = SEVERITY_COLORS[severity];
  if (severity === 'error') return <ShieldAlert size={14} color={color} />;
  if (severity === 'warning') return <AlertTriangle size={14} color={color} />;
  return <Info size={14} color={color} />;
}

export default function WarningPopover({ onClose }: { onClose: () => void }) {
  const warnings = useStore(useShallow((s) => s.warnings));
  const setHoveredWarning = useStore((s) => s.setHoveredWarning);
  const setSelectedVoxel = useStore((s) => s.setSelectedVoxel);
  const setSelectedFace = useStore((s) => s.setSelectedFace);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const grouped = CATEGORY_ORDER.reduce<Record<string, DesignWarning[]>>((acc, cat) => {
    const items = warnings.filter(w => w.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  function handleWarningClick(w: DesignWarning) {
    const idx = w.voxelIndices[0] ?? 0;
    setSelectedVoxel({ containerId: w.containerId, index: idx });

    // Guide hotbar to solution based on warning type
    if (w.message.includes('all walls are solid') || w.message.includes('No exit')) {
      const voxel = useStore.getState().containers[w.containerId]?.voxelGrid?.[idx];
      const solidWall = (['n','s','e','w'] as const).find(f => voxel?.faces[f] === 'Solid_Steel');
      if (solidWall) setSelectedFace(solidWall);
    } else if (w.message.includes('without structural support') || w.message.includes('Stair to nowhere')) {
      setSelectedFace(null);
    } else if (w.message.includes('Unprotected edge') || w.message.includes('weather')) {
      const voxel = useStore.getState().containers[w.containerId]?.voxelGrid?.[idx];
      const openWall = (['n','s','e','w'] as const).find(f => voxel?.faces[f] === 'Open');
      if (openWall) setSelectedFace(openWall);
    } else {
      setSelectedFace(null);
    }

    onClose();
  }

  return (
    <div ref={ref} style={{
      position: "absolute", top: "100%", right: 0, marginTop: 8,
      width: 320, maxHeight: 400, overflowY: "auto",
      background: "#0f172a", border: "1px solid #334155",
      borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      zIndex: 100,
    }}>
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <div
            onClick={() => setCollapsed(c => ({ ...c, [cat]: !c[cat] }))}
            style={{
              padding: "6px 14px", fontSize: 10, fontWeight: 600,
              color: "#94a3b8", cursor: "pointer", textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {CATEGORY_LABELS[cat as WarningCategory]} ({items.length})
          </div>
          {!collapsed[cat] && items.map(w => (
            <div
              key={w.id}
              onMouseEnter={() => setHoveredWarning(w.id)}
              onMouseLeave={() => setHoveredWarning(null)}
              onClick={() => handleWarningClick(w)}
              style={{
                padding: "6px 14px 6px 24px", fontSize: 11, color: "#cbd5e1",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                transition: "background 100ms",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#1e293b")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <WarningIcon severity={w.severity} />
              <span style={{ flex: 1 }}>{w.message}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
