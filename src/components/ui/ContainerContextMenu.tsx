"use client";

/**
 * ContainerContextMenu — Small floating right-click menu for container-level actions.
 *
 * Appears when right-clicking on a container body/frame (not a bay panel).
 * Offers "Edit Structure" and "Configure Floor" options that open the
 * corresponding detail editor modals.
 */

import { useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { Frame, Layers } from "lucide-react";

export default function ContainerContextMenu() {
  const ctx = useStore((s) => s.containerContextMenu);
  const containers = useStore((s) => s.containers);
  const closeMenu = useStore((s) => s.closeContainerContextMenu);
  const openStructureEditor = useStore((s) => s.openStructureEditor);
  const openFloorDetail = useStore((s) => s.openFloorDetail);

  const container = ctx ? containers[ctx.containerId] : null;

  // Close on ESC or click outside
  useEffect(() => {
    if (!ctx) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    const onClick = (e: MouseEvent) => {
      closeMenu();
    };
    window.addEventListener("keydown", onKey);
    // Delay click listener to avoid closing immediately from the triggering right-click
    const timer = setTimeout(() => {
      window.addEventListener("mousedown", onClick);
    }, 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
      clearTimeout(timer);
    };
  }, [ctx, closeMenu]);

  const handleEditStructure = useCallback(() => {
    if (!ctx) return;
    openStructureEditor(ctx.containerId);
    closeMenu();
  }, [ctx, openStructureEditor, closeMenu]);

  const handleConfigureFloor = useCallback(() => {
    if (!ctx) return;
    openFloorDetail(ctx.containerId);
    closeMenu();
  }, [ctx, openFloorDetail, closeMenu]);

  if (!ctx || !container) return null;

  // Clamp position to viewport
  const pad = 16;
  const menuW = 200;
  const menuH = 100;
  const x = Math.min(ctx.x, window.innerWidth - menuW - pad);
  const y = Math.min(ctx.y, window.innerHeight - menuH - pad);

  return (
    <div
      className="fixed z-50"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(0, 0, 0, 0.08)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)",
        }}
      >
        {/* Container name header */}
        <div className="px-3 py-2 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500 truncate block max-w-[180px]">
            {container.name}
          </span>
        </div>

        {/* Menu items */}
        <div className="py-1">
          <button
            onClick={handleEditStructure}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <Frame size={15} className="text-gray-400" />
            Edit Structure
          </button>
          <button
            onClick={handleConfigureFloor}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <Layers size={15} className="text-gray-400" />
            Configure Floor
          </button>
        </div>
      </div>
    </div>
  );
}
