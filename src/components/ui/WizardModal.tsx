"use client";

import { useStore } from "@/store/useStore";
import { WIZARD_PRESETS } from "@/config/wizardPresets";
import { X } from "lucide-react";

export default function WizardModal() {
  const wizardOpen = useStore((s) => s.wizardOpen);
  const wizardPresetId = useStore((s) => s.wizardPresetId);
  const closeWizard = useStore((s) => s.closeWizard);
  const setWizardPresetId = useStore((s) => s.setWizardPresetId);
  const applyWizardPreset = useStore((s) => s.applyWizardPreset);
  const containers = useStore((s) => s.containers);
  const selection = useStore((s) => s.selection);
  const addContainer = useStore((s) => s.addContainer);

  if (!wizardOpen) return null;

  const selectedPreset = WIZARD_PRESETS.find((p) => p.id === wizardPresetId);

  const handleApply = () => {
    let targetId = selection?.[0] ?? null;
    // If no container selected, create one
    if (!targetId || !containers[targetId]) {
      targetId = addContainer();
    }
    if (targetId && wizardPresetId) {
      applyWizardPreset(targetId, wizardPresetId);
    }
    closeWizard();
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeWizard();
      }}
    >
      <div
        style={{
          background: "var(--bg-panel, #ffffff)",
          borderRadius: 16,
          width: 480,
          maxWidth: "90vw",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border, #e2e8f0)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-main, #1e293b)" }}>
            Quick Setup
          </h2>
          <button
            onClick={closeWizard}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              color: "var(--text-muted, #64748b)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Preset Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
            padding: "16px 20px",
          }}
        >
          {WIZARD_PRESETS.map((preset) => {
            const isSelected = wizardPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setWizardPresetId(preset.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: isSelected
                    ? "2px solid var(--accent, #3b82f6)"
                    : "2px solid var(--border, #e2e8f0)",
                  background: isSelected
                    ? "var(--accent-bg, rgba(59,130,246,0.08))"
                    : "var(--bg-secondary, #f8fafc)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <span style={{ fontSize: 22 }}>{preset.icon}</span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-main, #1e293b)",
                  }}
                >
                  {preset.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted, #64748b)",
                    lineHeight: 1.4,
                  }}
                >
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* Description area */}
        {selectedPreset && (
          <div style={{
            margin: "0 20px", padding: "10px 14px",
            background: "var(--bg-secondary, #f1f5f9)", borderRadius: 8,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main, #1e293b)", marginBottom: 6 }}>
              {selectedPreset.label} — {selectedPreset.steps.length} steps
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-muted, #475569)", lineHeight: 1.8 }}>
              {selectedPreset.steps.map((step, i) => {
                const labels: Record<string, string> = {
                  extensions: `Deploy extensions (${step.config || 'default'})`,
                  rooftop_deck: 'Stack rooftop deck with railings',
                  vertical_stairs: `Add staircase (facing ${step.stairFacing || 'S'})`,
                  paint_outer_walls: `Paint exterior walls → ${step.wallMaterial?.replace(/_/g, ' ') || 'default'}`,
                  open_interior_walls: 'Open all interior walls',
                  set_all_floors: `Set all floors → ${step.floorMaterial?.replace(/_/g, ' ') || 'default'}`,
                  set_all_ceilings: `Set all ceilings → ${step.ceilingMaterial?.replace(/_/g, ' ') || 'default'}`,
                  add_door: `Add door (voxel ${step.doorVoxelIndex}, ${step.doorFace?.toUpperCase()} face)`,
                };
                return <li key={i}>{labels[step.action] || step.action}</li>;
              })}
            </ol>
            <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)", marginTop: 6 }}>
              Fully undoable with Ctrl+Z
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            padding: "16px 20px",
            borderTop: "1px solid var(--border, #e2e8f0)",
          }}
        >
          <button
            onClick={closeWizard}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid var(--border, #cbd5e1)",
              background: "transparent",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-muted, #64748b)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!wizardPresetId}
            style={{
              padding: "8px 22px",
              borderRadius: 8,
              border: "none",
              background: wizardPresetId
                ? "var(--accent, #3b82f6)"
                : "var(--border, #cbd5e1)",
              color: "#fff",
              cursor: wizardPresetId ? "pointer" : "default",
              fontSize: 13,
              fontWeight: 600,
              opacity: wizardPresetId ? 1 : 0.5,
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
