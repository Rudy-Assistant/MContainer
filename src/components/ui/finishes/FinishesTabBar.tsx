"use client";

export type FinishTab = 'container' | 'block' | 'flooring' | 'walls' | 'ceiling' | 'electrical';

export const FINISH_TABS: { id: FinishTab; label: string }[] = [
  { id: 'container', label: 'Container' },
  { id: 'block', label: 'Block' },
  { id: 'flooring', label: 'Flooring' },
  { id: 'walls', label: 'Walls' },
  { id: 'ceiling', label: 'Ceiling' },
  { id: 'electrical', label: 'Electrical' },
];

/** Maps a face key to the appropriate tab */
export function faceToTab(face: string | null): FinishTab | null {
  if (face === 'bottom') return 'flooring';
  if (face === 'top') return 'ceiling';
  if (face === 'n' || face === 's' || face === 'e' || face === 'w') return 'walls';
  return null;
}

interface Props {
  activeTab: FinishTab;
  onTabChange: (tab: FinishTab) => void;
  disabled?: boolean;
}

export default function FinishesTabBar({ activeTab, onTabChange, disabled }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 0, padding: '0 12px',
      borderBottom: '1px solid var(--border)',
    }}>
      {FINISH_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => !disabled && onTabChange(tab.id)}
            style={{
              padding: '8px 12px 6px', fontSize: 12, fontWeight: isActive ? 600 : 500,
              cursor: disabled ? 'default' : 'pointer',
              border: 'none',
              borderBottom: isActive
                ? '2px solid var(--accent)'
                : '2px solid transparent',
              background: 'transparent',
              color: disabled
                ? 'var(--text-dim)'
                : isActive
                  ? 'var(--accent)'
                  : 'var(--text-muted)',
              opacity: disabled ? 0.4 : 1,
              transition: 'color 100ms, border-color 100ms',
              marginBottom: -1, // overlap container border
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
