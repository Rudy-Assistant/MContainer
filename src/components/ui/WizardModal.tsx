"use client";

/**
 * WizardModal — first-run / Quick Setup picker.
 *
 * Rebuilt 2026-04-25 in response to the cramped 480px / 2-column / 12px-text
 * layout. The audience for this modal is non-technical first-time users; the
 * cards need to read at-a-glance without squinting.
 *
 * Design intent:
 *   - Modal is roomy (760px max, 92vw cap) — content is the priority, chrome
 *     gets out of the way.
 *   - Cards are tall (~180px), with a large emoji thumbnail, a clear title,
 *     and a readable description (14px / 1.5 line-height).
 *   - The selected card gets a warm tint plus a thicker accent border AND a
 *     checkmark dot in the corner — selection state is unambiguous even when
 *     scanning quickly.
 *   - "Steps" preview is a calm panel with bigger bullets and a quieter
 *     "Cancel" so the primary "Apply" CTA reads as the obvious next click.
 *   - Keyboard support: Esc cancels, Enter applies when a preset is selected.
 */

import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { WIZARD_PRESETS, type WizardStep } from "@/config/wizardPresets";
import { Check, X } from "lucide-react";
import WizardPresetIcon from "@/components/ui/WizardPresetIcon";
import { useExitTransition } from "@/hooks/useExitTransition";

/**
 * Convert internal wizard steps into outcome-oriented copy a homebuyer
 * would understand. The previous output exposed implementation details
 * ("Add door (voxel 27, S face)", "Paint exterior walls → Window Standard")
 * which read as a developer's debug log.
 *
 * If the user has a designer's reason to see the technical step list,
 * that belongs behind a "show details" toggle, not in the default modal.
 *
 * Steps are also de-duplicated so e.g. "set_all_floors → Wood" then
 * "set_all_ceilings → Wood" don't both produce identical "Wood-plank"
 * lines — the same outcome shouldn't appear twice.
 */
export function humanizeWizardSteps(steps: WizardStep[]): string[] {
  const out: string[] = [];
  for (const step of steps) {
    const phrase = (() => {
      switch (step.action) {
        case 'extensions':
          return step.config === 'all_glass_interior'
            ? 'Floor-to-ceiling glass on all sides'
            : 'Solid steel exterior';
        case 'rooftop_deck':
          return 'Rooftop deck with safety railings';
        case 'vertical_stairs':
          return 'Interior staircase to the upper floor';
        case 'paint_outer_walls':
          return 'Standard windows on the exterior';
        case 'open_interior_walls':
          return 'Open floor plan — no interior walls';
        case 'set_all_floors':
          return 'Wide-plank wood flooring throughout';
        case 'set_all_ceilings':
          return 'Wood-plank ceilings throughout';
        case 'add_door':
          return 'Front entry door';
        default:
          return null;
      }
    })();
    if (phrase && !out.includes(phrase)) out.push(phrase);
  }
  return out;
}

