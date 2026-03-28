'use client';
import React, { useRef, useState, useCallback } from 'react';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function SlidePanel({ open, onClose, children }: SlidePanelProps) {
  const [height, setHeight] = useState(30); // percentage of viewport
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, startHeight: height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [height]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const deltaY = dragRef.current.startY - e.clientY;
    const deltaPercent = (deltaY / window.innerHeight) * 100;
    const newHeight = Math.max(10, Math.min(60, dragRef.current.startHeight + deltaPercent));
    setHeight(newHeight);
  }, []);

  const onDragEnd = useCallback(() => {
    if (!dragRef.current) return;
    if (height < 15) onClose();
    dragRef.current = null;
  }, [height, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        height: `${height}vh`,
        background: 'var(--surface, #ffffff)',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: dragRef.current ? 'none' : 'height 0.3s ease',
        zIndex: 90,
        flexShrink: 0,
      }}
    >
      {/* Drag handle */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 0 4px',
          cursor: 'ns-resize',
          flexShrink: 0,
          touchAction: 'none',
        }}
      >
        <div style={{
          width: 40,
          height: 5,
          borderRadius: 3,
          background: 'var(--border, #e2e8f0)',
        }} />
      </div>

      {/* Scrollable content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '0 16px 16px',
      }}>
        {children}
      </div>
    </div>
  );
}
