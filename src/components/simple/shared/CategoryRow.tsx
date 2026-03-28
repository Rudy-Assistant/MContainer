'use client';
import React from 'react';

interface CategoryRowProps {
  title: string;
  children: React.ReactNode;
}

export default function CategoryRow({ title, children }: CategoryRowProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main, #0f172a)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'thin' }}>
        {children}
      </div>
    </div>
  );
}
