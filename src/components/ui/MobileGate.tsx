"use client";

/**
 * MobileGate — full-screen takeover shown on sub-tablet viewports (<768px).
 *
 * ModuHome's editor is desktop-first: the 3D viewport + dense sidebar don't
 * fit a phone layout cleanly, and a broken experience is worse than a graceful
 * redirect. The gate lets the user dismiss to a read-only mobile view if they
 * really want to continue, so we never fully block them.
 */

import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;
const STORAGE_KEY = "modu.mobile-gate.dismissed";

export default function MobileGate() {
  const [isMobile, setIsMobile] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    setDismissed(sessionStorage.getItem(STORAGE_KEY) === "1");
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!isMobile || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-label="Open on a larger screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "linear-gradient(160deg, #f8fafc 0%, #eef2f7 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        animation: "mobile-gate-fade 200ms ease-out",
      }}
    >
      <style>{`@keyframes mobile-gate-fade {
        from { opacity: 0; } to { opacity: 1; }
      }`}</style>
      <div
        style={{
          maxWidth: 360,
          width: "100%",
          textAlign: "center",
          background: "#ffffff",
          borderRadius: 16,
          padding: "32px 24px",
          boxShadow: "0 20px 60px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04)",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 16px",
            borderRadius: 14,
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          MH
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
          ModuHome is a desktop tool
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: "#475569", margin: "0 0 20px" }}>
          The 3D editor needs a larger screen to be useful. Please open this on a laptop
          or desktop, or continue in read-only mobile mode.
        </p>
        <button
          onClick={() => {
            sessionStorage.setItem(STORAGE_KEY, "1");
            setDismissed(true);
          }}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            color: "#0f172a",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 150ms ease-out",
          }}
        >
          Continue on mobile anyway
        </button>
      </div>
    </div>
  );
}
