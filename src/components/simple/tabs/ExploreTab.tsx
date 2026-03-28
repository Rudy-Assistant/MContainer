'use client';
import React from 'react';
import { useStore } from '@/store/useStore';
import { ViewMode } from '@/types/container';
import BigCard from '../shared/BigCard';
import CategoryRow from '../shared/CategoryRow';
import ActionButton from '../shared/ActionButton';

const VIEW_MODES = [
  { mode: ViewMode.Realistic3D, label: '3D View', desc: 'Orbit around your home', icon: '🔄' },
  { mode: ViewMode.Blueprint, label: 'Blueprint', desc: 'Top-down floor plan', icon: '📐' },
  { mode: ViewMode.Walkthrough, label: 'Walk Inside', desc: 'Explore in first person', icon: '🚶' },
];

export default function ExploreTab() {
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <CategoryRow title="View Mode">
        {VIEW_MODES.map(({ mode, label, desc, icon }) => (
          <BigCard
            key={mode}
            icon={icon}
            label={label}
            description={desc}
            active={viewMode === mode}
            size="large"
            action={{
              label: viewMode === mode ? 'Active' : 'Switch',
              onClick: () => setViewMode(mode),
            }}
          />
        ))}
      </CategoryRow>

      <CategoryRow title="Actions">
        <div style={{ display: 'flex', gap: 12 }}>
          <ActionButton icon="📸" label="Screenshot" onClick={() => { /* screenshot */ }} size="large" />
          <ActionButton icon="🔗" label="Share" onClick={() => { /* share */ }} size="large" />
          <ActionButton icon="💾" label="Export 3D" onClick={() => { /* export */ }} size="large" />
        </div>
      </CategoryRow>
    </div>
  );
}
