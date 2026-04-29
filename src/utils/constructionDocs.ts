/**
 * constructionDocs.ts — Construction document export.
 *
 * Two outputs:
 * 1. Cost-breakdown CSV — line-item bill of materials with quantities + unit
 *    prices, suitable for handing to a contractor / estimator.
 * 2. PDF report — opens a styled printable report in a new window. The user
 *    saves it via the browser's print-to-PDF (zero npm dependencies, works
 *    offline). The report includes: cover page, room-by-room summary,
 *    BOM table, cost breakdown, and the cost range (low/high).
 */

import { useStore } from '@/store/useStore';
import {
  CONTAINER_DIMENSIONS,
  type Container,
  FURNITURE_CATALOG,
  FurnitureType,
} from '@/types/container';
import { downloadBlob } from '@/utils/downloadBlob';
import { getCabinetTemplate } from '@/config/cabinetTemplates';
import { getCabinetrySkin } from '@/config/cabinetrySkins';
import { getCounterTopMaterial } from '@/config/counterTopMaterials';
import { getFixtureTemplate } from '@/config/fixtureTemplates';
import { getDecorTemplate } from '@/config/decorTemplates';
import { getShelfTemplate } from '@/config/shelfTemplates';
import { getFloorOverlay, getCeilingOverlay } from '@/config/floorOverlays';

interface BomLine {
  category: string;
  item: string;
  qty: number;
  unitPriceUSD: number;
  totalUSD: number;
}

