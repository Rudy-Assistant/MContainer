"use client";

import { useState, useRef, useCallback } from "react";
import { useStore } from "@/store/useStore";
import ExportImport from "./ExportImport";
import LiveBOM from "./LiveBOM";

function formatTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

const TIME_GRADIENT = 'linear-gradient(to right, #0f0a2e 0%, #1a1145 8%, #4a2060 16%, #e8845c 22%, #f4c96d 30%, #87ceeb 38%, #60b3e8 50%, #87ceeb 62%, #f4c96d 70%, #e8845c 78%, #4a2060 84%, #1a1145 92%, #0f0a2e 100%)';

type DockPanel = "compass" | "pricing" | "project" | null;

interface BottomDockProps {
  onOpenBudget: () => void;
}

// ── Draggable Compass Rose ───────────────────────────────────

function CompassRose({ northOffset, onDrag }: { northOffset: number; onDrag: (deg: number) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const getAngle = useCallback((e: { clientX: number; clientY: number }) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return Math.round(deg);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    onDrag(getAngle(e));
  }, [getAngle, onDrag]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    onDrag(getAngle(e));
  }, [getAngle, onDrag]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const rot = -northOffset;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      width={80}
      height={80}
      className="cursor-pointer select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <circle cx="50" cy="50" r="46" fill="none" stroke="#475569" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#334155" strokeWidth="0.5" />
      {[
        { angle: 0, label: "N", color: "#ef4444" },
        { angle: 90, label: "E", color: "#94a3b8" },
        { angle: 180, label: "S", color: "#94a3b8" },
        { angle: 270, label: "W", color: "#94a3b8" },
      ].map(({ angle, label, color }) => {
        const rad = ((angle + rot) * Math.PI) / 180;
        const tx = 50 + Math.sin(rad) * 38;
        const ty = 50 - Math.cos(rad) * 38;
        const lx = 50 + Math.sin(rad) * 28;
        const ly = 50 - Math.cos(rad) * 28;
        return (
          <g key={label}>
            <circle cx={tx} cy={ty} r={2} fill={color} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
              fill={color} fontSize="10" fontWeight="700" fontFamily="system-ui">
              {label}
            </text>
          </g>
        );
      })}
      <g transform={`rotate(${rot}, 50, 50)`}>
        <polygon points="50,14 46,50 54,50" fill="#ef4444" opacity="0.8" />
        <polygon points="50,86 46,50 54,50" fill="#475569" opacity="0.5" />
      </g>
      <circle cx="50" cy="50" r="3" fill="#64748b" />
    </svg>
  );
}

// ── Main Component — Two-Row Layout ───────────────────────────

