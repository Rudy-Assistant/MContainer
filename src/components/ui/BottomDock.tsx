"use client";

/**
 * BottomDock.tsx — Floating status bar (bottom-center)
 *
 * Sprint 14: Reworked from full-width bar to floating pill.
 * Frees gizmo area (bottom-right). Gorgeous TOD slider with
 * glassmorphic track and ambient glow.
 */

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
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

// ── Sky color interpolation for TOD glow ─────────────────────

const SKY_STOPS: [number, string][] = [
  [0, "#0f0a2e"], [4, "#1a1145"], [6, "#e8845c"], [8, "#87ceeb"],
  [12, "#60b3e8"], [16, "#87ceeb"], [18, "#e8845c"], [20, "#4a2060"],
  [24, "#0f0a2e"],
];

function getSkyColor(tod: number): string {
  for (let i = 1; i < SKY_STOPS.length; i++) {
    if (tod <= SKY_STOPS[i][0]) {
      const [t0, c0] = SKY_STOPS[i - 1];
      const [t1, c1] = SKY_STOPS[i];
      const f = (tod - t0) / (t1 - t0);
      return lerpColor(c0, c1, f);
    }
  }
  return SKY_STOPS[0][1];
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseHex(a), pb = parseHex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const TIME_GRADIENT = 'linear-gradient(to right, #0f0a2e 0%, #1a1145 8%, #4a2060 16%, #e8845c 22%, #f4c96d 30%, #87ceeb 38%, #60b3e8 50%, #87ceeb 62%, #f4c96d 70%, #e8845c 78%, #4a2060 84%, #1a1145 92%, #0f0a2e 100%)';

// ── Gorgeous Time of Day Slider ───────────────────────────────

function TimeOfDaySlider() {
  const timeOfDay = useStore((s) => s.environment.timeOfDay);
  const setTimeOfDay = useStore((s) => s.setTimeOfDay);
  const pct = (timeOfDay / 24) * 100;
  const isDaytime = timeOfDay >= 5.5 && timeOfDay <= 18.5;
  const skyColor = useMemo(() => getSkyColor(timeOfDay), [timeOfDay]);

  // Glow intensity: peaks at midday, dims at night
  const glowIntensity = Math.max(0, Math.sin((timeOfDay / 24) * Math.PI));

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '6px 14px 6px 10px',
      borderRadius: '20px',
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(16px) saturate(160%)',
      WebkitBackdropFilter: 'blur(16px) saturate(160%)',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: `0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 40px ${skyColor}22`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glow behind slider */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at ${pct}% 50%, ${skyColor}44, transparent 60%)`,
        opacity: 0.4 + glowIntensity * 0.4,
        transition: 'all 300ms ease',
        pointerEvents: 'none',
      }} />

      {/* Sun/Moon icon */}
      <span style={{
        fontSize: '14px', lineHeight: 1, position: 'relative', zIndex: 1,
        filter: isDaytime ? 'drop-shadow(0 0 4px rgba(255,200,0,0.5))' : 'drop-shadow(0 0 4px rgba(150,180,255,0.4))',
        transition: 'filter 500ms ease',
      }}>
        {isDaytime ? '\u2600\uFE0F' : '\uD83C\uDF19'}
      </span>

      {/* Track */}
      <div style={{
        position: 'relative', width: '150px', height: '10px',
        borderRadius: '5px', zIndex: 1,
      }}>
        {/* Track background — gradient */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '5px',
          background: TIME_GRADIENT,
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3), inset 0 -1px 1px rgba(255,255,255,0.05)',
        }} />

        {/* Filled portion — glowing accent */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct}%`, borderRadius: '5px',
          background: 'rgba(255,255,255,0.12)',
          boxShadow: `0 0 8px ${skyColor}66`,
          transition: 'box-shadow 300ms ease',
        }} />

        {/* Thumb — glowing orb */}
        <div style={{
          position: 'absolute', top: '50%',
          left: `${pct}%`,
          transform: 'translate(-50%, -50%)',
          width: '16px', height: '16px', borderRadius: '50%',
          background: isDaytime
            ? 'radial-gradient(circle at 35% 35%, #fff, rgba(255,240,200,0.9) 40%, rgba(255,180,60,0.8))'
            : 'radial-gradient(circle at 35% 35%, #e8eeff, rgba(180,200,255,0.9) 40%, rgba(100,130,200,0.8))',
          border: '1px solid rgba(255,255,255,0.7)',
          boxShadow: isDaytime
            ? '0 0 12px rgba(255,180,0,0.5), 0 0 24px rgba(255,200,60,0.2), 0 2px 6px rgba(0,0,0,0.3)'
            : '0 0 12px rgba(100,150,255,0.4), 0 0 24px rgba(130,160,255,0.15), 0 2px 6px rgba(0,0,0,0.3)',
          transition: 'background 500ms ease, box-shadow 500ms ease',
          zIndex: 2,
        }} />

        {/* Hidden range input for accessibility */}
        <input type="range" min={0} max={24} step={0.25} value={timeOfDay}
          data-testid="tod-slider"
          onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', zIndex: 3, margin: 0,
          }}
        />
      </div>

      {/* Time label */}
      <span style={{
        fontSize: '12px', fontFamily: '"SF Mono", "Cascadia Code", monospace',
        fontWeight: 700, minWidth: '42px', textAlign: 'right',
        color: isDaytime ? 'rgba(255,240,200,0.95)' : 'rgba(180,200,255,0.9)',
        textShadow: isDaytime ? '0 0 8px rgba(255,180,0,0.3)' : '0 0 8px rgba(100,150,255,0.2)',
        transition: 'color 500ms ease',
        position: 'relative', zIndex: 1,
        letterSpacing: '0.02em',
      }}>
        {formatTime(timeOfDay)}
      </span>
    </div>
  );
}

