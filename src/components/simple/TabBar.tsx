'use client';
import React from 'react';
import { useStore } from '@/store/useStore';
import { Box, Paintbrush, Armchair, Sun, Eye } from 'lucide-react';

export type TabId = 'build' | 'paint' | 'furnish' | 'look' | 'explore';

interface TabBarProps {
  activeTab: TabId | null;
  onTabChange: (tab: TabId | null) => void;
}

const TABS: { id: TabId; label: string; Icon: React.FC<any> }[] = [
  { id: 'build', label: 'Build', Icon: Box },
  { id: 'paint', label: 'Paint', Icon: Paintbrush },
  { id: 'furnish', label: 'Furnish', Icon: Armchair },
  { id: 'look', label: 'Look', Icon: Sun },
  { id: 'explore', label: 'Explore', Icon: Eye },
];

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const milestones = useStore((s) => s.milestones);

  const isLocked = (id: TabId): boolean => {
    if (id === 'build' || id === 'look') return false;
    if (id === 'paint' || id === 'furnish') return !milestones?.containerPlaced;
    if (id === 'explore') return !milestones?.materialApplied;
    return false;
  };

  const lockMessage = (id: TabId): string => {
    if (id === 'paint' || id === 'furnish') return 'Add a container first!';
    if (id === 'explore') return 'Paint a surface first!';
    return '';
  };

  return (
    <div style={{
      height: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      background: 'var(--surface, #ffffff)',
      borderTop: '1px solid var(--border, #e2e8f0)',
      padding: '0 8px',
      zIndex: 100,
      flexShrink: 0,
    }}>
      {TABS.map(({ id, label, Icon }) => {
        const locked = isLocked(id);
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            onClick={() => {
              if (locked) return;
              onTabChange(isActive ? null : id);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 12px',
              borderRadius: 12,
              border: 'none',
              background: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
              cursor: locked ? 'not-allowed' : 'pointer',
              opacity: locked ? 0.35 : 1,
              transition: 'all 0.2s ease',
              transform: isActive ? 'scale(1.08)' : 'scale(1)',
              position: 'relative',
            }}
            title={locked ? lockMessage(id) : undefined}
          >
            <Icon
              size={28}
              color={isActive ? 'var(--accent, #2563eb)' : 'var(--text-muted, #94a3b8)'}
              strokeWidth={isActive ? 2.5 : 1.8}
            />
            <span style={{
              fontSize: 12,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--accent, #2563eb)' : 'var(--text-muted, #94a3b8)',
            }}>
              {label}
            </span>
            {locked && (
              <span style={{ position: 'absolute', top: 2, right: 2, fontSize: 10 }}>🔒</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
