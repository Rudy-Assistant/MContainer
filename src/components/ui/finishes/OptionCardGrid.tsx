"use client";

import type { MaterialPreset } from '@/config/finishPresets';

interface Props {
  items: MaterialPreset[];
  activeId?: string;
  onSelect: (id: string, label: string) => void;
  label: string;
}

export default function OptionCardGrid({ items, activeId, onSelect, label }: Props) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        color: 'var(--text-dim)', letterSpacing: '0.05em', marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id, item.label)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 9,
              border: `2px solid ${activeId === item.id ? 'var(--accent)' : 'var(--border)'}`,
              background: activeId === item.id ? 'var(--border-subtle)' : 'var(--btn-bg)',
              color: 'var(--text-main)', transition: 'border-color 100ms',
            }}
          >
            {item.icon
              ? <span style={{ fontSize: 16 }}>{item.icon}</span>
              : <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: item.color, border: '1px solid rgba(0,0,0,0.1)',
                }} />
            }
            <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