// ── Draggable Compass Rose ───────────────────────────────────

/** Compass direction label from degrees */
function getCompassDir(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((deg % 360 + 360) % 360) / 45) % 8];
}

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
      viewBox="0 0 120 120"
      width={120}
      height={120}
      className="cursor-pointer select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Outer ring */}
      <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="2" />
      <circle cx="60" cy="60" r="50" fill="none" stroke="#cbd5e1" strokeWidth="0.5" />

      {/* Degree tick marks */}
      {Array.from({ length: 36 }).map((_, i) => {
        const angle = i * 10;
        const rad = (angle * Math.PI) / 180;
        const isMajor = angle % 90 === 0;
        const isMinor = angle % 30 === 0;
        const r1 = isMajor ? 44 : isMinor ? 46 : 48;
        const r2 = 50;
        return (
          <line key={i}
            x1={60 + Math.sin(rad) * r1} y1={60 - Math.cos(rad) * r1}
            x2={60 + Math.sin(rad) * r2} y2={60 - Math.cos(rad) * r2}
            stroke={isMajor ? "#64748b" : "#cbd5e1"}
            strokeWidth={isMajor ? 1.5 : 0.5}
          />
        );
      })}

      {/* Cardinal + intercardinal labels */}
      {[
        { angle: 0, label: "N", color: "#dc2626", bold: true },
        { angle: 45, label: "NE", color: "#94a3b8", bold: false },
        { angle: 90, label: "E", color: "#475569", bold: true },
        { angle: 135, label: "SE", color: "#94a3b8", bold: false },
        { angle: 180, label: "S", color: "#475569", bold: true },
        { angle: 225, label: "SW", color: "#94a3b8", bold: false },
        { angle: 270, label: "W", color: "#475569", bold: true },
        { angle: 315, label: "NW", color: "#94a3b8", bold: false },
      ].map(({ angle, label, color, bold }) => {
        const rad = ((angle + rot) * Math.PI) / 180;
        const r = bold ? 36 : 38;
        const x = 60 + Math.sin(rad) * r;
        const y = 60 - Math.cos(rad) * r;
        return (
          <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="central"
            fill={color} fontSize={bold ? 11 : 8} fontWeight={bold ? 800 : 500}
            fontFamily="system-ui" letterSpacing="0.03em">
            {label}
          </text>
        );
      })}

      {/* Needle */}
      <g transform={`rotate(${rot}, 60, 60)`}>
        <polygon points="60,16 56.5,60 63.5,60" fill="#dc2626" opacity="0.85" />
        <polygon points="60,104 56.5,60 63.5,60" fill="#64748b" opacity="0.4" />
      </g>

      {/* Center hub */}
      <circle cx="60" cy="60" r="5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
      <circle cx="60" cy="60" r="2" fill="#475569" />
    </svg>
  );
}

