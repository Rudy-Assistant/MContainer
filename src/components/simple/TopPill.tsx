'use client';
import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Undo2, Redo2, Save, Settings } from 'lucide-react';

export default function TopPill() {
  const [menuOpen, setMenuOpen] = useState(false);
  const setUiMode = useStore((s) => s.setUiMode);

  const handleUndo = () => {
    (useStore as any).temporal?.getState()?.undo();
  };

  const handleRedo = () => {
    (useStore as any).temporal?.getState()?.redo();
  };

  const handleSave = () => {
    // Already auto-saved via persist middleware
    // Show brief visual feedback
  };

  return (
    <div style={{
      position: 'fixed',
      top: 12,
      right: 12,
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(12px)',
      borderRadius: 24,
      padding: '4px 8px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
      border: '1px solid var(--border, #e2e8f0)',
    }}>
      {[
        { icon: <Undo2 size={18} />, onClick: handleUndo, title: 'Undo (Ctrl+Z)' },
        { icon: <Redo2 size={18} />, onClick: handleRedo, title: 'Redo (Ctrl+Y)' },
        { icon: <Save size={18} />, onClick: handleSave, title: 'Auto-saved' },
        { icon: <Settings size={18} />, onClick: () => setMenuOpen(!menuOpen), title: 'Settings' },
      ].map((btn, i) => (
        <button
          key={i}
          onClick={btn.onClick}
          title={btn.title}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted, #64748b)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(0,0,0,0.06)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
        >
          {btn.icon}
        </button>
      ))}

      {/* Settings dropdown */}
      {menuOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 8,
          background: 'var(--surface, #ffffff)',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          border: '1px solid var(--border, #e2e8f0)',
          padding: 8,
          minWidth: 180,
        }}>
          <button
            onClick={() => { setUiMode('advanced'); setMenuOpen(false); }}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-main, #0f172a)',
            }}
          >
            Switch to Advanced UI
          </button>
        </div>
      )}
    </div>
  );
}
