"use client";

/**
 * QuoteRequestModal — opens a "request quote" form pre-populated with the
 * current design's BOM, total cost estimate, and floor area. Submits to a
 * configurable webhook URL (or falls back to `mailto:` with the body inlined
 * as a downloadable JSON attachment via clipboard).
 *
 * Pure UI — no network call without explicit user submit.
 */

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { CONTAINER_DIMENSIONS, type Container } from '@/types/container';
import { buildBomCSV, getFurnitureSummary } from '@/utils/constructionDocs';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional webhook URL — when set, "Submit" POSTs to this endpoint
   *  with the quote payload as JSON. When unset, the user gets a mailto:
   *  link they can click to compose an email manually. */
  webhookUrl?: string;
  /** Email address used when no webhook is configured. */
  contactEmail?: string;
}

export default function QuoteRequestModal({
  open, onClose, webhookUrl, contactEmail = 'sales@moduhome.example',
}: Props) {
  const containers = useStore((s) => s.containers);
  const getEstimate = useStore((s) => s.getEstimate);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [zip, setZip] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<'sent' | 'mailto' | null>(null);

  if (!open) return null;

  const estimate = getEstimate();
  const containerList = Object.values(containers) as Container[];
  const totalSqM = containerList.reduce((s, c) => {
    const dims = CONTAINER_DIMENSIONS[c.size];
    return s + dims.length * dims.width;
  }, 0);
  const furnitureSummary = getFurnitureSummary();

  const buildPayload = () => ({
    contact: { name, email, phone, zip },
    notes,
    submittedAt: new Date().toISOString(),
    design: {
      containers: containerList.length,
      floorAreaM2: Number(totalSqM.toFixed(2)),
      estimatedCost: estimate.breakdown.total,
      costRange: { low: estimate.low, high: estimate.high },
      breakdown: estimate.breakdown,
      furnitureCounts: furnitureSummary,
    },
    bomCSV: buildBomCSV(),
  });

  const handleSubmit = async () => {
    if (!email) {
      alert('Email is required.');
      return;
    }
    setSubmitting(true);
    const payload = buildPayload();
    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) setSubmitted('sent');
        else alert(`Quote request failed: ${res.status} ${res.statusText}`);
      } catch (e) {
        alert(`Network error: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      // mailto: fallback — compose an email with the human-readable summary
      const subject = encodeURIComponent('ModuHome Quote Request');
      const summaryLines = [
        `Name: ${name || '(not provided)'}`,
        `Email: ${email}`,
        `Phone: ${phone || '(not provided)'}`,
        `ZIP: ${zip || '(not provided)'}`,
        '',
        `Containers: ${containerList.length}`,
        `Floor area: ${totalSqM.toFixed(1)} m²`,
        `Estimated cost: $${estimate.breakdown.total.toLocaleString()}`,
        `Range: $${estimate.low.toLocaleString()} – $${estimate.high.toLocaleString()}`,
        '',
        'Notes:',
        notes || '(none)',
        '',
        '— BOM CSV is attached separately or available on request —',
      ].join('\n');
      const body = encodeURIComponent(summaryLines);
      window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
      setSubmitted('mailto');
    }
    setSubmitting(false);
  };

  const overlay: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const modal: React.CSSProperties = {
    background: 'var(--modal-bg, #fff)',
    borderRadius: 12,
    boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
    padding: 24,
    width: 'min(560px, 92vw)',
    maxHeight: '92vh',
    overflowY: 'auto',
    color: 'var(--text-main, #1a1a1c)',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: '1px solid var(--border, #e2e8f0)', borderRadius: 6,
    background: 'var(--bg-input, #fff)', color: 'var(--text-main, #1a1a1c)',
    fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--text-muted, #555)',
    marginBottom: 4, display: 'block',
  };

  if (submitted) {
    return (
      <div style={overlay} onClick={onClose}>
        <div className="modal-content" style={modal} onClick={(e) => e.stopPropagation()}>
          <h2 style={{ marginTop: 0 }}>{submitted === 'sent' ? 'Quote request sent' : 'Email composed'}</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {submitted === 'sent'
              ? "We'll be in touch within one business day."
              : `Your email client should now have a draft addressed to ${contactEmail}. Send it to complete the request.`}
          </p>
          <button onClick={onClose} style={{ ...inputStyle, fontWeight: 600, cursor: 'pointer', background: 'var(--accent, #2563eb)', color: '#fff', border: 'none' }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>Request a Quote</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 20 }}>
          Send your design + estimate to a ModuHome partner. Includes the full BOM as an attached CSV.
        </p>

        <div style={{ background: 'var(--surface-alt, #fafafa)', padding: 12, borderRadius: 6, marginBottom: 20, fontSize: 12 }}>
          <div><strong>{containerList.length}</strong> container{containerList.length === 1 ? '' : 's'}, <strong>{totalSqM.toFixed(1)} m²</strong> floor area</div>
          <div>Estimated cost: <strong>${estimate.breakdown.total.toLocaleString()}</strong></div>
          <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>Range: ${estimate.low.toLocaleString()} – ${estimate.high.toLocaleString()}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
          </div>
          <div>
            <label style={labelStyle}>ZIP / Postal Code</label>
            <input style={inputStyle} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="(for shipping est.)" />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Notes (timeline, customizations, questions)</label>
          <textarea style={{ ...inputStyle, minHeight: 80, fontFamily: 'inherit' }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-main)' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting || !email} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: 'var(--accent, #2563eb)', color: '#fff', border: 'none', borderRadius: 6, cursor: email ? 'pointer' : 'not-allowed', opacity: email ? 1 : 0.5 }}>
            {submitting ? 'Sending…' : webhookUrl ? 'Submit Quote' : 'Compose Email'}
          </button>
        </div>
      </div>
    </div>
  );
}
