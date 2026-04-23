"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { formatUSD as fmtUSD } from "@/utils/formatters";

interface CostControlProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onOpen: () => void;
  onOpenBudget: () => void;
}

export default function CostControl({ open, setOpen, onOpen, onOpenBudget }: CostControlProps) {
  const getEstimate = useStore((s) => s.getEstimate);
  const containerCount = useStore((s) => Object.keys(s.containers).length);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, setOpen]);

  if (containerCount === 0) return null;

  const est = getEstimate();

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.color = "#16a34a";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.color = "var(--text-muted)";
        }}
        style={{
          display: "flex", alignItems: "center", gap: "3px",
          background: "none", border: "none", cursor: "pointer", padding: "6px 8px",
          fontSize: "13px", fontWeight: 700, fontFamily: "monospace",
          color: open ? "#16a34a" : "var(--text-muted)",
          transition: "color 120ms",
        }}
        title="Cost breakdown"
      >
        {fmtUSD(est.breakdown.total)}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "6px",
          background: "var(--modal-bg, #fff)", borderRadius: "14px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
          border: "none", padding: "16px 20px", minWidth: "240px", zIndex: 50,
          color: "var(--text-main)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Cost Breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Containers", val: est.breakdown.containers, color: "#64748b" },
              { label: "Glass & Windows", val: est.breakdown.modules, color: "#64748b" },
              { label: "Structural Cuts", val: est.breakdown.cuts, color: "#64748b" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12 }}>
                <span style={{ color }}>{label}</span>
                <span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 13 }}>{fmtUSD(val)}</span>
              </div>
            ))}
            <div style={{ height: 1, background: "var(--border-subtle, #e5e7eb)", margin: "4px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 14 }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 800, fontFamily: "monospace", color: "#16a34a", fontSize: 16 }}>{fmtUSD(est.breakdown.total)}</span>
            </div>
            <button
              onClick={() => {
                onOpenBudget();
                setOpen(false);
              }}
              style={{
                width: "100%", marginTop: 6, padding: "7px 10px", borderRadius: 6,
                border: "1px solid var(--border-subtle, #e5e7eb)", cursor: "pointer",
                background: "var(--input-bg, #f8fafc)", color: "var(--text-main)",
                fontSize: 12, fontWeight: 700,
              }}
            >
              Open Budget
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