type DockPanel = "compass" | "pricing" | "project" | null;

interface BottomDockProps {
  onOpenBudget: () => void;
}

// ── Main Component — Floating Pill ──────────────────────────

export default function BottomDock({ onOpenBudget }: BottomDockProps) {
  const [activePanel, setActivePanel] = useState<DockPanel>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activePanel) return;
    const handler = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setActivePanel(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activePanel]);

  const northOffset = useStore((s) => s.environment.northOffset);
  const setNorthOffset = useStore((s) => s.setNorthOffset);
  const getEstimate = useStore((s) => s.getEstimate);
  const containerCount = useStore((s) => Object.keys(s.containers).length);

  const toggle = (panel: DockPanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const estimate = containerCount > 0 ? getEstimate() : null;

  const pillBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '5px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
    fontSize: '11px', fontFamily: 'monospace',
    color: active ? '#93c5fd' : 'rgba(255,255,255,0.6)',
    background: active ? 'rgba(147,197,253,0.12)' : 'transparent',
    transition: 'all 150ms ease',
  });

  return (
    <div ref={dockRef} className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center pointer-events-none"
      style={{ paddingBottom: '10px' }}
    >
      {/* ═══ Expanded Panel (floats above dock) ═══ */}
      {activePanel && (
        <div
          className="mb-2 rounded-2xl shadow-2xl pointer-events-auto"
          style={{
            background: "var(--modal-bg, rgba(255,255,255,0.95))",
            backdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid var(--border)",
            color: "var(--text-main)",
            padding: '20px 24px',
            minWidth: '320px',
            maxWidth: '440px',
          }}
        >
          {activePanel === "compass" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              {/* Degree + direction display */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-main, #111827)', lineHeight: 1 }}>
                  {Math.round(northOffset)}°
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 2 }}>
                  {getCompassDir(northOffset)} — North Direction
                </div>
              </div>
              {/* Compass rose */}
              <CompassRose northOffset={northOffset} onDrag={setNorthOffset} />
              {/* Styled slider */}
              <input type="range" min={0} max={360} step={1} value={northOffset}
                onChange={(e) => setNorthOffset(parseFloat(e.target.value))}
                style={{
                  width: '100%', height: 6, borderRadius: 3, appearance: 'none',
                  background: `linear-gradient(to right, #dc2626, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #dc2626)`,
                  cursor: 'pointer',
                }} />
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

      {/* ═══ Floating Pill ═══ */}
      <div
        className="pointer-events-auto"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 6px',
          borderRadius: '20px',
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Container count + cost — clickable opens budget modal */}
        <button
          onClick={onOpenBudget}
          style={{
            ...pillBtn(false),
            padding: '4px 12px', gap: '6px',
          }}
          title="Click for cost breakdown"
        >
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
            {containerCount} container{containerCount !== 1 ? 's' : ''}
          </span>
          {estimate && (
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', fontFamily: 'monospace', letterSpacing: '-0.02em' }}>
              {formatCurrency(estimate.breakdown.total)}
            </span>
          )}
        </button>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)' }} />

        {/* Time of Day Slider */}
        <TimeOfDaySlider />

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)' }} />

        {/* Compass */}
        <button
          onClick={() => toggle("compass")}
          style={pillBtn(activePanel === "compass")}
          title="North Direction"
        >
          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}
            style={{ transform: `rotate(${-northOffset}deg)`, transition: 'transform 200ms ease' }}>
            <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill="currentColor" />
          </svg>
          {Math.round(northOffset)}°
        </button>

        {/* Project */}
        <button
          onClick={() => toggle("project")}
          style={pillBtn(activePanel === "project")}
          title="Export / Import"
        >
          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
