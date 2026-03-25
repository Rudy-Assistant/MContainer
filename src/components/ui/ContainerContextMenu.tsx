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
import { Frame, Layers, ArrowUpFromLine, Footprints } from "lucide-react";
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

  const handleStackAbove = useCallback(() => {
    if (!ctx || !container) return;
    const store = useStore.getState();
    // stackContainer sets the correct Y position, so pass dummy Y here
    const newId = store.addContainer(container.size, { x: container.position.x, y: 0, z: container.position.z }, (container.level ?? 0) + 1, true);
    const success = store.stackContainer(newId, ctx.containerId);
    if (!success) {
      // Stacking failed — remove the orphaned container
      store.removeContainer(newId);
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
