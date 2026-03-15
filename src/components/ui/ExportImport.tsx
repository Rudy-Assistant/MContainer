"use client";

import { useState, useRef } from "react";
import { useStore } from "@/store/useStore";
import { exportSceneToGLB } from "@/utils/exportGLB";

export default function ExportImport() {
  const exportState = useStore((s) => s.exportState);
  const importState = useStore((s) => s.importState);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = exportState();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moduhome-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Exported!");
    setTimeout(() => setStatus(null), 2000);
  };

  const handleCopyToClipboard = () => {
    const json = exportState();
    navigator.clipboard.writeText(json).then(() => {
      setStatus("Copied!");
      setTimeout(() => setStatus(null), 2000);
    });
  };

  const handleImportText = () => {
    if (!importText.trim()) return;
    importState(importText.trim());
    setImportText("");
    setShowImport(false);
    setStatus("Imported!");
    setTimeout(() => setStatus(null), 2000);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        importState(text);
        setStatus("Imported!");
        setTimeout(() => setStatus(null), 2000);
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <button
          onClick={handleExport}
          className="rounded-lg bg-slate-600 hover:bg-slate-500 px-2.5 py-1 text-[10px] font-semibold text-slate-300 transition-colors"
        >
          Export JSON
        </button>
        <button
          onClick={async () => {
            const ok = await exportSceneToGLB();
            setStatus(ok ? "GLB exported!" : "GLB export failed");
            setTimeout(() => setStatus(null), 2000);
          }}
          className="rounded-lg bg-emerald-700 hover:bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 transition-colors"
        >
          Export GLB
        </button>
        <button
          onClick={handleCopyToClipboard}
          className="rounded-lg bg-slate-600 hover:bg-slate-500 px-2.5 py-1 text-[10px] font-semibold text-slate-300 transition-colors"
        >
          Copy
        </button>
        <button
          onClick={() => setShowImport(!showImport)}
          className="rounded-lg bg-slate-600 hover:bg-slate-500 px-2.5 py-1 text-[10px] font-semibold text-slate-300 transition-colors"
        >
          Import
        </button>
      </div>

      {showImport && (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste JSON config here..."
            className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-[10px] text-white placeholder-slate-500 outline-none focus:border-blue-500 resize-none h-16 font-mono"
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleImportText}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors"
            >
              Load JSON
            </button>
            <label className="rounded-lg bg-slate-600 hover:bg-slate-500 px-2.5 py-1 text-[10px] font-semibold text-slate-300 transition-colors cursor-pointer">
              Load File
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {status && (
        <span className="text-[10px] text-green-400 font-semibold">{status}</span>
      )}
    </div>
  );
}
