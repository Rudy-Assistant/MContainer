"use client";

export type FinishTab = 'flooring' | 'walls' | 'ceiling' | 'electrical';

export const FINISH_TABS: { id: FinishTab; label: string }[] = [
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
      display: 'flex', gap: 2, padding: '4px 8px',
      borderBottom: '1px solid var(--border)',
    }}>
      {FINISH_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => !disabled && onTabChange(tab.id)}
          style={{
            flex: 1, padding: '6px 4px', fontSize: 10, fontWeight: 600,
            borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
            border: activeTab === tab.id
              ? '1px solid var(--accent)'
              : '1px solid transparent',
            background: activeTab === tab.id
              ? 'var(--border-subtle)'
              : 'transparent',
            color: disabled
              ? 'var(--text-dim)'
              : activeTab === tab.id
                ? 'var(--accent)'
                : 'var(--text-main)',
            opacity: disabled ? 0.5 : 1,
            transition: 'all 100ms',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
