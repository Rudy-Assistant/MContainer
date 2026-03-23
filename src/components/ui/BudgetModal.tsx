"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { useStore } from "@/store/useStore";
import { ContainerSize, ModuleType, type PricingConfig } from "@/types/container";
import defaultPricing from "@/config/pricing_config.json";
import { X, RotateCcw, ChevronDown } from "lucide-react";
import { formatUSD as fmt } from "@/utils/formatters";

const CONTAINER_SIZE_LABELS: Record<string, string> = {
  [ContainerSize.Standard20]: "20ft Standard",
  [ContainerSize.Standard40]: "40ft Standard",
  [ContainerSize.HighCube40]: "40ft High-Cube",
};

const MODULE_LABELS: Record<string, string> = {
  [ModuleType.PanelSolid]: "Solid Panel",
  [ModuleType.PanelGlass]: "Glass Panel",
  [ModuleType.HingedWall]: "Hinged Wall",
  [ModuleType.OpenVoid]: "Open Void",
};

const INPUT_CLASS = "w-28 bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-900 text-right outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-300";

interface BudgetModalProps {
  open: boolean;
  onClose: () => void;
}

export default function BudgetModal({ open, onClose }: BudgetModalProps) {
  const pricing = useStore((s) => s.pricing);
  const updatePricing = useStore((s) => s.updatePricing);
  const containers = useStore((s) => s.containers);
  const containerCount = Object.keys(containers).length;
  const getEstimate = useStore((s) => s.getEstimate);

  const [draft, setDraft] = useState<PricingConfig>(pricing);
  const [showRates, setShowRates] = useState(false);

  // Sync draft when pricing changes externally
  useEffect(() => {
    if (open) setDraft(pricing);
  }, [open, pricing]);

  // Reset accordion on open
  useEffect(() => {
    if (open) setShowRates(false);
  }, [open]);

  // Memoize estimate computation (O(containers × voxels))
  const estimate = useMemo(
    () => (open && containerCount > 0 ? getEstimate() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, containers, pricing],
  );

  if (!open) return null;
  const bd = estimate?.breakdown;

  const handleContainerBase = (size: ContainerSize, value: string) => {
    const num = parseFloat(value) || 0;
    setDraft((d) => ({ ...d, containerBase: { ...d.containerBase, [size]: num } }));
  };
  const handleModuleCost = (type: ModuleType, value: string) => {
    const num = parseFloat(value) || 0;
    setDraft((d) => ({ ...d, moduleCosts: { ...d.moduleCosts, [type]: num } }));
  };
  const handleField = (field: "cutFee" | "glassSurcharge" | "hingeMechanism", value: string) => {
    const num = parseFloat(value) || 0;
    setDraft((d) => ({ ...d, [field]: num }));
  };
  const handleSave = () => { updatePricing(draft); onClose(); };
  const handleReset = () => { setDraft(defaultPricing as unknown as PricingConfig); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ padding: 24 }}>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col"
        style={{
          background: 'var(--modal-bg, #ffffff)',
          borderRadius: 16,
          boxShadow: 'var(--panel-shadow, 0 25px 50px rgba(0,0,0,0.25))',
          border: '1px solid var(--border, rgba(0,0,0,0.05))',
          color: 'var(--text-main, #0f172a)',
        }}
      >
        {/* ── Header ── */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-subtle, #f1f5f9)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main, #0f172a)', margin: 0, lineHeight: 1.2 }}>
                Budget Overview
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', margin: '4px 0 0' }}>
                {containerCount} container{containerCount !== 1 ? 's' : ''} in your design
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--surface-alt, #f8fafc)', color: 'var(--text-dim, #94a3b8)', transition: 'all 150ms',
              }}
              className="hover-close-btn"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Cost Summary ── */}
        {bd && (
          <div style={{ padding: '24px 28px', background: 'var(--surface-alt, #f8fafc)', borderBottom: '1px solid var(--border-subtle, #f1f5f9)' }}>
            {/* Total */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-main, #0f172a)', fontFamily: 'system-ui', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {fmt(bd.total)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-dim, #94a3b8)', fontWeight: 500 }}>estimated total</span>
            </div>

            {/* Category breakdown cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'Structure', value: bd.containers, color: 'var(--text-muted, #475569)', bg: 'var(--border-subtle, #f1f5f9)', border: 'var(--border, #e2e8f0)' },
                { label: 'Modules', value: bd.modules, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
                { label: 'Cuts & Fees', value: bd.cuts, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} style={{
                  padding: '14px 16px', borderRadius: 10, background: bg,
                  border: `1px solid ${border}`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'system-ui' }}>
                    {fmt(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Rate Editing (Accordion) ── */}
        <div className="overflow-y-auto" style={{ padding: '0 28px' }}>
          <button
            onClick={() => setShowRates(!showRates)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '16px 0', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.08em',
              borderBottom: showRates ? 'none' : '1px solid #f1f5f9',
            }}
          >
            <span>Customize Rates</span>
            <ChevronDown size={14} style={{ transform: showRates ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
          </button>

          {showRates && (
            <div style={{ paddingBottom: 20 }}>
              {/* Container Base Costs */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Container Base Cost
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.values(ContainerSize).map((size) => (
                    <div key={size} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-main, #374151)' }}>
                        {CONTAINER_SIZE_LABELS[size]}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-dim, #94a3b8)' }}>$</span>
                        <input type="number" value={draft.containerBase[size]}
                          onChange={(e) => handleContainerBase(size, e.target.value)} className={INPUT_CLASS} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-subtle, #f1f5f9)', margin: '0 0 24px' }} />

              {/* Module Costs */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Module Costs
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.values(ModuleType).map((type) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-main, #374151)' }}>{MODULE_LABELS[type]}</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-dim, #94a3b8)' }}>$</span>
                        <input type="number" value={draft.moduleCosts[type]}
                          onChange={(e) => handleModuleCost(type, e.target.value)} className={INPUT_CLASS} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-subtle, #f1f5f9)', margin: '0 0 24px' }} />

              {/* Additional Fees */}
              <div>
                <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Additional Fees
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {([
                    ["cutFee", "Structural Cut Fee"],
                    ["glassSurcharge", "Glass Surcharge"],
                    ["hingeMechanism", "Hinge Mechanism"],
                  ] as const).map(([field, label]) => (
                    <div key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-main, #374151)' }}>{label}</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-dim, #94a3b8)' }}>$</span>
                        <input type="number" value={draft[field]}
                          onChange={(e) => handleField(field, e.target.value)} className={INPUT_CLASS} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 28px', borderTop: '1px solid #f1f5f9', background: 'var(--surface-alt, #fafbfc)',
        }}>
          <button onClick={handleReset} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 500, color: 'var(--text-muted, #64748b)', background: 'none', border: '1px solid #e2e8f0',
            cursor: 'pointer', transition: 'all 150ms',
          }}
            className="hover-surface-alt"
          >
            <RotateCcw size={13} />
            Reset Defaults
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} className="hover-surface-alt" style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              color: 'var(--text-muted, #475569)', background: 'none', border: '1px solid #e2e8f0', cursor: 'pointer',
              transition: 'all 150ms',
            }}>
              Cancel
            </button>
            <button onClick={handleSave} className="hover-dark-btn" style={{
              padding: '8px 28px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              color: '#fff', background: '#0f172a', border: 'none', cursor: 'pointer',
              transition: 'all 150ms', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
