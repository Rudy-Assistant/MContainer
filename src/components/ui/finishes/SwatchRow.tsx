"use client";

import { useState } from 'react';
import type { ColorPreset } from '@/config/finishPresets';
import ColorPicker from '@/components/ui/ColorPicker';

interface Props {
  colors: ColorPreset[];
  activeHex?: string;
  onSelect: (hex: string, label: string) => void;
  label: string;
}

export default function SwatchRow({ colors, activeHex, onSelect, label }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        color: 'var(--text-dim, #64748b)', letterSpacing: '0.05em', marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {colors.map((c) => (
          <button
            key={c.hex}
            onClick={() => onSelect(c.hex, c.label)}
            title={c.label}
            style={{
              width: 24, height: 24, borderRadius: 4, cursor: 'pointer', background: c.hex,
              border: `2px solid ${activeHex === c.hex ? 'var(--accent, #3b82f6)' : 'rgba(0,0,0,0.15)'}`,
              padding: 0,
            }}
          />
        ))}
        <button
          onClick={() => setShowPicker(!showPicker)}
          title="Custom color"
          style={{
            width: 24, height: 24, borderRadius: 4, cursor: 'pointer',
            background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
            border: '2px solid var(--border-dark, #334155)', padding: 0,
            fontSize: 12, color: '#fff', fontWeight: 700, textShadow: '0 0 2px rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          +
        </button>
      </div>
      {showPicker && (
        <ColorPicker
          color={activeHex || '#FFFFFF'}
          onChange={(hex) => onSelect(hex, 'Custom')}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
