"use client";

/**
 * WarningPanel.tsx — Collapsible warning list in sidebar
 *
 * Displays validation warnings grouped by category. Hover bridges to 3D overlay,
 * click selects the associated container.
 */

import { useState } from "react";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";
import type { DesignWarning, WarningCategory } from "@/types/validation";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

const CATEGORY_ORDER: WarningCategory[] = ['safety', 'accessibility', 'weather', 'structural', 'budget'];
const CATEGORY_LABELS: Record<WarningCategory, string> = {
  safety: 'Safety', accessibility: 'Accessibility', weather: 'Weather',
  structural: 'Structural', budget: 'Budget',
};

const SEVERITY_COLORS: Record<string, string> = {
  error: '#ef4444', warning: '#f59e0b', info: '#3b82f6',
};

function WarningIcon({ severity }: { severity: string }) {
  const color = SEVERITY_COLORS[severity] ?? '#6b7280';
  if (severity === 'error') return <ShieldAlert size={14} color={color} />;
  if (severity === 'warning') return <AlertTriangle size={14} color={color} />;
  return <Info size={14} color={color} />;
}

export default function WarningPanel() {
  const warnings = useStore(useShallow((s) => s.warnings));
  const setHoveredWarning = useStore((s) => s.setHoveredWarning);
  const setSelectedVoxel = useStore((s) => s.setSelectedVoxel);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (warnings.length === 0) return null;

  const grouped = CATEGORY_ORDER.reduce<Record<string, DesignWarning[]>>((acc, cat) => {
    const items = warnings.filter(w => w.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div style={{
      borderTop: "1px solid #334155", padding: "8px 0",
    }}>
      <div style={{
        padding: "4px 14px", fontSize: 11, fontWeight: 700,
        color: "#f59e0b", display: "flex", alignItems: "center", gap: 6,
      }}>
        <AlertTriangle size={14} />
        {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <div
            onClick={() => setCollapsed(c => ({ ...c, [cat]: !c[cat] }))}
            style={{
              padding: "4px 14px", fontSize: 10, fontWeight: 600,
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
              onClick={() => {
                const idx = w.voxelIndices[0] ?? 0;
                setSelectedVoxel({ containerId: w.containerId, index: idx });
              }}
              style={{
                padding: "4px 14px 4px 24px", fontSize: 11, color: "#cbd5e1",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                transition: "background 100ms",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#1e293b")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <WarningIcon severity={w.severity} />
              {w.message}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
