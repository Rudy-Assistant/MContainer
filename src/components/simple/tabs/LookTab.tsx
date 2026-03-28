'use client';
import React from 'react';
import { useStore } from '@/store/useStore';
import BigCard from '../shared/BigCard';
import CategoryRow from '../shared/CategoryRow';

const GROUND_PRESETS = [
  { id: 'grass', label: 'Grass', icon: '🌿' },
  { id: 'concrete', label: 'Concrete', icon: '⬜' },
  { id: 'gravel', label: 'Gravel', icon: '🪨' },
  { id: 'sand', label: 'Sand', icon: '🏖️' },
  { id: 'wood_deck', label: 'Deck', icon: '🪵' },
];

export default function LookTab() {
  const timeOfDay = useStore((s) => s.environment.timeOfDay);
  const setTimeOfDay = useStore((s) => s.setTimeOfDay);
  const groundPreset = useStore((s) => s.environment.groundPreset);
  const setGroundPreset = useStore((s) => s.setGroundPreset);

  const timeLabel = timeOfDay < 6 ? 'Night'
    : timeOfDay < 9 ? 'Morning'
    : timeOfDay < 12 ? 'Late Morning'
    : timeOfDay < 15 ? 'Afternoon'
    : timeOfDay < 18 ? 'Golden Hour'
    : timeOfDay < 21 ? 'Dusk'
    : 'Night';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Time of Day */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main, #0f172a)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Time of Day
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🌅</span>
          <input
            type="range"
            min={0}
            max={24}
            step={0.5}
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
            style={{ flex: 1, height: 8, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 24 }}>🌙</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
          {Math.floor(timeOfDay)}:{String(Math.round((timeOfDay % 1) * 60)).padStart(2, '0')} — {timeLabel}
        </div>
      </div>

      {/* Ground */}
      <CategoryRow title="Ground Surface">
        {GROUND_PRESETS.map(({ id, label, icon }) => (
          <BigCard
            key={id}
            icon={icon}
            label={label}
            active={groundPreset === id}
            action={{ label: 'Apply', onClick: () => setGroundPreset(id) }}
          />
        ))}
      </CategoryRow>
    </div>
  );
}