/** Walk the design and emit a flat BOM. */
export function buildBOM(): BomLine[] {
  const state = useStore.getState();
  const containers = Object.values(state.containers) as Container[];
  const lines: BomLine[] = [];

  for (const c of containers) {
    // Container shell
    const dims = CONTAINER_DIMENSIONS[c.size];
    lines.push({
      category: 'Container Shell',
      item: `${c.size} (${dims.length.toFixed(2)} × ${dims.width.toFixed(2)} × ${dims.height.toFixed(2)} m)`,
      qty: 1,
      unitPriceUSD: state.pricing.containerBase[c.size] ?? 0,
      totalUSD: state.pricing.containerBase[c.size] ?? 0,
    });

    if (!c.voxelGrid) continue;

    // Per-voxel overlays
    for (const voxel of c.voxelGrid) {
      if (!voxel?.active) continue;
      for (const face of ['n', 's', 'e', 'w'] as const) {
        const sh = voxel.shelfConfig?.[face];
        if (sh) {
          const t = getShelfTemplate(sh.template);
          lines.push({ category: 'Shelving', item: `${t.label} (${getCabinetrySkin(sh.skin).label})`, qty: 1, unitPriceUSD: t.costUSD, totalUSD: t.costUSD });
        }
        const cab = voxel.cabinetConfig?.[face];
        if (cab) {
          const t = getCabinetTemplate(cab.template);
          const skin = getCabinetrySkin(cab.skin);
          const mirrorMul = skin.mirrorDoors ? 1.3 : 1.0;
          const cabTotal = t.costUSD * mirrorMul;
          lines.push({ category: 'Cabinetry', item: `${t.label} (${skin.label}${skin.mirrorDoors ? ' — mirror upcharge +30%' : ''})`, qty: 1, unitPriceUSD: cabTotal, totalUSD: cabTotal });
          if (cab.counterTop) {
            const ct = getCounterTopMaterial(cab.counterTop);
            lines.push({ category: 'Counter Top', item: ct.label, qty: 1, unitPriceUSD: ct.costPerSlabUSD, totalUSD: ct.costPerSlabUSD });
          }
          if (cab.underCabinetLight) {
            lines.push({ category: 'Lighting', item: 'Under-cabinet LED strip', qty: 1, unitPriceUSD: 60, totalUSD: 60 });
          }
        }
        const fx = voxel.fixtureConfig?.[face];
        if (fx) {
          const t = getFixtureTemplate(fx.template);
          lines.push({ category: t.kind === 'appliance' ? 'Appliances' : 'Bathroom Fixtures', item: t.label, qty: 1, unitPriceUSD: t.costUSD, totalUSD: t.costUSD });
        }
        const dec = voxel.decorConfig?.[face];
        if (dec) {
          const t = getDecorTemplate(dec.template);
          lines.push({ category: 'Decor', item: t.label, qty: 1, unitPriceUSD: t.costUSD, totalUSD: t.costUSD });
          if (dec.pictureLight) {
            lines.push({ category: 'Lighting', item: 'Picture light', qty: 1, unitPriceUSD: 80, totalUSD: 80 });
          }
        }
      }
      // Top + bottom horizontal overlays
      const fl = voxel.floorOverlay?.bottom;
      if (fl) {
        const t = getFloorOverlay(fl.template);
        lines.push({ category: 'Floor Overlays', item: t.label, qty: 1, unitPriceUSD: t.costUSD, totalUSD: t.costUSD });
      }
      const ce = voxel.ceilingOverlay?.top;
      if (ce) {
        const t = getCeilingOverlay(ce.template);
        lines.push({ category: 'Ceiling Fixtures', item: t.label, qty: 1, unitPriceUSD: t.costUSD, totalUSD: t.costUSD });
      }
    }

    // Furniture
    for (const f of c.furniture ?? []) {
      const cat = FURNITURE_CATALOG.find((e) => e.type === f.type);
      if (!cat) continue;
      lines.push({
        category: 'Furniture',
        item: cat.label,
        qty: 1,
        unitPriceUSD: cat.cost,
        totalUSD: cat.cost,
      });
    }
  }

  // Aggregate identical lines into qty groups
  const aggregated = new Map<string, BomLine>();
  for (const line of lines) {
    const key = `${line.category}::${line.item}::${line.unitPriceUSD}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.qty += line.qty;
      existing.totalUSD += line.totalUSD;
    } else {
      aggregated.set(key, { ...line });
    }
  }
  return Array.from(aggregated.values()).sort((a, b) => a.category.localeCompare(b.category) || a.item.localeCompare(b.item));
}

/** Emit a CSV string. */
export function buildBomCSV(): string {
  const bom = buildBOM();
  const header = 'Category,Item,Qty,Unit Price (USD),Total (USD)';
  const rows = bom.map((l) =>
    [
      JSON.stringify(l.category),
      JSON.stringify(l.item),
      l.qty,
      l.unitPriceUSD.toFixed(2),
      l.totalUSD.toFixed(2),
    ].join(',')
  );
  const grandTotal = bom.reduce((s, l) => s + l.totalUSD, 0);
  rows.push(`,,,Total,${grandTotal.toFixed(2)}`);
  return [header, ...rows].join('\n');
}

/** Trigger CSV download. */
export function downloadBomCSV(filename = `moduhome-bom-${new Date().toISOString().slice(0, 10)}.csv`): void {
  const csv = buildBomCSV();
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}

/** Open a print-ready HTML report in a new window. */
export function openPrintableReport(): void {
  if (typeof window === 'undefined') return;
  const state = useStore.getState();
  const bom = buildBOM();
  const grandTotal = bom.reduce((s, l) => s + l.totalUSD, 0);
  const estimate = state.getEstimate();
  const containers = Object.values(state.containers) as Container[];

  const totalSqM = containers.reduce((s, c) => {
    const dims = CONTAINER_DIMENSIONS[c.size];
    return s + dims.length * dims.width;
  }, 0);

  const fmt = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>ModuHome Construction Documents</title>
<style>
  @page { size: letter; margin: 0.75in; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: #1a1a1c; line-height: 1.5; }
  h1 { font-size: 28px; margin: 0 0 6px; letter-spacing: -0.02em; }
  h2 { font-size: 18px; margin: 32px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #1a1a1c; letter-spacing: -0.01em; }
  h3 { font-size: 14px; margin: 16px 0 4px; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; padding: 6px 8px; background: #f0f0f0; border-bottom: 1px solid #ccc; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .summary-row { display: flex; gap: 24px; margin-top: 12px; }
  .summary-card { flex: 1; padding: 12px 16px; background: #fafafa; border: 1px solid #eee; border-radius: 6px; }
  .summary-card .num { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
  .summary-card .label { font-size: 10px; text-transform: uppercase; color: #666; letter-spacing: 0.06em; }
  .footer { margin-top: 48px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 9px; color: #888; }
  .grand { font-weight: 700; font-size: 14px; }
  @media print {
    body { font-size: 11px; }
    h2 { page-break-after: avoid; }
    tr { page-break-inside: avoid; }
  }
</style></head>
<body>
  <h1>ModuHome — Construction Documents</h1>
  <div style="font-size: 11px; color: #666; margin-bottom: 24px;">Generated ${new Date().toLocaleString()}</div>

  <div class="summary-row">
    <div class="summary-card"><div class="label">Containers</div><div class="num">${containers.length}</div></div>
    <div class="summary-card"><div class="label">Floor area</div><div class="num">${totalSqM.toFixed(1)} m²</div></div>
    <div class="summary-card"><div class="label">Estimated cost</div><div class="num">${fmt(estimate.breakdown.total)}</div></div>
    <div class="summary-card"><div class="label">Range (low–high)</div><div class="num" style="font-size:14px">${fmt(estimate.low)} – ${fmt(estimate.high)}</div></div>
  </div>

  <h2>Cost Breakdown</h2>
  <table>
    <tr><th>Category</th><th class="num">Subtotal (USD)</th></tr>
    <tr><td>Container shell + frame</td><td class="num">${fmt(estimate.breakdown.containers)}</td></tr>
    <tr><td>Modules (cuts, doors, windows)</td><td class="num">${fmt(estimate.breakdown.modules)}</td></tr>
    <tr><td>Cuts (structural fees)</td><td class="num">${fmt(estimate.breakdown.cuts)}</td></tr>
    ${estimate.breakdown.sceneObjects ? `<tr><td>Scene objects</td><td class="num">${fmt(estimate.breakdown.sceneObjects)}</td></tr>` : ''}
    ${estimate.breakdown.overlays ? `<tr><td>Overlays (cabinets, fixtures, decor, counter tops)</td><td class="num">${fmt(estimate.breakdown.overlays)}</td></tr>` : ''}
    <tr class="grand"><td>Total (target)</td><td class="num">${fmt(estimate.breakdown.total)}</td></tr>
  </table>

  <h2>Bill of Materials</h2>
  <table>
    <tr><th>Category</th><th>Item</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Total</th></tr>
    ${bom.map((l) => `
      <tr>
        <td>${escapeHtml(l.category)}</td>
        <td>${escapeHtml(l.item)}</td>
        <td class="num">${l.qty}</td>
        <td class="num">${fmt(l.unitPriceUSD)}</td>
        <td class="num">${fmt(l.totalUSD)}</td>
      </tr>`).join('')}
    <tr class="grand"><td colspan="4">Grand Total</td><td class="num">${fmt(grandTotal)}</td></tr>
  </table>

  <div class="footer">
    ModuHome design export — figures are estimates suitable for budgeting, not binding quotes.
    Actual costs vary with location, contractor, finishes, and code requirements. Container shell
    pricing assumes used 1-trip ISO containers in good condition.
  </div>

  <script>
    // Auto-trigger print dialog so the user can save as PDF.
    window.addEventListener('load', () => setTimeout(() => window.print(), 350));
  </script>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) {
    alert('Could not open print window — please allow pop-ups for this site.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Convenience: count of FurnitureType usage (used by quote/order flow). */
export function getFurnitureSummary(): { type: FurnitureType; label: string; count: number; totalCost: number }[] {
  const state = useStore.getState();
  const containers = Object.values(state.containers) as Container[];
  const counts = new Map<FurnitureType, number>();
  for (const c of containers) {
    for (const f of c.furniture ?? []) {
      counts.set(f.type, (counts.get(f.type) ?? 0) + 1);
    }
  }
  const out: { type: FurnitureType; label: string; count: number; totalCost: number }[] = [];
  for (const [type, count] of counts) {
    const cat = FURNITURE_CATALOG.find((e) => e.type === type);
    if (!cat) continue;
    out.push({ type, label: cat.label, count, totalCost: cat.cost * count });
  }
  return out.sort((a, b) => b.totalCost - a.totalCost);
}
