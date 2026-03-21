"use client";

import { useState, useCallback, useRef, useEffect } from 'react';

interface ColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
  onClose?: () => void;
}

export default function ColorPicker({ color, onChange, onClose }: ColorPickerProps) {
  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(100);
  const [val, setVal] = useState(100);
  const [hexInput, setHexInput] = useState(color);
  const satValRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingSV = useRef(false);
  const draggingH = useRef(false);

  useEffect(() => {
    setHexInput(color);
    const [h, s, v] = hexToHsv(color);
    setHue(h); setSat(s); setVal(v);
  }, [color]);

  const emitColor = useCallback((h: number, s: number, v: number) => {
    const hex = hsvToHex(h, s, v);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const handleSVPointer = useCallback((e: React.PointerEvent | PointerEvent) => {
    const rect = satValRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const newSat = Math.round(x * 100);
    const newVal = Math.round((1 - y) * 100);
    setSat(newSat); setVal(newVal);
    emitColor(hue, newSat, newVal);
  }, [hue, emitColor]);

  const handleHuePointer = useCallback((e: React.PointerEvent | PointerEvent) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newHue = Math.round(x * 360);
    setHue(newHue);
    emitColor(newHue, sat, val);
  }, [sat, val, emitColor]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (draggingSV.current) handleSVPointer(e);
      if (draggingH.current) handleHuePointer(e);
    };
    const onUp = () => { draggingSV.current = false; draggingH.current = false; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [handleSVPointer, handleHuePointer]);

  const handleHexSubmit = () => {
    const clean = hexInput.startsWith('#') ? hexInput : '#' + hexInput;
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      onChange(clean);
      const [h, s, v] = hexToHsv(clean);
      setHue(h); setSat(s); setVal(v);
    }
  };

  return (
    <div style={{
      padding: '8px', background: 'var(--card-bg, #f1f5f9)',
      borderRadius: 8, border: '1px solid var(--border, #e2e8f0)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div
        ref={satValRef}
        onPointerDown={(e) => { draggingSV.current = true; handleSVPointer(e); }}
        style={{
          width: '100%', aspectRatio: '1', borderRadius: 4, cursor: 'crosshair',
          position: 'relative', overflow: 'hidden',
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`,
        }}
      >
        <div style={{
          position: 'absolute',
          left: `${sat}%`, top: `${100 - val}%`,
          width: 12, height: 12, borderRadius: '50%',
          border: '2px solid white', boxShadow: '0 0 2px rgba(0,0,0,0.5)',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        }} />
      </div>
      <div
        ref={hueRef}
        onPointerDown={(e) => { draggingH.current = true; handleHuePointer(e); }}
        style={{
          width: '100%', height: 14, borderRadius: 3, cursor: 'pointer',
          position: 'relative',
          background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        }}
      >
        <div style={{
          position: 'absolute',
          left: `${(hue / 360) * 100}%`, top: '50%',
          width: 10, height: 14, borderRadius: 2,
          border: '2px solid white', boxShadow: '0 0 2px rgba(0,0,0,0.5)',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
          background: `hsl(${hue}, 100%, 50%)`,
        }} />
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim, #64748b)' }}>Hex:</span>
        <input
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          onBlur={handleHexSubmit}
          onKeyDown={(e) => { if (e.key === 'Enter') handleHexSubmit(); }}
          style={{
            flex: 1, fontSize: 11, padding: '2px 6px', borderRadius: 4,
            border: '1px solid var(--border, #e2e8f0)',
            background: 'var(--surface-alt, #fff)', color: 'var(--text-main, #374151)',
            fontFamily: 'monospace',
          }}
        />
        {onClose && (
          <button onClick={onClose} style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 4,
            border: '1px solid var(--border, #e2e8f0)', background: 'none',
            color: 'var(--text-dim, #64748b)', cursor: 'pointer',
          }}>Done</button>
        )}
      </div>
    </div>
  );
}

function hexToHsv(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return [Math.round(h), Math.round(s), Math.round(v)];
}

function hsvToHex(h: number, s: number, v: number): string {
  const sn = s / 100, vn = v / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vn - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
