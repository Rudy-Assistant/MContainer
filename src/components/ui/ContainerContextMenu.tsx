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
import { Frame, Layers, ArrowUpFromLine, Footprints, RotateCw, Copy, Trash2, Palette } from "lucide-react";
import { MAX_STACK_LEVEL, DEFAULT_EXTENSION_CONFIG } from "@/types/container";

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
    const onClick = () => {
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

  const handleStackAbove = useCallback(() => {
    if (!ctx || !container) return;
    const store = useStore.getState();
    const newId = store.addStackedContainer(ctx.containerId);
    if (!newId) {
      closeMenu();
      return;
    }
    store.setAllExtensions(newId, DEFAULT_EXTENSION_CONFIG, false);
    store.setSelectedElements({ type: 'voxel', items: [{ containerId: newId, id: '0' }] });
    closeMenu();
  }, [ctx, container, closeMenu]);

  const handleAddStaircase = useCallback(() => {
    if (!ctx || !container) return;
    const store = useStore.getState();
    store.setStaircasePlacementMode(true, ctx.containerId);
    closeMenu();
  }, [ctx, container, closeMenu]);

  // ── Sprint D3 quad-menu additions ─────────────────────────
  const handleRotate = useCallback(() => {
    if (!ctx || !container) return;
    const store = useStore.getState();
    const next = ((container.rotation ?? 0) + Math.PI / 2) % (Math.PI * 2);
    store.updateContainerRotation(ctx.containerId, next);
    closeMenu();
  }, [ctx, container, closeMenu]);

  const handleDuplicate = useCallback(() => {
    if (!ctx) return;
    useStore.getState().duplicateContainer(ctx.containerId);
    closeMenu();
  }, [ctx, closeMenu]);

  const handleDelete = useCallback(() => {
    if (!ctx) return;
    useStore.getState().removeContainer(ctx.containerId);
    closeMenu();
  }, [ctx, closeMenu]);

  const handlePaint = useCallback(() => {
    if (!ctx) return;
    // Selection-drives-Inspector: selecting this container opens the
    // Inspector's finishes panel so the user can paint surfaces.
    const store = useStore.getState();
    store.setSelectedElements({ type: 'voxel', items: [{ containerId: ctx.containerId, id: '0' }] });
    closeMenu();
  }, [ctx, closeMenu]);

  // Check if stacking is possible (not already at max level)
  const canStack = container ? (container.level ?? 0) < MAX_STACK_LEVEL : false;

  // Check if container has a stacked container above (needed for staircase placement)
  const hasContainerAbove = container ? (container.supporting?.length ?? 0) > 0 : false;

  // Check if container already has stairs placed
  const hasStairs = container?.voxelGrid?.some((v) => v?.voxelType === 'stairs') ?? false;

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

        {/* Sprint D3 quad-action row: Rotate / Duplicate / Paint / Delete.
            These are the 4 most-used contextual verbs per the industry-
            comparison brief; surfaced visually as a compact icon row at
            the top of the menu so they're one click from right-click. */}
        <div className="flex gap-1 px-2 py-2 border-b border-gray-100">
          <button
            onClick={handleRotate}
            title="Rotate 90°"
            data-testid="quad-rotate"
            className="flex-1 flex items-center justify-center py-2 rounded-md hover:bg-blue-50 text-gray-600 hover:text-blue-700 transition-colors"
          >
            <RotateCw size={16} />
          </button>
          <button
            onClick={handleDuplicate}
            title="Duplicate (Ctrl+D)"
            data-testid="quad-duplicate"
            className="flex-1 flex items-center justify-center py-2 rounded-md hover:bg-blue-50 text-gray-600 hover:text-blue-700 transition-colors"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={handlePaint}
            title="Paint surfaces"
            data-testid="quad-paint"
            className="flex-1 flex items-center justify-center py-2 rounded-md hover:bg-blue-50 text-gray-600 hover:text-blue-700 transition-colors"
          >
            <Palette size={16} />
          </button>
          <button
            onClick={handleDelete}
            title="Delete container"
            data-testid="quad-delete"
            className="flex-1 flex items-center justify-center py-2 rounded-md hover:bg-red-50 text-gray-600 hover:text-red-700 transition-colors"
          >
            <Trash2 size={16} />
          </button>
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
          {canStack && (
            <button
              onClick={handleStackAbove}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <ArrowUpFromLine size={15} className="text-gray-400" />
              Stack Container Above
            </button>
          )}
          {hasContainerAbove && (
            <>
              <div className="border-t border-gray-100 mx-2" />
              {hasStairs ? (
                <div className="w-full flex items-center gap-3 px-3 py-2 text-xs text-gray-400 cursor-default">
                  <Footprints size={15} className="text-gray-300" />
                  Staircase Placed
                </div>
              ) : (
                <button
                  onClick={handleAddStaircase}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <Footprints size={15} className="text-gray-400" />
                  Add Staircase
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
