'use client';

/**
 * WelcomeWizard.tsx — Sprint B1 + B2 of the industry-comparison roadmap.
 *
 * Solves the "blank canvas" gap identified in
 * docs/research/2026-05-19-industry-comparison-brief.md: consumer apps
 * (Planner 5D, IKEA Kreativ, Sims 4 Build Mode) all bypass the empty-
 * canvas problem by offering a starter or AI-generated layout on first
 * visit. MContainer's previous first-launch UX was an empty 3D scene
 * with a small banner — this wizard replaces that.
 *
 * Behavior:
 * - Detects first launch via localStorage (separate key from
 *   FirstLaunchHint so the two don't double-suppress).
 * - Shows a 5-option modal: Studio / Family / Resort / Pool House /
 *   Start Fresh.
 * - Picking a preset invokes the existing `placeModelHome` action.
 * - "Start Fresh" leaves the canvas empty but still marks the wizard
 *   as seen.
 * - The wizard auto-dismisses after a pick.
 * - On hosts with an existing container set (returning user), the
 *   wizard never shows even on first launch — the scene IS their
 *   project.
 */

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';

export const WELCOME_WIZARD_STORAGE_KEY = 'mhome.welcome-wizard.seen';

/**
 * Pure decision helper — extracted for testability.
 *
 * Returns true when the wizard SHOULD show on first launch.
 *
 * Gating notes:
 * - Pre-hydration: suppress (SSR + initial-paint flash).
 * - Storage-seen flag: suppress (user has dismissed the wizard before).
 * - Container threshold: suppress only when MORE THAN ONE container
 *   exists. The app auto-seeds a single default container on first
 *   hydration, so `containerCount === 0` never holds in production --
 *   the threshold has to allow that single seed through. Two-or-more
 *   containers means the user is returning to a real project.
 */
export function shouldShowWelcomeWizard(
  hasHydrated: boolean,
  containerCount: number,
  storageSeen: string | null,
): boolean {
  if (!hasHydrated) return false;
  if (containerCount > 1) return false;
  if (storageSeen === '1') return false;
  return true;
}

const STORAGE_KEY = WELCOME_WIZARD_STORAGE_KEY;

interface PresetOption {
  modelId: string | null; // null = "start fresh"
  label: string;
  description: string;
  emoji: string;
  accent: string;
}

const OPTIONS: PresetOption[] = [
  {
    modelId: 'micro_studio',
    label: 'Studio',
    description: 'Single 20ft container — smallest livable unit',
    emoji: '🏠',
    accent: '#3b82f6',
  },
  {
    modelId: 'family_2br',
    label: 'Family Home',
    description: 'Two-bedroom layout — living + bedrooms + bath',
    emoji: '🏡',
    accent: '#22c55e',
  },
  {
    modelId: 'resort_house',
    label: 'Resort',
    description: 'Three-level Bali-style with atrium + indoor pool',
    emoji: '🏝️',
    accent: '#f59e0b',
  },
  {
    modelId: 'entertainer',
    label: 'Pool House',
    description: 'Entertainer\'s dream — open layout + outdoor space',
    emoji: '🏊',
    accent: '#06b6d4',
  },
  {
    modelId: null,
    label: 'Start Fresh',
    description: 'Empty canvas — build from scratch',
    emoji: '✨',
    accent: '#94a3b8',
  },
];

export function WelcomeWizard() {
  const hasHydrated = useStore((s) => s._hasHydrated);
  const containers = useStore((s) => s.containers);
  const placeModelHome = useStore((s) => s.placeModelHome);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    // App auto-seeds ONE default container on first hydration -- treat that
    // as "blank canvas equivalent." Suppress only when 2+ containers exist
    // (i.e. a real returning project).
    if (Object.keys(containers).length > 1) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === '1') return;
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    } catch {
      // localStorage unavailable — skip
    }
  }, [hasHydrated, containers]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const pick = (opt: PresetOption) => {
    if (opt.modelId) {
      placeModelHome(opt.modelId);
    }
    dismiss();
  };

  return (
    <div
      data-testid="welcome-wizard"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'wizard-fade-in 0.3s ease-out',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-wizard-title"
    >
      <div
        style={{
          background: '#fff',
          padding: '32px',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          maxWidth: '720px',
          width: '90%',
        }}
      >
        <h2
          id="welcome-wizard-title"
          style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: '#0f172a' }}
        >
          What are you building?
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#64748b' }}>
          Pick a starting layout — or start fresh. You can change everything later.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.label}
              data-testid={`wizard-option-${opt.modelId ?? 'fresh'}`}
              onClick={() => pick(opt)}
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: `2px solid ${opt.accent}40`,
                background: `${opt.accent}08`,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 150ms ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = opt.accent;
                e.currentTarget.style.background = `${opt.accent}18`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${opt.accent}40`;
                e.currentTarget.style.background = `${opt.accent}08`;
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>{opt.emoji}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                {opt.label}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                {opt.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes wizard-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
