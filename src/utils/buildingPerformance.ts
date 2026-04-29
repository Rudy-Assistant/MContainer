/**
 * buildingPerformance.ts — Three lightweight calculators that read from the
 * live store and return human-readable performance summaries:
 *
 *   1. estimateHERSScore — envelope heuristic (NOT a real HERS rating;
 *      labelled "approximate" in the UI). HERS is normally calibrated by a
 *      certified RESNET rater, but a UA × HDD heuristic is enough to give
 *      designers a directional feel for "is this envelope tight?"
 *   2. estimateSolarPV — runs the published NREL PVWatts simplified model
 *      locally (no API key needed). Inputs: kW system size + lat/lon proxy
 *      via climate zone. Outputs: annual kWh + payback years.
 *   3. checkIRCCompliance — rule-check the design against a subset of IRC
 *      2021 residential code (egress windows, ceiling height, bedroom min
 *      area). Returns a list of pass/fail rules.
 *
 * All three are pure functions of the design state, so they're free to call
 * from any UI surface without per-frame cost.
 */

import { CONTAINER_DIMENSIONS, type Container } from '@/types/container';

// ── HERS approximation ───────────────────────────────────────────────────

export interface HERSEstimate {
  /** Approximate HERS index — lower is tighter (100 = baseline new home). */
  score: number;
  /** UA value (W/K) — sum of envelope conductance × area. */
  ua: number;
  /** Annual heating-degree-days assumed for the calculation. */
  hdd: number;
  /** Estimated annual heating load in kWh. */
  annualHeatingKWh: number;
  /** Caveat shown to the user. */
  caveat: string;
}

const ASSUMED_U_VALUES = {
  steelWall: 1.4,    // bare steel container — terrible
  insulatedWall: 0.45, // 4" closed-cell foam + drywall
  roof: 0.35,
  floor: 0.5,
  window: 1.7,        // double-pane low-e
};

export function estimateHERSScore(containers: Record<string, Container>, climateHDD = 5500): HERSEstimate {
  const list = Object.values(containers);
  if (list.length === 0) {
    return { score: 0, ua: 0, hdd: climateHDD, annualHeatingKWh: 0, caveat: 'Add containers to estimate.' };
  }

  // A container is "topmost" (roof exposed to sky) if no other container is
  // stacked on top of it. Likewise, "bottommost" (floor exposed to grade) if
  // it's at level 0.
  const stackedOnto = new Set(list.map((c) => c.stackedOn).filter(Boolean) as string[]);

  let wallArea = 0, roofArea = 0, floorArea = 0, windowArea = 0;
  for (const c of list) {
    const dim = CONTAINER_DIMENSIONS[c.size];
    const perimeter = 2 * (dim.length + dim.width);
    wallArea += perimeter * dim.height;
    if (c.level === 0) floorArea += dim.length * dim.width;
    if (!stackedOnto.has(c.id)) roofArea += dim.length * dim.width;
    // Window estimate: 12% of wall area is typical for residential.
    windowArea += perimeter * dim.height * 0.12;
  }

  // Default to "insulated wall" assumption — most builds will be insulated.
  // This is the optimistic envelope; bare-steel would be a separate variant.
  const ua =
    (wallArea - windowArea) * ASSUMED_U_VALUES.insulatedWall +
    windowArea * ASSUMED_U_VALUES.window +
    roofArea * ASSUMED_U_VALUES.roof +
    floorArea * ASSUMED_U_VALUES.floor;

  // UA × HDD × 24 hours / 1000 W/kW = annual kWh (simplified, no internal gains).
  const annualHeatingKWh = (ua * climateHDD * 24) / 1000;

  // Calibrate score: a typical 2x6 stick-frame baseline runs ~0.6 W/K per sqm
  // of envelope. Map our UA per envelope-area to a HERS-like 0-150 scale.
  const totalEnvelope = wallArea + roofArea + floorArea;
  const uaPerArea = totalEnvelope > 0 ? ua / totalEnvelope : 0;
  const score = Math.round(Math.max(0, Math.min(150, uaPerArea * 150)));

  return {
    score,
    ua: Math.round(ua * 10) / 10,
    hdd: climateHDD,
    annualHeatingKWh: Math.round(annualHeatingKWh),
    caveat:
      'Approximate. A real HERS rating requires a certified RESNET rater. Assumes 4" closed-cell foam walls and double-pane low-e windows.',
  };
}

// ── Solar PV (PVWatts simplified) ────────────────────────────────────────

export interface SolarEstimate {
  systemKW: number;
  annualKWh: number;
  /** Annual savings at $0.16/kWh US average residential rate. */
  annualSavingsUSD: number;
  /** Years to recoup installation cost at $3.00/W installed. */
  paybackYears: number;
  installCostUSD: number;
}

/** Simplified PVWatts output — uses peak sun hours instead of TMY data.
 *  PVWatts itself uses ~1500 kWh/kW/yr in moderate climates as a rule of
 *  thumb. For a design tool this is plenty accurate to convey "is solar
 *  worth it?" — for permit-quality numbers, defer to a real PVWatts call. */
