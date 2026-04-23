"use client";

import { useEffect, useRef } from "react";
import { Compass } from "lucide-react";
import { useStore } from "@/store/useStore";

interface CompassControlProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onOpen: () => void;
}

export default function CompassControl({ open, setOpen, onOpen }: CompassControlProps) {
  const northOffset = useStore((s) => s.environment.northOffset);
  const setNorthOffset = useStore((s) => s.setNorthOffset);
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

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.color = "#8b5cf6";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.color = "var(--text-muted)";
        }}
        style={{
          display: "flex", alignItems: "center", gap: "3px",
          background: "none", border: "none", cursor: "pointer", padding: "6px 8px",
          fontSize: "13px", fontWeight: 600, fontFamily: "monospace",
          color: open ? "#8b5cf6" : "var(--text-muted)",
          transition: "color 120ms",
        }}
        title="North Direction"
      >
        <Compass size={13} />
        {Math.round(northOffset)}°
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "6px",
          background: "var(--modal-bg, #fff)", borderRadius: "14px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
          border: "none", padding: "16px 20px", minWidth: "220px", zIndex: 50,
          color: "var(--text-main)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>North Direction</div>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={northOffset}
            onChange={(e) => setNorthOffset(parseFloat(e.target.value))}
            style={{
              width: "100%", height: 8, borderRadius: 4, appearance: "none", cursor: "pointer",
              background: `linear-gradient(90deg, #8b5cf6 0%, #c084fc ${(northOffset / 360) * 100}%, var(--border-subtle, #e5e7eb) ${(northOffset / 360) * 100}%)`,
            }}
          />
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: "#8b5cf6" }}>
            {Math.round(northOffset)}°
          </div>
        </div>
      )}
    </div>
  );
}
