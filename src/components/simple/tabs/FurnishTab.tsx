'use client';
import React, { useState } from 'react';
import BigCard from '../shared/BigCard';
import CategoryRow from '../shared/CategoryRow';

const CATEGORIES = [
  { id: 'doors', label: 'Doors', icon: '🚪' },
  { id: 'windows', label: 'Windows', icon: '🪟' },
  { id: 'furniture', label: 'Furniture', icon: '🪑' },
  { id: 'lights', label: 'Lights', icon: '💡' },
];

const ITEMS: Record<string, { id: string; label: string; icon: string }[]> = {
  doors: [
    { id: 'swing_door', label: 'Swing Door', icon: '🚪' },
    { id: 'sliding_door', label: 'Sliding Door', icon: '🚪' },
    { id: 'barn_door', label: 'Barn Door', icon: '🚪' },
  ],
  windows: [
    { id: 'fixed_window', label: 'Fixed Window', icon: '🪟' },
    { id: 'sliding_window', label: 'Sliding Window', icon: '🪟' },
    { id: 'skylight', label: 'Skylight', icon: '🪟' },
  ],
  furniture: [
    { id: 'kitchen', label: 'Kitchen', icon: '🍳' },
    { id: 'bed', label: 'Bed', icon: '🛏️' },
    { id: 'sofa', label: 'Sofa', icon: '🛋️' },
    { id: 'desk', label: 'Desk', icon: '🖥️' },
    { id: 'bathroom', label: 'Bathroom', icon: '🚿' },
    { id: 'stairs', label: 'Stairs', icon: '🪜' },
  ],
  lights: [
    { id: 'ceiling_light', label: 'Ceiling Light', icon: '💡' },
    { id: 'floor_lamp', label: 'Floor Lamp', icon: '🪔' },
    { id: 'wall_sconce', label: 'Wall Sconce', icon: '🔦' },
  ],
};

export default function FurnishTab() {
  const [activeCategory, setActiveCategory] = useState('doors');
  const items = ITEMS[activeCategory] || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <CategoryRow title="Category">
        {CATEGORIES.map(({ id, label, icon }) => (
          <BigCard
            key={id}
            icon={icon}
            label={label}
            active={activeCategory === id}
            action={{ label: 'Select', onClick: () => setActiveCategory(id) }}
          />
        ))}
      </CategoryRow>

      {items.length > 0 && (
        <CategoryRow title={CATEGORIES.find(c => c.id === activeCategory)?.label || ''}>
          {items.map(({ id, label, icon }) => (
            <BigCard
              key={id}
              icon={icon}
              label={label}
              size="large"
              action={{ label: 'Place', onClick: () => { /* placement mode */ } }}
            />
          ))}
        </CategoryRow>
      )}
    </div>
  );
}