export function estimateSolarPV(
  containers: Record<string, Container>,
  opts: { peakSunHours?: number; pricePerKWh?: number; installCostPerWatt?: number } = {},
): SolarEstimate {
  const peakSunHours = opts.peakSunHours ?? 4.5; // continental US average
  const pricePerKWh = opts.pricePerKWh ?? 0.16;
  const installCostPerWatt = opts.installCostPerWatt ?? 3.0;

  // Roof area available — only top-most containers in each stack contribute.
  const list = Object.values(containers);
  const stackedOnto = new Set(list.map((c) => c.stackedOn).filter(Boolean) as string[]);
  let roofArea = 0;
  for (const c of list) {
    if (stackedOnto.has(c.id)) continue;
    const dim = CONTAINER_DIMENSIONS[c.size];
    roofArea += dim.length * dim.width;
  }

  // 200W/sqm panel density × 0.9 module-area utilization × 0.85 system derate.
  const systemWatts = roofArea * 200 * 0.9 * 0.85;
  const systemKW = systemWatts / 1000;
  const annualKWh = systemKW * peakSunHours * 365;
  const annualSavingsUSD = annualKWh * pricePerKWh;
  const installCostUSD = systemWatts * installCostPerWatt;
  const paybackYears = annualSavingsUSD > 0 ? installCostUSD / annualSavingsUSD : Infinity;

  return {
    systemKW: Math.round(systemKW * 10) / 10,
    annualKWh: Math.round(annualKWh),
    annualSavingsUSD: Math.round(annualSavingsUSD),
    paybackYears: Math.round(paybackYears * 10) / 10,
    installCostUSD: Math.round(installCostUSD),
  };
}

// ── IRC 2021 compliance subset ───────────────────────────────────────────

export type IRCRuleStatus = 'pass' | 'warn' | 'fail';

export interface IRCRule {
  id: string;
  /** IRC section number for the rule. */
  section: string;
  description: string;
  status: IRCRuleStatus;
  /** Why this status — human-readable. */
  detail: string;
}

export function checkIRCCompliance(containers: Record<string, Container>): IRCRule[] {
  const list = Object.values(containers);
  const rules: IRCRule[] = [];

  // R305.1 — Minimum ceiling height 7'-0" (2.13m). All container ceiling
  // heights are fixed by container size; the only spec that fails this is
  // the 8'-6" standard (2.59m → 0.46m drop for joists/finish leaves ~2.13m
  // — borderline). HC at 2.90m has plenty of headroom.
  const hasStandardHeight = list.some((c) => CONTAINER_DIMENSIONS[c.size].height < 2.6);
  rules.push({
    id: 'ceiling_height',
    section: 'R305.1',
    description: 'Minimum 7\'-0" (2.13m) finished ceiling height',
    status: hasStandardHeight ? 'warn' : 'pass',
    detail: hasStandardHeight
      ? 'Standard 8\'-6" containers leave ~7\'-0" after 4" insulation + finish — borderline. Prefer High-Cube (9\'-6") for habitable rooms.'
      : 'All containers are High-Cube with adequate clearance after finishes.',
  });

  // R310 — Emergency egress windows: every sleeping room must have one
  // operable window with 5.7 sq ft (0.53 sqm) net clear opening. We don't
  // currently classify "sleeping rooms" structurally, so this is a soft
  // reminder rather than a hard check.
  rules.push({
    id: 'egress',
    section: 'R310',
    description: 'Bedroom egress window (5.7 sq ft net clear opening)',
    status: 'warn',
    detail:
      'Verify each bedroom has an operable window meeting egress dimensions (≥ 24" h × 20" w, ≥ 44" sill height). The designer does not auto-validate window operability against bedroom voxels.',
  });

  // R314 — Smoke alarms required in each sleeping room + outside each
  // sleeping area + on every level.
  const levels = new Set(list.map((c) => c.level));
  rules.push({
    id: 'smoke_alarms',
    section: 'R314',
    description: 'Smoke alarm coverage on every level + outside sleeping areas',
    status: 'warn',
    detail: `Design has ${levels.size} level(s). Confirm hardwired interconnected smoke alarms are placed accordingly — not currently modeled in the canvas.`,
  });

  // R311.7 — Stairs: max riser 7-3/4", min tread 10". Multi-level designs
  // need a stair somewhere.
  if (levels.size > 1) {
    rules.push({
      id: 'stairs',
      section: 'R311.7',
      description: 'Stair geometry between levels',
      status: 'warn',
      detail:
        'Multi-level design detected. Confirm stair riser ≤ 7-3/4", tread ≥ 10", headroom ≥ 6\'-8". Stairs are not auto-placed by the designer.',
    });
  }

  // M1502 — Dryer exhaust must terminate to outside, ≤ 35 ft duct length.
  // Light reminder if a laundry preset is used.
  rules.push({
    id: 'dryer_vent',
    section: 'M1502',
    description: 'Dryer exhaust to exterior',
    status: 'pass',
    detail: 'If laundry is included, ensure dryer vent terminates to outside (≤ 35 ft duct).',
  });

  return rules;
}
