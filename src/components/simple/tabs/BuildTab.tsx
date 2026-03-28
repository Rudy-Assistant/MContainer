'use client';
import React from 'react';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';
import BigCard from '../shared/BigCard';
import ActionButton from '../shared/ActionButton';
import CategoryRow from '../shared/CategoryRow';

const CONTAINER_TYPES = [
  { size: ContainerSize.Standard20, label: "20' Standard", desc: '6m x 2.4m', icon: '📦' },
  { size: ContainerSize.Standard40, label: "40' Standard", desc: '12m x 2.4m', icon: '📦' },
  { size: ContainerSize.HighCube40, label: "40' High Cube", desc: '12m x 2.9m', icon: '🏗️' },
];

export default function BuildTab() {
  const containers = useStore((s) => s.containers);
  const addContainer = useStore((s) => s.addContainer);
  const removeContainer = useStore((s) => s.removeContainer);
  const setSelectedElements = useStore((s) => s.setSelectedElements);
  const milestones = useStore((s) => s.milestones);

  const containerList = Object.entries(containers);

  const handleAdd = (size: ContainerSize) => {
    const count = containerList.length;
    addContainer(size, { x: count * 14, y: 0, z: 0 });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <CategoryRow title="Add a Container">
        {CONTAINER_TYPES.map(({ size, label, desc, icon }) => (
          <BigCard
            key={size}
            icon={icon}
            label={label}
            description={desc}
            size="large"
            action={{ label: '+ ADD', onClick: () => handleAdd(size) }}
          />
        ))}
      </CategoryRow>

      {containerList.length > 0 && (
        <CategoryRow title="Your Containers">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {containerList.map(([id, container]) => (
              <div
                key={id}
                onClick={() => setSelectedElements({ type: 'container', items: [{ containerId: id, id }] })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'var(--surface-alt, #f8fafc)',
                  border: '1px solid var(--border, #e2e8f0)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 24 }}>🏠</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
                  {(container as any).label || `Container (${(container as any).size?.replace('_', ' ') || '40ft'})`}
                </span>
                <ActionButton
                  icon="↻"
                  label="Rotate"
                  onClick={() => {/* rotate logic */}}
                  size="medium"
                />
                <ActionButton
                  icon="🗑️"
                  label="Delete"
                  onClick={() => removeContainer(id)}
                  variant="danger"
                  size="medium"
                />
              </div>
            ))}
          </div>
        </CategoryRow>
      )}
    </div>
  );
}
