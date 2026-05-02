"use client";

/**
 * AIDesignModal — Natural-language design brief → structured DesignPlan.
 *
 * Posts the user's prompt to /api/design, which calls Claude Sonnet 4.6
 * with prompt caching. The returned DesignPlan is applied to the live
 * Zustand store via applyDesignPlan(), so the new design appears in-canvas.
 *
 * No streaming yet — request is short (one tool call), and the visual
 * payoff is the design appearing all at once. Streaming could be added
 * later via SSE if rationales get long enough to warrant it.
 */

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { applyDesignPlan, fetchDesignPlan, type DesignPlan } from '@/utils/aiDesigner';
import { useExitTransition } from '@/hooks/useExitTransition';

interface AIDesignModalProps {
  open: boolean;
  onClose: () => void;
}

const EXAMPLE_PROMPTS = [
  'Two-bedroom modern home with a butterfly roof and a kitchen island.',
  'Studio with a galley kitchen, walk-in closet, and gable roof.',
  'Three 40ft containers in a row — open plan downstairs, two bedrooms upstairs.',
];

export default function AIDesignModal({ open, onClose }: AIDesignModalProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPlan, setLastPlan] = useState<DesignPlan | null>(null);

  const { mounted, state } = useExitTransition(open, 200);
  if (!mounted) return null;

  const handleSubmit = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    setLastPlan(null);
    try {
      const fetched = await fetchDesignPlan(prompt);
      if (!fetched.ok) {
        setError(fetched.error);
        return;
      }
      const plan = fetched.plan;
      // Reset canvas before applying so the new design lands on a clean slate.
      // Veil the swap with the scene-fade so containers don't pop in and out
      // visibly — the new design appears as if it materialised through the wash.
      const store = useStore.getState();
      store.triggerSceneFade();
      await new Promise((r) => setTimeout(r, 150));
      Object.keys(useStore.getState().containers).forEach((id) => store.removeContainer(id));
      store.clearSelection();
      const result = applyDesignPlan(plan, useStore.getState());
      setLastPlan(plan);
      if (result.warnings.length > 0) {
        setError(`Applied with ${result.warnings.length} warning(s):\n${result.warnings.join('\n')}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-state={state} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content" style={{
        position: 'relative', background: 'var(--modal-bg, #fff)', borderRadius: 12,
        boxShadow: 'var(--panel-shadow, 0 8px 32px rgba(0,0,0,0.2))', border: '1px solid var(--border)',
        width: 'min(560px, 92vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        color: 'var(--text-main)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Sparkles size={16} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>AI Design Brief</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            Describe the home you want. Claude will lay out containers, rooms, and a roof — replacing the current canvas.
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Two-bedroom modern home with butterfly roof and a kitchen island."
            rows={4}
            disabled={loading}
            maxLength={4000}
            style={{
              width: '100%', padding: 10, fontSize: 13, lineHeight: 1.4,
              background: 'var(--input-bg)', color: 'var(--text-main)',
              border: '1px solid var(--input-border)', borderRadius: 6,
              fontFamily: 'inherit', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                disabled={loading}
                style={{
                  fontSize: 10, padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                  background: 'var(--surface-alt)', color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {ex.length > 50 ? ex.slice(0, 47) + '…' : ex}
              </button>
            ))}
          </div>

          {error && (
            <div style={{
              marginTop: 12, padding: 10, fontSize: 11, lineHeight: 1.4,
              background: 'rgba(239,68,68,0.08)', color: 'var(--danger, #ef4444)',
              border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, whiteSpace: 'pre-wrap',
            }}>
              {error}
            </div>
          )}

          {lastPlan && (
            <div style={{
              marginTop: 12, padding: 10, fontSize: 11, lineHeight: 1.5,
              background: 'var(--surface-alt)', borderRadius: 6,
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-main)' }}>Designer rationale</div>
              <div style={{ color: 'var(--text-muted)' }}>{lastPlan.rationale}</div>
              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-dim)' }}>
                {lastPlan.actions.length} action{lastPlan.actions.length === 1 ? '' : 's'} applied
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid var(--btn-border)',
              background: 'var(--btn-bg)', color: 'var(--text-main)', cursor: 'pointer', fontSize: 12,
            }}
          >
            Close
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !prompt.trim()}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: loading || !prompt.trim() ? 'var(--text-dim)' : 'var(--accent)',
              color: '#fff', cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Sparkles size={12} /> {loading ? 'Designing…' : 'Generate Design'}
          </button>
        </div>
      </div>
    </div>
  );
}
