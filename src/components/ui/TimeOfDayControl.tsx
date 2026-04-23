"use client";

import { useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { useStore } from "@/store/useStore";

interface TimeOfDayControlProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onOpen: () => void;
}

function formatTime(h: number) {
  const hr = Math.floor(h);
  const mn = Math.floor((h - hr) * 60);
  return `${hr.toString().padStart(2, "0")}:${mn.toString().padStart(2, "0")}`;
}

export default function TimeOfDayControl({ open, setOpen, onOpen }: TimeOfDayControlProps) {
  const timeOfDay = useStore((s) => s.environment.timeOfDay);
  const setTimeOfDay = useStore((s) => s.setTimeOfDay);
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
        data-testid="btn-tod"
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.color = "#3b82f6";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.color = "var(--text-muted)";
        }}
        style={{
          display: "flex", alignItems: "center", gap: "4px",
          background: "none", border: "none", cursor: "pointer", padding: "6px 8px",
          fontSize: "13px", fontWeight: 600, fontFamily: "monospace",
          color: open ? "#3b82f6" : "var(--text-muted)",
          transition: "color 120ms",
        }}
        title="Time of Day"
      >
        <Clock size={13} />
        {formatTime(timeOfDay)}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "6px",
          background: "linear-gradient(135deg, rgba(16,24,44,0.92), rgba(30,41,59,0.95))",
          borderRadius: "16px",
          boxShadow: "0 16px 48px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08)",
          border: "none", padding: "20px 24px", minWidth: "280px", zIndex: 50,
          color: "#f4f8ff", backdropFilter: "blur(20px) saturate(140%)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(220,229,255,0.7)", textTransform: "uppercase", letterSpacing: "0.14em" }}>Time of Day</span>
            <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", letterSpacing: "-0.04em", textShadow: "0 0 18px rgba(140,208,255,0.18)" }}>
              {formatTime(timeOfDay)}
            </span>
          </div>
          <div style={{ position: "relative", padding: "10px 0 6px" }}>
            <div style={{
              position: "absolute", left: 0, right: 0, top: "50%", height: 32, transform: "translateY(-50%)",
              borderRadius: 999, filter: "blur(10px)", pointerEvents: "none",
              background: `radial-gradient(circle at ${(timeOfDay / 24) * 100}% 50%, rgba(123,211,255,0.25), rgba(139,92,246,0.15) 30%, transparent 60%)`,
            }} />
            <div style={{
              position: "absolute", left: 0, right: 0, top: "50%", height: 10, transform: "translateY(-50%)",
              borderRadius: 999, background: "rgba(10,16,34,0.6)", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12), inset 0 -1px 2px rgba(0,0,0,0.3)",
            }} />
            <div style={{
              position: "absolute", left: 0, top: "50%", width: `${(timeOfDay / 24) * 100}%`, height: 10, transform: "translateY(-50%)",
              borderRadius: 999, pointerEvents: "none",
              background: "linear-gradient(90deg, #6ee7ff, #8b5cf6, #ff7cc8, #ffd166)",
              boxShadow: "0 0 8px rgba(110,231,255,0.35), 0 0 20px rgba(139,92,246,0.2)",
            }} />
            <input
              type="range"
              min={0}
              max={24}
              step={0.25}
              value={timeOfDay}
              data-testid="tod-slider"
              onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
              style={{
                width: "100%", height: 30, appearance: "none", background: "transparent",
                cursor: "pointer", position: "relative", zIndex: 2, margin: 0,
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(233,239,255,0.5)", marginTop: 6, fontFamily: "monospace" }}>
            <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
          </div>
        </div>
      )}
    </div>
  );
}
