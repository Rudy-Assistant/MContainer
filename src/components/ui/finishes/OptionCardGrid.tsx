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
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        color: 'var(--text-dim)', letterSpacing: '0.05em', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id, item.label)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 6,
              padding: '12px 4px', borderRadius: 8, cursor: 'pointer',
              border: `2px solid ${activeId === item.id ? 'var(--accent)' : 'var(--border)'}`,
              background: activeId === item.id ? 'var(--border-subtle)' : 'var(--btn-bg)',
              boxShadow: activeId === item.id ? '0 0 0 1px var(--accent)' : 'none',
              color: 'var(--text-main)', transition: 'border-color 120ms, box-shadow 120ms',
            }}
          >
            {item.icon
              ? <span style={{ fontSize: 20 }}>{item.icon}</span>
              : <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: item.color, border: '1px solid rgba(0,0,0,0.1)',
                }} />
            }
            <span style={{ fontSize: 10, fontWeight: 500, textAlign: 'center', lineHeight: 1.3 }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
