"use client";

import { useState, useRef, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";
import { AlertTriangle } from "lucide-react";
import WarningPopover from "./WarningPopover";

export default function WarningBadge() {
  const warnings = useStore(useShallow((s) => s.warnings));
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (warnings.length === 0) return null;

  const maxSeverity = warnings.some(w => w.severity === 'error') ? 'error'
    : warnings.some(w => w.severity === 'warning') ? 'warning' : 'info';
  const badgeColor = maxSeverity === 'error' ? '#ef4444'
    : maxSeverity === 'warning' ? '#f59e0b' : '#3b82f6';

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "4px 8px", borderRadius: 6, border: "none",
          background: open ? "#1e293b" : "transparent",
          color: badgeColor, cursor: "pointer", fontSize: 11, fontWeight: 700,
        }}
        title="Design warnings"
      >
        <AlertTriangle size={14} />
        {warnings.length}
      </button>
      {open && <WarningPopover onClose={() => setOpen(false)} />}
    </div>
  );
}
