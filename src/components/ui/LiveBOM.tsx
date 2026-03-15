"use client";

import { useStore } from "@/store/useStore";

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function LiveBOM() {
  const containerCount = useStore((s) => Object.keys(s.containers).length);
  const getEstimate = useStore((s) => s.getEstimate);

  if (containerCount === 0) return null;

  const est = getEstimate();

  return (
    <div
      className="absolute top-3 right-3 z-30 rounded-xl px-4 py-3 pointer-events-none"
      style={{
        background: "rgba(255, 255, 255, 0.78)",
        backdropFilter: "blur(16px) saturate(1.6)",
        WebkitBackdropFilter: "blur(16px) saturate(1.6)",
        border: "1px solid rgba(255, 255, 255, 0.4)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
      }}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: "#78909c" }}>
        Live BOM
      </div>
      <div className="flex items-baseline gap-3">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase" style={{ color: "#90a4ae" }}>Steel</span>
          <span className="text-xs font-semibold" style={{ color: "#263238" }}>{fmt(est.breakdown.containers)}</span>
        </div>
        <div className="w-px h-6" style={{ background: "rgba(0,0,0,0.08)" }} />
        <div className="flex flex-col">
          <span className="text-[9px] uppercase" style={{ color: "#90a4ae" }}>Glass</span>
          <span className="text-xs font-semibold" style={{ color: "#263238" }}>{fmt(est.breakdown.modules)}</span>
        </div>
        <div className="w-px h-6" style={{ background: "rgba(0,0,0,0.08)" }} />
        <div className="flex flex-col">
          <span className="text-[9px] uppercase" style={{ color: "#90a4ae" }}>Cuts</span>
          <span className="text-xs font-semibold" style={{ color: "#263238" }}>{fmt(est.breakdown.cuts)}</span>
        </div>
        <div className="w-px h-6" style={{ background: "rgba(0,0,0,0.08)" }} />
        <div className="flex flex-col rounded-md px-2 py-0.5" style={{ background: "rgba(21,101,192,0.08)" }}>
          <span className="text-[9px] uppercase font-bold" style={{ color: "#1565c0" }}>Total</span>
          <span className="text-sm font-bold" style={{ color: "#1565c0" }}>{fmt(est.breakdown.total)}</span>
        </div>
      </div>
    </div>
  );
}