export default function WizardModal() {
  const wizardOpen = useStore((s) => s.wizardOpen);
  const wizardPresetId = useStore((s) => s.wizardPresetId);
  const closeWizard = useStore((s) => s.closeWizard);
  const setWizardPresetId = useStore((s) => s.setWizardPresetId);
  const applyWizardPreset = useStore((s) => s.applyWizardPreset);
  const containers = useStore((s) => s.containers);
  const selection = useStore((s) => s.selection);
  const addContainer = useStore((s) => s.addContainer);
  const select = useStore((s) => s.select);

  const selectedPreset = WIZARD_PRESETS.find((p) => p.id === wizardPresetId);

  const handleApply = () => {
    let targetId = selection?.[0] ?? null;
    if (!targetId || !containers[targetId]) {
      // First-run case: a default seed container exists but isn't selected.
      // Target the lone container in-place rather than spawning a second one
      // next to it — that's what the user means by "apply to my canvas".
      const ids = Object.keys(containers);
      targetId = ids.length === 1 ? ids[0] : addContainer();
    }
    if (targetId && wizardPresetId) {
      applyWizardPreset(targetId, wizardPresetId);
      // Auto-select the target so the Inspector mounts and the user immediately
      // sees the applied-preset chip — the read-back affordance for what just
      // happened. Without this, applyWizardPreset is a fire-and-forget that
      // leaves the user with no UI feedback (probe S3 surfaced this gap).
      select(targetId);
    }
    closeWizard();
  };

  // Esc closes, Enter applies — small but meaningful UX wins on a modal.
  useEffect(() => {
    if (!wizardOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeWizard();
      if (e.key === "Enter" && wizardPresetId) handleApply();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardOpen, wizardPresetId]);

  const { mounted, state } = useExitTransition(wizardOpen, 200);
  if (!mounted) return null;

  return (
    <div
      data-state={state}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Backdrop and content as siblings so the shared
          modal-backdrop-in/out and modal-content-in/out keyframes can each
          animate independently — the previous structure folded both into
          one div which prevented the exit animation from firing. */}
      <div
        className="modal-backdrop"
        onClick={closeWizard}
        style={{ background: "rgba(15, 23, 42, 0.45)" }}
      />
      <div
        role="dialog"
        aria-label="Quick Setup"
        className="modal-content"
        style={{
          position: "relative",
          background: "var(--bg-panel, #ffffff)",
          borderRadius: 18,
          width: 760,
          maxWidth: "92vw",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(15,23,42,0.25), 0 0 0 1px rgba(15,23,42,0.04)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 28px",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-main, #0f172a)", letterSpacing: "-0.01em" }}>
              Quick Setup
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-muted, #64748b)" }}>
              Pick a starting layout. You can edit anything afterwards.
            </p>
          </div>
          <button
            onClick={closeWizard}
            aria-label="Close"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, padding: 0,
              background: "transparent",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: 10,
              cursor: "pointer",
              color: "var(--text-muted, #64748b)",
              transition: "all 150ms ease-out",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt, #f3f4f6)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Preset grid (scrollable) ────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 14,
            padding: "20px 28px",
            overflowY: "auto",
            flexGrow: 1,
            minHeight: 0,
          }}
        >
          {WIZARD_PRESETS.map((preset) => {
            const isSelected = wizardPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setWizardPresetId(preset.id)}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "20px 22px",
                  minHeight: 168,
                  borderRadius: 14,
                  border: isSelected
                    ? "2px solid var(--accent, #3b82f6)"
                    : "2px solid var(--border, #e2e8f0)",
                  background: isSelected
                    ? "linear-gradient(180deg, rgba(59,130,246,0.07), rgba(59,130,246,0.02))"
                    : "var(--bg-panel, #ffffff)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 150ms ease-out, background 150ms ease-out, transform 150ms ease-out",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "var(--text-muted, #94a3b8)";
                    e.currentTarget.style.background = "var(--surface-alt, #f8fafc)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "var(--border, #e2e8f0)";
                    e.currentTarget.style.background = "var(--bg-panel, #ffffff)";
                  }
                }}
              >
                {/* Selected check pip — top-right, only when selected */}
                {isSelected && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 14,
                      right: 14,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "var(--accent, #3b82f6)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}

                {/* Stylized icon — uses the custom SVG set when iconStyle is
                    declared (preferred), falls back to the legacy emoji
                    otherwise so old presets without iconStyle still render. */}
                {preset.iconStyle ? (
                  <WizardPresetIcon kind={preset.iconStyle} size={44} />
                ) : (
                  <span
                    style={{
                      fontSize: 40,
                      lineHeight: 1,
                      filter: isSelected ? "none" : "saturate(0.92)",
                    }}
                  >
                    {preset.icon}
                  </span>
                )}

                {/* Title + description */}
                <span
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: "var(--text-main, #0f172a)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {preset.label}
                </span>
                <span
                  style={{
                    fontSize: 13.5,
                    color: "var(--text-muted, #475569)",
                    lineHeight: 1.55,
                  }}
                >
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Steps preview (only when a preset is selected) ── */}
        {selectedPreset && (
          <div
            style={{
              margin: "0 28px 20px",
              padding: "16px 20px",
              background: "var(--bg-secondary, #f1f5f9)",
              borderRadius: 12,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main, #0f172a)" }}>
                What you&apos;ll get
              </div>
            </div>
            <ol
              style={{
                margin: 0,
                paddingLeft: 22,
                fontSize: 13,
                color: "var(--text-muted, #475569)",
                lineHeight: 1.7,
              }}
            >
              {/* Friendly outcome-oriented labels — no internal jargon. We
                  hand-write these so a homebuyer reading the preview
                  understands what the new design will look like, not what
                  voxel index gets which surface enum. The wallMaterial /
                  floorMaterial / ceilingMaterial / config values are still
                  available on the step if a developer needs them. */}
              {humanizeWizardSteps(selectedPreset.steps).map((label, i) => (
                <li key={i}>{label}</li>
              ))}
            </ol>
            <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)", marginTop: 10 }}>
              You can change anything afterwards, or undo with{" "}
              <kbd style={kbdStyle}>Ctrl</kbd>+<kbd style={kbdStyle}>Z</kbd>.
            </div>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "16px 28px",
            borderTop: "1px solid var(--border, #e2e8f0)",
            background: "var(--surface-alt, #f8fafc)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-muted, #94a3b8)", marginRight: "auto" }}>
            <kbd style={kbdStyle}>Esc</kbd> to cancel · <kbd style={kbdStyle}>Enter</kbd> to apply
          </span>
          <button
            onClick={closeWizard}
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              border: "1px solid var(--border, #cbd5e1)",
              background: "transparent",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-main, #334155)",
              transition: "background 150ms ease-out",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt, #f1f5f9)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!wizardPresetId}
            style={{
              padding: "10px 28px",
              borderRadius: 10,
              border: "none",
              background: wizardPresetId
                ? "var(--accent, #3b82f6)"
                : "var(--surface-alt, #e2e8f0)",
              color: wizardPresetId ? "#ffffff" : "var(--text-muted, #94a3b8)",
              cursor: wizardPresetId ? "pointer" : "not-allowed",
              fontSize: 15,
              fontWeight: 700,
              boxShadow: wizardPresetId ? "0 1px 3px rgba(59,130,246,0.4)" : "none",
              transition: "background 150ms ease-out, box-shadow 150ms ease-out",
              letterSpacing: "0.01em",
            }}
          >
            Apply Layout
          </button>
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  padding: "1px 6px",
  borderRadius: 4,
  border: "1px solid var(--border, #cbd5e1)",
  background: "var(--bg-panel, #ffffff)",
  fontFamily: "var(--font-mono, ui-monospace, Menlo, Consolas, monospace)",
  fontSize: 11,
  color: "var(--text-main, #334155)",
};
