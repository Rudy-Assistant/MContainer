import type { CSSProperties } from 'react';

/**
 * Shared section header style used across all finishes panel grids.
 * Canonical values: 10px, 600 weight, uppercase, text-dim color, 0.05em spacing.
 * Accepts optional marginBottom override (default 8).
 */
export function sectionHeaderStyle(mb = 8): CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--text-dim)',
    letterSpacing: '0.05em',
    marginBottom: mb,
  };
}
