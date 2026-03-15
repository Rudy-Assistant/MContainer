"use client";

/**
 * FaceContextMenu.tsx — Right-click context menu for active voxel faces.
 * Shows surface-appropriate actions (toggle open, clear, cycle wood/wall types).
 */

import { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { type SurfaceType, type VoxelFaces } from "@/types/container";

// ── Action definitions ──────────────────────────────────────

function getActions(surface: SurfaceType, face: keyof VoxelFaces): Array<{ label: string; action: () => void }> {
  const store = useStore.getState();
  const ctx = store.faceContextMenuCtx;
  if (!ctx) return [];
  const { containerId, voxelIndex } = ctx;

  const clearFace = () => {
    store.setVoxelFace(containerId, voxelIndex, face, 'Open');
    store.setFaceContextMenuCtx(null);
  };
  const setFace = (s: SurfaceType) => {
    store.setVoxelFace(containerId, voxelIndex, face, s);
    store.setFaceContextMenuCtx(null);
  };
  const toggleOpen = () => {
    store.toggleOpenFace(containerId, voxelIndex, face);
    store.setFaceContextMenuCtx(null);
  };

  switch (surface) {
    case 'Door':
    case 'Glass_Shoji': {
      const voxel = store.containers[containerId]?.voxelGrid?.[voxelIndex];
      const doorState = voxel?.doorStates?.[face] ?? 'closed';
      const stateLabel = doorState === 'closed' ? 'Closed' : doorState === 'open_swing' ? 'Swing Open' : 'Slide Open';
      const toggleDoor = () => {
        store.toggleDoorState(containerId, voxelIndex, face);
        store.setFaceContextMenuCtx(null);
      };
      return [
        { label: `Toggle Door (${stateLabel})`, action: toggleDoor },
        { label: "Clear face", action: clearFace },
      ];
    }
    case 'Railing_Glass':
      return [
        { label: "Switch to Cable Rail", action: () => setFace('Railing_Cable') },
        { label: "Clear face", action: clearFace },
      ];
    case 'Railing_Cable':
      return [
        { label: "Switch to Glass Rail", action: () => setFace('Railing_Glass') },
        { label: "Clear face", action: clearFace },
      ];
    case 'Stairs':
      return [
        { label: "Flip direction (Stairs ↓)", action: () => setFace('Stairs_Down') },
        { label: "Clear face", action: clearFace },
      ];
    case 'Stairs_Down':
      return [
        { label: "Flip direction (Stairs ↑)", action: () => setFace('Stairs') },
        { label: "Clear face", action: clearFace },
      ];
    case 'Deck_Wood':
    case 'Wood_Hinoki':
    case 'Floor_Tatami':
      return [
        { label: "Deck Wood",    action: () => setFace('Deck_Wood') },
        { label: "Hinoki Cedar", action: () => setFace('Wood_Hinoki') },
        { label: "Tatami Mat",   action: () => setFace('Floor_Tatami') },
        { label: "Clear face",   action: clearFace },
      ];
    case 'Solid_Steel':
    case 'Wall_Washi':
    case 'Glass_Pane':
      return [
        { label: "Steel",   action: () => setFace('Solid_Steel') },
        { label: "Washi",   action: () => setFace('Wall_Washi') },
        { label: "Glass",   action: () => setFace('Glass_Pane') },
        { label: "Clear face", action: clearFace },
      ];
    case 'Open':
      return [
        { label: "Set to Steel",   action: () => setFace('Solid_Steel') },
        { label: "Set to Glass",   action: () => setFace('Glass_Pane') },
        { label: "Set to Door",    action: () => setFace('Door') },
        { label: "Set to Shoji",   action: () => setFace('Glass_Shoji') },
        { label: "Set to Washi",   action: () => setFace('Wall_Washi') },
        { label: "Set to Railing", action: () => setFace('Railing_Cable') },
      ];
    default:
      return [
        { label: "Clear face", action: clearFace },
      ];
  }
}

// ── FaceContextMenu ─────────────────────────────────────────

export default function FaceContextMenu() {
  const ctx = useStore((s) => s.faceContextMenuCtx);
  const setCtx = useStore((s) => s.setFaceContextMenuCtx);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!ctx) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCtx(null); };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCtx(null);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [ctx, setCtx]);

  if (!ctx) return null;

  const actions = getActions(ctx.surface, ctx.face);
  if (actions.length === 0) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: ctx.screenX,
        top: ctx.screenY,
        zIndex: 9000,
        background: "#fff",
        borderRadius: "8px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        border: "1px solid #e5e7eb",
        padding: "4px 0",
        minWidth: "160px",
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
      }}
    >
      {/* Surface label header */}
      <div style={{
        padding: "5px 12px 4px",
        fontSize: "10px",
        fontWeight: 600,
        color: "#9ca3af",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        borderBottom: "1px solid #f3f4f6",
        marginBottom: "2px",
      }}>
        {ctx.surface.replace(/_/g, " ")} — {ctx.face.toUpperCase()}
      </div>

      {actions.map((a, i) => (
        <button
          key={i}
          onClick={a.action}
          style={{
            display: "block",
            width: "100%",
            padding: "6px 12px",
            textAlign: "left",
            fontSize: "13px",
            color: "#374151",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            transition: "background 80ms",
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#eff6ff"; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
