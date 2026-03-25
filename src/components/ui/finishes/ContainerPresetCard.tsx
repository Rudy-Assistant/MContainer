'use client';

import type { ReactNode } from 'react';
import { PresetCard } from './PresetCard';

interface ContainerPresetCardProps {
  content: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function ContainerPresetCard({
  content, label, active, onClick, onMouseEnter, onMouseLeave,
}: ContainerPresetCardProps) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8,
      padding: 6,
    }}>
      <PresetCard
        content={content}
        label={label}
        active={active}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    </div>
  );
}