export default function BottomDock({ onOpenBudget }: BottomDockProps) {
  const [activePanel, setActivePanel] = useState<DockPanel>(null);

  const timeOfDay = useStore((s) => s.environment.timeOfDay);
  const northOffset = useStore((s) => s.environment.northOffset);
  const setTimeOfDay = useStore((s) => s.setTimeOfDay);
  const setNorthOffset = useStore((s) => s.setNorthOffset);
  const getEstimate = useStore((s) => s.getEstimate);
  const containerCount = useStore((s) => Object.keys(s.containers).length);

  const toggle = (panel: DockPanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const estimate = containerCount > 0 ? getEstimate() : null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col pointer-events-none">
      {/* ═══ Expanded Panel (floats above dock) ═══ */}
      {activePanel && (
        <div
          className="self-center mb-2 rounded-2xl shadow-2xl pointer-events-auto"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(0,0,0,0.08)",
            padding: '20px 24px',
            minWidth: '320px',
            maxWidth: '440px',
          }}
        >
          {activePanel === "compass" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>North Direction</span>
                <span style={{ fontSize: '13px', fontFamily: 'monospace', color: '#1565c0' }}>{Math.round(northOffset)}°</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <CompassRose northOffset={northOffset} onDrag={setNorthOffset} />
              </div>
              <input type="range" min={0} max={360} step={1} value={northOffset}
                onChange={(e) => setNorthOffset(parseFloat(e.target.value))} className="w-full" />
            </div>
          )}

          {activePanel === "pricing" && estimate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <LiveBOM />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cost Estimate</span>
                <button onClick={onOpenBudget} style={{ fontSize: '10px', color: '#1565c0', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Edit Rates</button>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                {formatCurrency(estimate.low)} <span style={{ color: '#9ca3af', fontSize: '14px' }}>—</span> {formatCurrency(estimate.high)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '12px', fontSize: '12px' }}>
                <div><span style={{ color: '#6b7280', display: 'block' }}>Containers</span><span style={{ color: '#374151', fontWeight: 500 }}>{formatCurrency(estimate.breakdown.containers)}</span></div>
                <div><span style={{ color: '#6b7280', display: 'block' }}>Modules</span><span style={{ color: '#374151', fontWeight: 500 }}>{formatCurrency(estimate.breakdown.modules)}</span></div>
                <div><span style={{ color: '#6b7280', display: 'block' }}>Cuts</span><span style={{ color: '#374151', fontWeight: 500 }}>{formatCurrency(estimate.breakdown.cuts)}</span></div>
              </div>
            </div>
          )}
          {activePanel === "pricing" && !estimate && (
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Add containers to see pricing.</p>
          )}

          {activePanel === "project" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Project</span>
              <ExportImport />
            </div>
          )}
        </div>
      )}

      {/* ═══ Status Bar (Right-Aligned Controls) ═══ */}
      <div
        className="pointer-events-auto"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '6px',
          padding: '6px 16px',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(16px) saturate(180%)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {/* Left side: container count */}
        <span style={{ fontSize: '11px', color: '#6b7280', marginRight: 'auto', fontFamily: 'monospace' }}>
          {containerCount} container{containerCount !== 1 ? 's' : ''}
          {estimate ? ` · ${formatCurrency(estimate.breakdown.total)}` : ''}
        </span>

        {/* Persistent TOD pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(0,0,0,0.04)', borderRadius: '20px',
          padding: '4px 12px 4px 8px', height: '32px',
        }}>
          <span style={{ fontSize: '13px', lineHeight: 1 }}>{timeOfDay >= 6 && timeOfDay <= 18 ? '\u2600\uFE0F' : '\uD83C\uDF19'}</span>
          <div style={{ position: 'relative', width: '120px', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: TIME_GRADIENT, borderRadius: '4px' }} />
            <div style={{
              position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
              left: `${(timeOfDay / 24) * 100}%`,
              width: '14px', height: '14px', borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              zIndex: 2,
            }} />
            <input type="range" min={0} max={24} step={0.25} value={timeOfDay}
              onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 3, margin: 0 }}
            />
          </div>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#374151', fontWeight: 600, minWidth: '38px' }}>
            {formatTime(timeOfDay)}
          </span>
        </div>

        {/* Compass */}
        <button
          onClick={() => toggle("compass")}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontSize: '11px', fontFamily: 'monospace',
            color: activePanel === "compass" ? '#1565c0' : '#6b7280',
            background: activePanel === "compass" ? 'rgba(21,101,192,0.08)' : 'transparent',
          }}
          title="North Direction"
        >
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}
            style={{ transform: `rotate(${-northOffset}deg)`, transition: 'transform 200ms ease' }}>
            <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill="currentColor" />
          </svg>
          {Math.round(northOffset)}°
        </button>

        <div style={{ width: '1px', height: '16px', background: 'rgba(0,0,0,0.1)' }} />

        {/* Pricing */}
        <button
          onClick={() => toggle("pricing")}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontSize: '11px', fontFamily: 'monospace',
            color: activePanel === "pricing" ? '#1565c0' : '#6b7280',
            background: activePanel === "pricing" ? 'rgba(21,101,192,0.08)' : 'transparent',
          }}
          title="Cost Estimate"
        >
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
          $
        </button>

        {/* Project */}
        <button
          onClick={() => toggle("project")}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontSize: '11px',
            color: activePanel === "project" ? '#1565c0' : '#6b7280',
            background: activePanel === "project" ? 'rgba(21,101,192,0.08)' : 'transparent',
          }}
          title="Export / Import"
        >
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
