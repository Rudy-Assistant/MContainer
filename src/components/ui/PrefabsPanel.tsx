"use client";

/**
 * PrefabsPanel.tsx — Component-snap prefab module UI surface.
 *
 * Brainstorm "Deferred for later" item #1: Figma-style prefab modules.
 * The user selects N containers, names the assembly, then re-spawns
 * fresh copies anywhere on the canvas with relative-position preservation.
 *
 * Slice: src/store/slices/prefabSlice.ts
 *   - savePrefabFromSelection(label) — captures current selection
 *   - spawnPrefab(prefabId, origin) — drops fresh copies at origin
 *   - removePrefab / renamePrefab — registry management
 *
 * Spawn position policy: scene origin (0, 0, 0). The spawned prefab's
 * relative positions take it from there. Future revision could read
 * the camera's look-at target — kept simple for v1 so the affordance
 * is reachable without overengineering placement.
 */

import { useCallback, useState } from "react";
import { useStore } from "@/store/useStore";
import { Trash2, Save, Plus } from "lucide-react";

const TEXT     = "#1e293b";
const TEXT_DIM = "#64748b";
const BORDER   = "#e2e8f0";
const CARD     = "#ffffff";
const ACCENT   = "#7c3aed"; // violet — distinct from blue (structure) / green (interior)
const DANGER   = "#ef4444";

export function PrefabsPanel() {
  const selection = useStore((s) => s.selection);
  const prefabModules = useStore((s) => s.prefabModules);
  const savePrefab = useStore((s) => s.savePrefabFromSelection);
  const spawnPrefab = useStore((s) => s.spawnPrefab);
  const removePrefab = useStore((s) => s.removePrefab);

  const [labelDraft, setLabelDraft] = useState("");

  const handleSave = useCallback(() => {
    const label = labelDraft.trim() || `Prefab ${Object.keys(prefabModules).length + 1}`;
    const id = savePrefab(label);
    if (id) setLabelDraft("");
  }, [labelDraft, prefabModules, savePrefab]);

  const handleSpawn = useCallback(
    (prefabId: string) => {
      spawnPrefab(prefabId, [0, 0, 0]);
    },
    [spawnPrefab]
  );

  const prefabs = Object.values(prefabModules);
  const canSave = selection.length > 0;

  return (
    <div data-testid="prefabs-panel" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{
        fontSize: "9px", fontWeight: 700, color: TEXT_DIM,
        textTransform: "uppercase", letterSpacing: "0.08em", padding: "6px 0 3px",
      }}>
        Prefabs
      </div>

      {/* Save current selection as a prefab */}
      <div style={{
        display: "flex", gap: "4px", padding: "8px",
        borderRadius: "8px", border: `1px dashed ${canSave ? ACCENT : BORDER}`,
        background: canSave ? `${ACCENT}08` : "transparent",
        alignItems: "center",
      }}>
        <input
          data-testid="prefab-label-input"
          type="text"
          placeholder={canSave ? "Name this prefab…" : "Select containers first"}
          value={labelDraft}
          disabled={!canSave}
          onChange={(e) => setLabelDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canSave) handleSave(); }}
          style={{
            flex: 1, padding: "5px 8px", fontSize: "11px",
            borderRadius: "6px", border: `1px solid ${BORDER}`,
            background: canSave ? CARD : "transparent",
            color: TEXT, outline: "none",
          }}
        />
        <button
          data-testid="prefab-save-btn"
          onClick={handleSave}
          disabled={!canSave}
          title={canSave ? `Save ${selection.length} container${selection.length > 1 ? "s" : ""} as prefab` : "Select containers first"}
          style={{
            padding: "5px 8px", fontSize: "11px", fontWeight: 600,
            display: "flex", alignItems: "center", gap: "4px",
            borderRadius: "6px", border: `1px solid ${canSave ? ACCENT : BORDER}`,
            background: canSave ? ACCENT : "transparent",
            color: canSave ? "#fff" : TEXT_DIM,
            cursor: canSave ? "pointer" : "not-allowed",
          }}
        >
          <Save size={12} /> Save
        </button>
      </div>

      {/* Saved-prefab list */}
      {prefabs.length === 0 ? (
        <div style={{ fontSize: "11px", color: TEXT_DIM, textAlign: "center", padding: "8px 0" }}>
          No prefabs yet. Select containers and save above.
        </div>
      ) : (
        prefabs.map((p) => (
          <div
            key={p.id}
            data-testid={`prefab-card-${p.id}`}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 8px", borderRadius: "8px",
              border: `1px solid ${BORDER}`, background: CARD,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.label}
              </div>
              <div style={{ fontSize: "10px", color: TEXT_DIM }}>
                {p.containers.length} container{p.containers.length !== 1 ? "s" : ""}
              </div>
            </div>
            <button
              data-testid={`prefab-spawn-${p.id}`}
              onClick={() => handleSpawn(p.id)}
              title="Spawn at scene origin"
              style={{
                padding: "4px 8px", fontSize: "11px", fontWeight: 600,
                display: "flex", alignItems: "center", gap: "3px",
                borderRadius: "6px", border: `1px solid ${ACCENT}`,
                background: `${ACCENT}10`, color: ACCENT, cursor: "pointer",
              }}
            >
              <Plus size={12} /> Spawn
            </button>
            <button
              data-testid={`prefab-delete-${p.id}`}
              onClick={() => removePrefab(p.id)}
              title="Delete prefab"
              style={{
                padding: "4px", borderRadius: "6px",
                border: "none", background: "transparent",
                color: DANGER, cursor: "pointer",
                display: "flex", alignItems: "center",
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
