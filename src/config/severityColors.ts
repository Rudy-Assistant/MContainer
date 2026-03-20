/**
 * severityColors.ts — Shared severity color constants for validation warnings.
 *
 * Used by both 2D (WarningPanel) and 3D (WarningOverlay) components.
 * Matches CSS custom properties: --danger, --warning, --accent.
 */
import type { WarningSeverity } from '@/types/validation';

/** CSS color strings for 2D UI */
export const SEVERITY_COLORS: Record<WarningSeverity, string> = {
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

/** Numeric hex for THREE.js materials */
export const SEVERITY_HEX: Record<WarningSeverity, number> = {
  error: 0xef4444,
  warning: 0xf59e0b,
  info: 0x3b82f6,
};
