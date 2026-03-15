"use client";

import { useState, useEffect, Fragment } from "react";
import { useStore } from "@/store/useStore";
import { ContainerSize, ModuleType, type PricingConfig } from "@/types/container";
import defaultPricing from "@/config/pricing_config.json";
import { X, RotateCcw } from "lucide-react";

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

interface BudgetModalProps {
  open: boolean;
  onClose: () => void;
}

export default function BudgetModal({ open, onClose }: BudgetModalProps) {
  const pricing = useStore((s) => s.pricing);
  const updatePricing = useStore((s) => s.updatePricing);

  const [draft, setDraft] = useState<PricingConfig>(pricing);

  useEffect(() => {
    if (open) setDraft(pricing);
  }, [open, pricing]);

  if (!open) return null;

  const handleContainerBase = (size: ContainerSize, value: string) => {
    const num = parseFloat(value) || 0;
    setDraft((d) => ({
      ...d,
      containerBase: { ...d.containerBase, [size]: num },
    }));
  };

  const handleModuleCost = (type: ModuleType, value: string) => {
    const num = parseFloat(value) || 0;
    setDraft((d) => ({
      ...d,
      moduleCosts: { ...d.moduleCosts, [type]: num },
    }));
  };

  const handleField = (field: "cutFee" | "glassSurcharge" | "hingeMechanism", value: string) => {
    const num = parseFloat(value) || 0;
    setDraft((d) => ({ ...d, [field]: num }));
  };

  const handleSave = () => {
    updatePricing(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(defaultPricing as unknown as PricingConfig);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — Stripe Dashboard style */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        style={{ border: '1px solid #e5e7eb' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid #f3f4f6' }}
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Budget Settings</h2>
            <p className="text-sm text-gray-500 mt-0.5">Configure pricing for your project</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable with clean sections */}
        <div className="px-6 py-6 flex flex-col overflow-y-auto" style={{ gap: '0' }}>

          {/* Section: Container Base Costs */}
          <section>
            <h3
              className="text-xs font-semibold text-gray-400 uppercase tracking-wider"
              style={{ marginBottom: '16px' }}
            >
              Container Base Cost
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', alignItems: 'center', gap: '16px 24px' }}>
              {Object.values(ContainerSize).map((size) => (
                <Fragment key={size}>
                  <label className="text-sm font-medium text-gray-700">
                    {CONTAINER_SIZE_LABELS[size]}
                  </label>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-sm text-gray-400">$</span>
                    <input
                      type="number"
                      value={draft.containerBase[size]}
                      onChange={(e) => handleContainerBase(size, e.target.value)}
                      className="w-28 bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono text-gray-900 text-right outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </Fragment>
              ))}
            </div>
          </section>

          <hr className="my-6" style={{ border: 'none', borderTop: '1px solid #f3f4f6' }} />

          {/* Section: Module Costs */}
          <section>
            <h3
              className="text-xs font-semibold text-gray-400 uppercase tracking-wider"
              style={{ marginBottom: '16px' }}
            >
              Module Costs
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', alignItems: 'center', gap: '16px 24px' }}>
              {Object.values(ModuleType).map((type) => (
                <Fragment key={type}>
                  <label className="text-sm font-medium text-gray-700">
                    {MODULE_LABELS[type]}
                  </label>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-sm text-gray-400">$</span>
                    <input
                      type="number"
                      value={draft.moduleCosts[type]}
                      onChange={(e) => handleModuleCost(type, e.target.value)}
                      className="w-28 bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono text-gray-900 text-right outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </Fragment>
              ))}
            </div>
          </section>

          <hr className="my-6" style={{ border: 'none', borderTop: '1px solid #f3f4f6' }} />

          {/* Section: Additional Fees */}
          <section>
            <h3
              className="text-xs font-semibold text-gray-400 uppercase tracking-wider"
              style={{ marginBottom: '16px' }}
            >
              Additional Fees
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', alignItems: 'center', gap: '16px 24px' }}>
              {(
                [
                  ["cutFee", "Structural Cut Fee"],
                  ["glassSurcharge", "Glass Surcharge"],
                  ["hingeMechanism", "Hinge Mechanism"],
                ] as const
              ).map(([field, label]) => (
                <Fragment key={field}>
                  <label className="text-sm font-medium text-gray-700">
                    {label}
                  </label>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-sm text-gray-400">$</span>
                    <input
                      type="number"
                      value={draft[field]}
                      onChange={(e) => handleField(field, e.target.value)}
                      className="w-28 bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono text-gray-900 text-right outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </Fragment>
              ))}
            </div>
          </section>
        </div>

        {/* Footer — Stripe-style */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa' }}
        >
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <RotateCcw size={14} />
            Reset Defaults
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#fff',
                background: '#111827',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1f2937')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#111827')}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
