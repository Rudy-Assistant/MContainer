'use client';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import TabBar, { type TabId } from './TabBar';
import SlidePanel from './SlidePanel';
import TopPill from './TopPill';
import BuildTab from './tabs/BuildTab';
import PaintTab from './tabs/PaintTab';
import FurnishTab from './tabs/FurnishTab';
import LookTab from './tabs/LookTab';
import ExploreTab from './tabs/ExploreTab';
import { useStore } from '@/store/useStore';
import { ViewMode } from '@/types/container';

const SceneCanvas = dynamic(
  () => import('@/components/three/SceneCanvas'),
  { ssr: false }
);

const TAB_CONTENT: Record<TabId, React.FC> = {
  build: BuildTab,
  paint: PaintTab,
  furnish: FurnishTab,
  look: LookTab,
  explore: ExploreTab,
};

export default function SimpleLayout() {
  const [activeTab, setActiveTab] = useState<TabId | null>('build');
  const viewMode = useStore((s) => s.viewMode);
  const isWalkthrough = viewMode === ViewMode.Walkthrough;
  const activeHotbarSlot = useStore((s) => s.activeHotbarSlot);

  const TabContent = activeTab ? TAB_CONTENT[activeTab] : null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      height: '100vh',
      background: 'var(--background, #f4f6f8)',
    }}>
      {/* Top floating controls */}
      <TopPill />

      {/* 3D Canvas — takes remaining space */}
      <div style={{
        flex: 1,
        position: 'relative',
        minHeight: 0,
        cursor: activeHotbarSlot !== null && !isWalkthrough ? 'crosshair' : 'default',
      }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <SceneCanvas />

        {/* Walkthrough overlay */}
        {isWalkthrough && (
          <div style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            borderRadius: 8,
            padding: '6px 16px',
            pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
              WASD move · Mouse look · Shift sprint · ESC exit
            </span>
          </div>
        )}
      </div>

      {/* Slide-up panel */}
      {!isWalkthrough && (
        <SlidePanel open={activeTab !== null} onClose={() => setActiveTab(null)}>
          {TabContent && <TabContent />}
        </SlidePanel>
      )}

      {/* Bottom tab bar */}
      {!isWalkthrough && (
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  );
}
