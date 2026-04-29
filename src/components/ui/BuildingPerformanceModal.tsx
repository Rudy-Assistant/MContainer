"use client";

/**
 * BuildingPerformanceModal — A three-tab modal showing energy, solar, and
 * code-compliance summaries for the current design. All three are derived
 * via pure functions in src/utils/buildingPerformance.ts.
 */

import { useMemo, useState } from 'react';
import { Activity, Sun, ShieldCheck, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  estimateHERSScore,
  estimateSolarPV,
  checkIRCCompliance,
  type IRCRuleStatus,
} from '@/utils/buildingPerformance';
import { useExitTransition } from '@/hooks/useExitTransition';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'energy' | 'solar' | 'code';

const STATUS_COLOR: Record<IRCRuleStatus, string> = {
  pass: 'var(--success)',
  warn: 'var(--warning)',
  fail: 'var(--danger)',
};

export default function BuildingPerformanceModal({ open, onClose }: Props) {
  const containers = useStore((s) => s.containers);
  const [tab, setTab] = useState<Tab>('energy');

  const energy = useMemo(() => estimateHERSScore(containers), [containers]);
  const solar = useMemo(() => estimateSolarPV(containers), [containers]);
  const code = useMemo(() => checkIRCCompliance(containers), [containers]);

  const { mounted, state } = useExitTransition(open, 200);
  if (!mounted) return null;

  return (
    <div data-state={state} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content" style={{
        position: 'relative', background: 'var(--modal-bg)', borderRadius: 12,
        boxShadow: 'var(--panel-shadow)', border: '1px solid var(--border)',
        width: 'min(640px, 92vw)', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', color: 'var(--text-main)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Building Performance</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
          {([
            { id: 'energy' as const, label: 'Energy', Icon: Activity },
            { id: 'solar' as const, label: 'Solar', Icon: Sun },
            { id: 'code' as const, label: 'Code', Icon: ShieldCheck },
          ]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1, padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: tab === id ? 'var(--surface-alt)' : 'transparent',
                color: tab === id ? 'var(--accent)' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1, fontSize: 12, lineHeight: 1.5 }}>
          {tab === 'energy' && (
            <div data-testid="bp-energy">
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>{energy.score}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.08 }}>HERS Index (approximate · lower is tighter)</div>
              <Stat label="UA value" value={`${energy.ua} W/K`} />
              <Stat label="Heating-degree-days" value={`${energy.hdd}`} />
              <Stat label="Estimated annual heating" value={`${energy.annualHeatingKWh.toLocaleString()} kWh`} />
              <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>{energy.caveat}</p>
            </div>
          )}
          {tab === 'solar' && (
            <div data-testid="bp-solar">
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--warning)' }}>{solar.systemKW} kW</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.08 }}>Recommended PV system size</div>
              <Stat label="Annual production" value={`${solar.annualKWh.toLocaleString()} kWh`} />
              <Stat label="Annual savings" value={`$${solar.annualSavingsUSD.toLocaleString()}`} />
              <Stat label="Installed cost (est.)" value={`$${solar.installCostUSD.toLocaleString()}`} />
              <Stat label="Payback" value={Number.isFinite(solar.paybackYears) ? `${solar.paybackYears} years` : '—'} />
              <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                Simplified PVWatts model · 4.5 peak-sun-hours, $0.16/kWh, $3.00/W installed. For a permit-quality estimate use NREL PVWatts directly.
              </p>
            </div>
          )}
          {tab === 'code' && (
            <div data-testid="bp-code">
              {code.map((rule) => (
                <div key={rule.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[rule.status], flexShrink: 0,
                    }} />
                    <strong style={{ fontSize: 12, color: 'var(--text-main)' }}>{rule.description}</strong>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{rule.section}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>{rule.detail}</div>
                </div>
              ))}
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                Subset of IRC 2021 residential code. Always verify with your AHJ — this tool is a design aid, not a permit substitute.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
